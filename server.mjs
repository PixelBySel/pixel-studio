// Pixel Studio — dépose un rush + ton texte, il sort un reel vertical dans ton style.
// Lancer : npm start  puis ouvrir http://localhost:4321
// Licence MIT — https://github.com/PixelBySel/pixel-studio
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const run = promisify(execFile);
const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(DIR, 'public'), WORK = path.join(DIR, 'work'), OUT = path.join(DIR, 'out');
for (const d of [WORK, OUT]) fs.mkdirSync(d, { recursive: true });
const PORT = Number(process.env.PORT) || 4321;
const FPS = 30;
const CONFIG = JSON.parse(fs.readFileSync(path.join(DIR, 'studio.config.json'), 'utf8'));
let state = { step: 'idle', pct: 0, msg: '', file: null, rush: null };

const TYPES = { '.html': 'text/html; charset=utf-8', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };
function serve(res, file) {
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const set = (step, pct, msg) => { state = { ...state, step, pct, msg }; };

async function probe(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', file]);
  const j = JSON.parse(stdout);
  return { w: j.streams[0].width, h: j.streams[0].height, d: parseFloat(j.format.duration) };
}

// Mouvement du rush (zoompan de ffmpeg). n = nombre d'images, cuts = début/fin de chaque écran.
function motion(kind, n, cuts) {
  if (kind === 'fixe') return '1.04';
  if (kind === 'recul') return `1.12-0.10*on/${n}`;
  if (kind === 'ecran') { // petit zoom avant qui repart à chaque écran
    let z = '1.03';
    for (const [a, b] of [...cuts].reverse()) {
      const A = Math.round(a * FPS), B = Math.round(b * FPS);
      z = `if(between(on,${A},${B}),1.03+0.09*(on-${A})/${Math.max(1, B - A)},${z})`;
    }
    return z;
  }
  return `1+0.07*on/${n}`; // zoom avant lent (par défaut)
}

async function render(job) {
  const id = Date.now().toString(36);
  const frames = path.join(WORK, id); fs.mkdirSync(frames);
  set('page', 4, 'Écriture de la page de la vidéo…');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
    await page.goto(`http://localhost:${PORT}/template.html`);
    const { duration, cuts } = await page.evaluate(j => build(j), job);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const n = Math.round(duration * FPS);
    for (let i = 0; i < n; i++) {
      await page.evaluate(t => render(t), i / FPS);
      await page.screenshot({ path: path.join(frames, `f${String(i).padStart(4, '0')}.png`), omitBackground: true });
      if (i % 15 === 0) set('shoot', 8 + Math.round(72 * i / n), `Tournage image par image : ${i} / ${n}`);
    }
    await browser.close();

    set('edit', 84, 'Montage sur ton rush avec ffmpeg…');
    const { w, h, d } = await probe(state.rush);
    let cw = Math.round(h * 9 / 16), ch = h; if (cw > w) { cw = w; ch = Math.round(w * 16 / 9); }
    const fx = { centre: 0.5, gauche: 0.15, droite: 0.85 }[job.focus] ?? 0.5;
    const cx = `(iw-${cw})*${fx}`;
    const slow = d < duration ? (duration / d) * 1.02 : 1; // rush trop court : léger ralenti
    const z = motion(job.motion, n, cuts);
    const out = path.join(OUT, `reel-${id}${job.tiktok ? '-tiktok' : ''}.mp4`);
    const vf = `[0:v]crop=${cw}:${ch}:${cx}:(ih-${ch})/2,scale=1080:1920,setpts=PTS*${slow.toFixed(3)},fps=${FPS},` +
      `zoompan=z='${z}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=${FPS}[bg];[bg][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`;
    await run('ffmpeg', ['-v', 'error', '-y', '-i', state.rush, '-framerate', String(FPS), '-i', path.join(frames, 'f%04d.png'),
      '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-filter_complex', vf, '-map', '[v]', '-map', '2:a',
      '-t', duration.toFixed(2), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-c:a', 'aac', '-movflags', '+faststart', out], { maxBuffer: 1e8 });
    state = { ...state, step: 'done', pct: 100, msg: `Prêt : ${duration.toFixed(1)} s, ${job.screens.length} écrans`, file: '/out/' + path.basename(out) };
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(frames, { recursive: true, force: true });
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'PUT' && url.pathname === '/api/upload') {
    const name = path.basename(decodeURIComponent(req.headers['x-filename'] || 'rush.mp4')).replace(/[^\w.-]/g, '_');
    const file = path.join(WORK, 'rush-' + name);
    req.pipe(fs.createWriteStream(file)).on('finish', async () => {
      try { state.rush = file; json(res, 200, { ok: true, ...(await probe(file)) }); }
      catch { json(res, 400, { ok: false, error: 'Vidéo illisible' }); }
    });
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/render') {
    let body = ''; req.on('data', c => body += c); req.on('end', () => {
      if (!state.rush) return json(res, 400, { error: "Dépose un rush d'abord" });
      if (state.step === 'page' || state.step === 'shoot' || state.step === 'edit') return json(res, 409, { error: 'Un rendu est déjà en cours' });
      const job = { ...CONFIG, ...JSON.parse(body) };
      state.file = null; render(job).catch(e => set('error', 0, String(e.message || e)));
      json(res, 202, { ok: true });
    });
    return;
  }
  if (url.pathname === '/api/status') return json(res, 200, state);
  if (url.pathname === '/api/config') return json(res, 200, CONFIG);
  if (url.pathname === '/') return serve(res, path.join(PUB, 'index.html'));
  if (url.pathname.startsWith('/out/')) return serve(res, path.join(OUT, path.basename(url.pathname)));
  const file = path.join(PUB, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  serve(res, file);
}).listen(PORT, '127.0.0.1', () => console.log(`Pixel Studio → http://localhost:${PORT}`));
