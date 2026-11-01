// Pixel Studio · interface web (aperçu en direct + export).
import { W, H, FONTS, build, drawFrame, drawSafeZones, sourceTime, loadFonts } from './engine.js';
import { exportMp4, exportCover, pickCodec } from './export.js';

const $ = id => document.getElementById(id);
const store = { get(k, d) { try { return localStorage.getItem('ps.' + k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('ps.' + k, v); } catch {} } };
const COLORS = ['#ff4f1f', '#6f9bff', '#3ddc97', '#ffd84d', '#b79cff', '#ff6b9a'];
const FX = [['verre', 'Verre'], ['liste', 'Liste à cocher'], ['mur', 'Mur de titres'], ['chiffre', 'Chiffre qui monte'], ['tel', 'Téléphone'], ['magazine', 'Magazine'], ['code', 'Code']];
const TR = [['fondu', 'Fondu'], ['glisse', 'Glissé'], ['zoom', 'Zoom']];
const MO = [['zoom', 'Zoom avant'], ['recul', 'Recul'], ['ecran', 'À chaque écran'], ['fixe', 'Fixe']];
const FO = [['gauche', 'Gauche'], ['centre', 'Centre'], ['droite', 'Droite']];
const EXAMPLE = `Ton rush. / *Ton texte.* | Le reel sort tout seul.
[liste] *7 effets.* | Verre ; Liste ; Mur de titres ; Téléphone
[chiffre] 6 | polices au choix.
[mur] Gratuit ; *Open source* ; Sur ton appareil`;

const opt = { accent: store.get('accent', '#3ddc97'), font: store.get('font', 'editorial'), transition: store.get('transition', 'fondu'), motion: store.get('motion', 'zoom'), focus: store.get('focus', 'centre') };
const video = $('vid'); let hasRush = false;

// ---------- contrôles ----------
function seg(id, list, key) {
  $(id).innerHTML = list.map(([v, l]) => `<button class="chip ${opt[key] === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('');
  $(id).onclick = e => { const v = e.target.dataset.v; if (!v) return; opt[key] = v; store.set(key, v); seg(id, list, key); rebuild(); };
}
seg('tr', TR, 'transition'); seg('mo', MO, 'motion'); seg('fo', FO, 'focus');
function fonts() { $('fonts').innerHTML = Object.entries(FONTS).map(([v, f]) => `<button class="${opt.font === v ? 'on' : ''}" data-v="${v}"><span style="font-family:'${f.ff}'">Aa</span><small>${f.label}</small></button>`).join(''); }
$('fonts').onclick = e => { const b = e.target.closest('button'); if (!b) return; opt.font = b.dataset.v; store.set('font', opt.font); fonts(); rebuild(); };
$('sw').innerHTML = COLORS.map(c => `<button style="background:${c}" data-c="${c}" aria-label="Couleur ${c}"></button>`).join('');
const setAc = c => { opt.accent = c; store.set('accent', c); document.documentElement.style.setProperty('--ac', c); [...$('sw').children].forEach(b => b.classList.toggle('on', b.dataset.c === c)); rebuild(); };
$('sw').onclick = e => { if (e.target.dataset.c) setAc(e.target.dataset.c); };
$('fx').innerHTML = FX.map(([t, l]) => `<button class="chip" data-t="[${t}] ">+ ${l}</button>`).join('');
$('fx').onclick = e => {
  const t = e.target.dataset.t; if (!t) return;
  const ta = $('txt'), p = ta.selectionStart, ls = ta.value.lastIndexOf('\n', p - 1) + 1;
  ta.value = ta.value.slice(0, ls) + t + ta.value.slice(ls).replace(/^\[\w+\]\s*/, '');
  ta.focus(); ta.selectionStart = ta.selectionEnd = ls + t.length; changed();
};
$('sec').oninput = () => { $('sv').textContent = $('sec').value + ' s / écran'; store.set('sec', $('sec').value); rebuild(); };
$('txt').value = store.get('txt', EXAMPLE);
$('sec').value = store.get('sec', '4'); $('sv').textContent = $('sec').value + ' s / écran';
for (const k of ['kw', 'brand', 'handle', 'promise']) { $(k).value = store.get(k, ''); $(k).oninput = () => { store.set(k, $(k).value); rebuild(); }; }
let deb; const changed = () => { store.set('txt', $('txt').value); clearTimeout(deb); deb = setTimeout(rebuild, 150); };
$('txt').oninput = changed;

// ---------- rush ----------
function loadRush(f) {
  if (!f) return;
  if (video.src) URL.revokeObjectURL(video.src);
  video.src = URL.createObjectURL(f);
  $('dp').textContent = f.name; $('drop').classList.add('on');
  video.onloadedmetadata = () => { hasRush = true; $('info').textContent = `${video.videoWidth}×${video.videoHeight} · ${video.duration.toFixed(1)} s`; restart(); };
  video.onerror = () => { hasRush = false; $('dp').textContent = 'Vidéo illisible dans ce navigateur. Sur iPhone : Réglages > Appareil photo > Formats > « Le plus compatible », ou essaie Safari.'; };
}
$('file').onchange = e => loadRush(e.target.files[0]);
['dragover', 'dragenter'].forEach(ev => $('drop').addEventListener(ev, e => { e.preventDefault(); $('drop').classList.add('on'); }));
$('drop').addEventListener('drop', e => { e.preventDefault(); loadRush(e.dataTransfer.files[0]); });

// ---------- aperçu en direct ----------
const job = (extra = {}) => ({
  ...opt, screens: $('txt').value.split('\n').map(s => s.trim()).filter(Boolean), sec: +$('sec').value,
  keyword: $('kw').value.trim(), brand: $('brand').value || 'Pixel Studio', handle: $('handle').value || '@ton.compte',
  promise: $('promise').value || "je t'envoie le lien", tag: 'Reel', ...extra,
});
const cv = $('cv'), ctx = cv.getContext('2d');
let R = null, exporting = false, playing = true, t0 = performance.now(), tNow = 0, scrubbing = false;
function rebuild() { const j = job(); if (!j.screens.length) j.screens = ['Écris ton premier écran.']; R = build(j); }
function restart() { tNow = 0; t0 = performance.now(); syncVideo(true); }
function syncVideo(force) {
  if (!hasRush || !R || exporting) return;
  const slow = video.duration < R.duration ? (R.duration / video.duration) * 1.02 : 1;
  video.playbackRate = Math.max(.0625, 1 / slow);
  const want = sourceTime(R, tNow, video);
  if (force || Math.abs(video.currentTime - want) > .25) video.currentTime = want;
  if (playing && video.paused) video.play().catch(() => {});
  if (!playing && !video.paused) video.pause();
}
function loop(now) {
  if (R && !exporting) {
    if (playing && !scrubbing) { tNow = (now - t0) / 1000; if (tNow >= R.duration) { tNow = 0; t0 = now; syncVideo(true); } }
    syncVideo(false);
    drawFrame(ctx, R, tNow, hasRush ? video : null);
    if ($('safe').checked) drawSafeZones(ctx);
    $('time').textContent = `${tNow.toFixed(1).replace('.', ',')} / ${R.duration.toFixed(1).replace('.', ',')} s`;
    if (!scrubbing) $('seek').value = Math.round(1000 * tNow / R.duration);
  }
  requestAnimationFrame(loop);
}
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? '❚❚' : '▶'; t0 = performance.now() - tNow * 1000; syncVideo(true); };
$('seek').oninput = () => { scrubbing = true; tNow = R.duration * $('seek').value / 1000; t0 = performance.now() - tNow * 1000; syncVideo(true); };
$('seek').onchange = () => { scrubbing = false; };

// ---------- export ----------
const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 60000); };
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
$('go').onclick = async () => {
  const j = job(); if (!j.screens.length) { $('msg').textContent = 'Écris au moins un écran.'; return; }
  const versions = [{ tiktok: false, name: `reel-${stamp()}.mp4` }];
  if ($('tt').checked && j.keyword) versions.push({ tiktok: true, name: `reel-${stamp()}-tiktok.mp4` });
  $('go').disabled = true; const wasPlaying = playing; playing = false; exporting = true;
  try {
    for (const [k, v] of versions.entries()) {
      const t1 = performance.now();
      const res = await exportMp4({ ...j, tiktok: v.tiktok }, hasRush ? video : null, p => {
        $('bar').style.width = ((k + p) / versions.length * 100) + '%';
        $('msg').textContent = `Export${versions.length > 1 ? ` ${k + 1}/${versions.length}` : ''} : ${Math.round(p * 100)} %`;
      });
      save(res.blob, v.name);
      $('msg').textContent = `Prêt : ${res.duration.toFixed(1)} s en ${((performance.now() - t1) / 1000).toFixed(0)} s.` + (res.codec !== 'avc' ? ' Ton navigateur n\'encode pas en H.264 : pour Instagram, préfère Chrome ou Safari.' : '');
    }
  } catch (e) { $('msg').textContent = e.message || String(e); }
  $('go').disabled = false; exporting = false; playing = wasPlaying; t0 = performance.now() - tNow * 1000; syncVideo(true);
};
$('cover').onclick = async () => { const wasPlaying = playing; playing = false; exporting = true; try { save(await exportCover(job(), hasRush ? video : null), `couverture-${stamp()}.png`); } finally { exporting = false; playing = wasPlaying; t0 = performance.now() - tNow * 1000; syncVideo(true); } };

// ---------- démarrage ----------
fonts(); setAc(opt.accent);
pickCodec().then(c => { if (!c) { $('go').disabled = true; $('msg').textContent = "L'export demande Chrome, Edge ou Safari à jour. L'aperçu fonctionne quand même."; } });
loadFonts('fonts/').then(() => { rebuild(); requestAnimationFrame(loop); });
window.__ps = { job, exportMp4, video, get R() { return R; } }; // pour les tests
