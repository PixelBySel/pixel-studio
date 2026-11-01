// Pixel Studio · moteur web : dessine le reel image par image sur un canvas 1080x1920.
// Aucune dépendance. build(job) prépare les écrans, drawFrame(ctx, t, video) dessine l'instant t.
// Licence MIT — https://github.com/PixelBySel/pixel-studio

export const W = 1080, H = 1920, FPS = 30;

export const FONTS = {
  editorial: { ff: 'Instrument Serif', fs: 1, ls: -0.015, label: 'Éditorial' },
  fraunces: { ff: 'Fraunces', fs: .86, ls: -0.03, label: 'Fraunces' },
  dm: { ff: 'DM Serif', fs: .9, ls: -0.02, label: 'Magazine' },
  bricolage: { ff: 'Bricolage', fs: .78, ls: -0.035, sans: 1, label: 'Bricolage' },
  grotesk: { ff: 'Space Grotesk', fs: .8, ls: -0.04, sans: 1, label: 'Grotesk' },
  syne: { ff: 'Syne', fs: .7, ls: -0.03, sans: 1, label: 'Syne' },
};
export const EFFECTS = ['verre', 'liste', 'mur', 'chiffre', 'tel', 'magazine', 'code'];

const FONT_FILES = [
  ['Instrument Serif', 'instrument-serif.woff2', 'normal'], ['Instrument Serif', 'instrument-serif-italic.woff2', 'italic'],
  ['Fraunces', 'fraunces.woff2', 'normal'], ['Fraunces', 'fraunces-italic.woff2', 'italic'],
  ['DM Serif', 'dm-serif.woff2', 'normal'], ['DM Serif', 'dm-serif-italic.woff2', 'italic'],
  ['Bricolage', 'bricolage.woff2', 'normal'], ['Space Grotesk', 'space-grotesk.woff2', 'normal'],
  ['Syne', 'syne.woff2', 'normal'], ['JB', 'jetbrains-mono.woff2', 'normal'],
];
export async function loadFonts(base = 'fonts/') {
  await Promise.all(FONT_FILES.map(async ([fam, file, style]) => {
    const f = new FontFace(fam, `url(${base}${file})`, { style });
    document.fonts.add(await f.load());
  }));
}

// ---------- outils ----------
const cl = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - Math.pow(1 - x, 3);
const back = x => { const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const P = (lt, d, dur = .4) => cl((lt - d) / dur);
const items = s => String(s || '').split(';').map(x => x.trim()).filter(Boolean);
const nb = s => String(s || '').replace(/ ([?!:;»%])/g, ' $1').replace(/« /g, '« ');

function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; }
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// Texte riche : *mot* = accent (+ italique pour les polices à empattement), « / » = retour à la ligne.
function runs(str) {
  const out = []; let em = false;
  for (const part of nb(str).split('*')) { if (part) out.push({ t: part, em }); em = !em; }
  return out;
}
function setFont(ctx, S, size, em, family) {
  const f = family || S.font.ff, italic = em && !S.font.sans && !family ? 'italic ' : '';
  ctx.font = `${italic}${size}px "${f}"`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = family ? '0px' : `${(S.font.ls * size).toFixed(1)}px`;
}
// Découpe en lignes. Renvoie [{w, segs:[{t,em,w}]}]
function layout(ctx, S, str, size, maxW, family) {
  const lines = [];
  for (const para of String(str || '').split(' / ')) {
    const words = [];
    for (const r of runs(para)) for (const [i, w] of r.t.split(' ').entries()) {
      if (i > 0) words.push({ t: ' ', em: r.em, sp: 1 });
      if (w) words.push({ t: w, em: r.em });
    }
    let line = { w: 0, segs: [] };
    for (const wd of words) {
      setFont(ctx, S, size, wd.em, family);
      const w = ctx.measureText(wd.t).width;
      if (!wd.sp && line.w + w > maxW && line.segs.length) {
        while (line.segs.length && line.segs.at(-1).sp) line.w -= line.segs.pop().w;
        lines.push(line); line = { w: 0, segs: [] };
      }
      if (wd.sp && !line.segs.length) continue;
      line.segs.push({ ...wd, w }); line.w += w;
    }
    while (line.segs.length && line.segs.at(-1).sp) line.w -= line.segs.pop().w;
    lines.push(line);
  }
  return lines;
}
// Dessine un bloc de texte. align: left|center. Renvoie la hauteur.
function text(ctx, S, str, { x, y, size, maxW, lh = .95, align = 'left', color = S.cr, family, shadow = true, accent }) {
  const L = layout(ctx, S, str, size, maxW, family);
  ctx.textBaseline = 'alphabetic';
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 3; }
  L.forEach((line, i) => {
    let cx = align === 'center' ? x + (maxW - line.w) / 2 : x;
    const by = y + size * .82 + i * size * lh;
    for (const s of line.segs) {
      setFont(ctx, S, size, s.em, family);
      ctx.fillStyle = s.em ? (accent || S.ac) : color;
      ctx.fillText(s.t, cx, by); cx += s.w;
    }
  });
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  return L.length * size * lh + size * (1 - lh);
}
function mono(ctx, S, str, x, y, size, color, align = 'left', ls = .13) {
  ctx.font = `${size}px "JB"`; if ('letterSpacing' in ctx) ctx.letterSpacing = `${(ls * size).toFixed(1)}px`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y + size * .8); ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}
// Apparition d'un élément : fondu + montée (ou autre), appliquée autour de fn.
function anim(ctx, p, kind, fn, cx = W / 2, cy = H / 2) {
  if (p <= 0) return;
  ctx.save();
  const q = ease(p);
  if (kind === 'pop') { const s = .7 + .3 * back(p); ctx.globalAlpha *= cl(p * 3); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); }
  else if (kind === 'rise') { ctx.globalAlpha *= q; ctx.translate(0, (1 - q) * 500); }
  else if (kind.startsWith('slide')) { ctx.globalAlpha *= q; ctx.translate((1 - q) * (kind === 'slideR' ? 140 : -140), 0); }
  else { ctx.globalAlpha *= q; ctx.translate(0, (1 - q) * 36); }
  fn(); ctx.restore();
}

// ---------- éléments communs ----------
function header(ctx, S, lt, left, right) {
  anim(ctx, P(lt, 0), 'up', () => {
    mono(ctx, S, left.toUpperCase(), 80, 150, 22, S.mu);
    mono(ctx, S, right.toUpperCase(), W - 80, 150, 22, S.mu, 'right');
  });
}
function badge(ctx, S, lt, n) {
  anim(ctx, P(lt, 0), 'up', () => {
    ctx.font = '28px "JB"'; if ('letterSpacing' in ctx) ctx.letterSpacing = '3.4px';
    const w = ctx.measureText(n).width + 32;
    ctx.fillStyle = S.ac; rr(ctx, 80, 210, w, 48, 8); ctx.fill();
    mono(ctx, S, n, 96, 220, 28, '#121110', 'left', .12);
  });
}
function titleSub(ctx, S, lt, a, b, top, dSub = .7) {
  let h = 0;
  anim(ctx, P(lt, .05), 'up', () => { h = text(ctx, S, a, { x: 80, y: top, size: 124 * S.font.fs, maxW: 920 }); });
  if (!h) { ctx.save(); ctx.globalAlpha = 0; h = text(ctx, S, a, { x: 80, y: top, size: 124 * S.font.fs, maxW: 920 }); ctx.restore(); }
  if (b) anim(ctx, P(lt, dSub), 'up', () => {
    const size = S.font.sans ? 52 : 58, y = top + h + 60;
    const hh = text(ctx, S, b, { x: 102, y, size, maxW: 880, lh: 1.18 });
    ctx.fillStyle = S.ac; ctx.fillRect(80, y + 4, 4, hh - 4);
  });
}

// ---------- écrans ----------
function parse(line) {
  let fx = '', m = line.match(/^\[(\w+)\]\s*/);
  if (m) { fx = m[1].toLowerCase(); line = line.slice(m[0].length); }
  const [a, b] = line.split('|').map(x => x && x.trim());
  return { fx, a: a || '', b: b || '' };
}

function scene(line, i, S) {
  const { fx, a, b } = parse(line);
  const first = i === 0, n = String(i).padStart(2, '0');
  const head = (ctx, lt) => first ? header(ctx, S, lt, S.brand, S.tag) : badge(ctx, S, lt, n);
  switch (fx) {
    case 'verre': return (ctx, lt) => {
      head(ctx, lt);
      anim(ctx, P(lt, .15), 'pop', () => {
        const tsz = 104 * S.font.fs;
        const L = layout(ctx, S, a, tsz, 828).length, th = L * tsz * .95 + tsz * .05;
        const Lb = b ? layout(ctx, S, b, 50, 828).length : 0, bh = b ? 34 + Lb * 60 : 0;
        const h = 120 + th + bh, y = 700;
        const g = ctx.createLinearGradient(70, y, 1010, y + h);
        g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,.06)');
        ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 90; ctx.shadowOffsetY = 40;
        ctx.fillStyle = g; rr(ctx, 70, y, 940, h, 36); ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.stroke();
        text(ctx, S, a, { x: 126, y: y + 60, size: tsz, maxW: 828, shadow: false });
        if (b) anim(ctx, P(lt, .8), 'up', () => text(ctx, S, b, { x: 126, y: y + 60 + th + 34, size: 50, maxW: 828, lh: 1.2, color: 'rgba(239,236,230,.85)', shadow: false }));
      }, W / 2, 850);
    };
    case 'liste': return (ctx, lt) => {
      head(ctx, lt); titleSub(ctx, S, lt, a, '', 300);
      items(b).forEach((x, k) => anim(ctx, P(lt, .4 + k * .45), 'up', () => {
        const y = 640 + k * 140;
        ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
        ctx.fillStyle = 'rgba(244,241,234,.96)'; rr(ctx, 80, y, 920, 120, 20); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(23,21,15,.3)'; rr(ctx, 114, y + 34, 52, 52, 14); ctx.stroke();
        const p = P(lt, .7 + k * .45);
        if (p > 0) { ctx.save(); const s = .5 + .5 * back(p); ctx.globalAlpha *= ease(p); ctx.translate(140, y + 60); ctx.scale(s, s);
          ctx.fillStyle = S.ac; rr(ctx, -29, -29, 58, 58, 14); ctx.fill();
          ctx.strokeStyle = '#121110'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-3, 11); ctx.lineTo(15, -11); ctx.stroke(); ctx.restore(); }
        text(ctx, S, x, { x: 196, y: y + 32, size: 50, maxW: 780, color: S.ink, accent: S.ac, shadow: false, lh: 1 });
      }));
    };
    case 'mur': return (ctx, lt) => {
      let y = 300;
      [...items(a), ...items(b)].forEach((x, k) => {
        const len = x.replace(/\*/g, '').length, size = Math.min(170, Math.round(1500 / Math.max(len, 1))) * S.font.fs;
        const yy = y; y += size * .9;
        anim(ctx, P(lt, k * .22), k % 2 ? 'slideR' : 'slideL', () => {
          const accent = k % 2 === 1;
          text(ctx, S, accent ? `*${x.replace(/\*/g, '')}*` : x, { x: 60, y: yy, size, maxW: 2000, lh: .9 });
        });
      });
    };
    case 'chiffre': return (ctx, lt) => {
      head(ctx, lt);
      const m = a.match(/([\d.,]+)/), to = m ? parseFloat(m[1].replace(',', '.')) : 0, dec = m ? (m[1].split(/[.,]/)[1] || '').length : 0;
      const c = ease(cl((lt - .05) / 1.4)), val = (to * c).toFixed(dec).replace('.', ',');
      const str = m ? a.replace(m[1], val) : a;
      ctx.globalAlpha = cl(P(lt, .05) * 3);
      text(ctx, S, `*${str.replace(/\*/g, '')}*`, { x: 0, y: 620, size: 330 * S.font.fs, maxW: W, align: 'center', lh: .9 });
      ctx.globalAlpha = 1;
      if (b) anim(ctx, P(lt, .9), 'up', () => text(ctx, S, b, { x: 80, y: 1060, size: 50, maxW: 920, align: 'center', lh: 1.18 }));
    };
    case 'tel': return (ctx, lt) => {
      anim(ctx, P(lt, .05), 'up', () => text(ctx, S, a, { x: 80, y: 250, size: 100 * S.font.fs, maxW: 920 }));
      anim(ctx, P(lt, .25), 'rise', () => {
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 100; ctx.shadowOffsetY = 40;
        ctx.fillStyle = '#2a2927'; rr(ctx, 250, 620, 580, 1000, 70); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#0d0d0c'; rr(ctx, 264, 634, 552, 972, 56); ctx.fill();
        ctx.fillStyle = S.ac; ctx.beginPath(); ctx.arc(320, 680, 22, 0, 7); ctx.fill();
        mono(ctx, S, S.handle, 360, 669, 22, S.mu, 'left', .04);
        ctx.fillStyle = 'rgba(239,236,230,.1)'; ctx.fillRect(264, 724, 552, 1);
        let y = 760;
        items(b).forEach((x, k) => {
          const me = k % 2 === 1, maxW = 400;
          const L = layout(ctx, S, x, 40, maxW), w = Math.max(...L.map(l => l.w)) + 56, h = L.length * 48 + 44;
          const bx = me ? 790 - w : 290, yy = y; y += h + 22;
          const p = P(lt, .8 + k * .7);
          if (p <= 0) return;
          ctx.save(); const s = .7 + .3 * back(p); ctx.globalAlpha *= cl(p * 3);
          ctx.translate(bx + w / 2, yy + h / 2); ctx.scale(s, s); ctx.translate(-(bx + w / 2), -(yy + h / 2));
          ctx.fillStyle = me ? S.ac : '#262523';
          ctx.beginPath(); ctx.roundRect(bx, yy, w, h, me ? [30, 30, 8, 30] : [30, 30, 30, 8]); ctx.fill();
          text(ctx, S, x, { x: bx + 28, y: yy + 18, size: 40, maxW, lh: 1.2, color: me ? '#121110' : S.cr, accent: me ? '#121110' : S.ac, shadow: false });
          ctx.restore();
        });
      }, W / 2, 1100);
    };
    case 'magazine': return (ctx, lt) => {
      ctx.save();
      const z = 1.25 - .25 * ease(cl(lt / .9));
      ctx.globalAlpha = cl(lt / .2); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
      ctx.strokeStyle = S.cr; ctx.lineWidth = 3; ctx.strokeRect(60, 180, 960, 1440);
      let ms = 170 * S.font.fs; setFont(ctx, S, ms); const mw = ctx.measureText(S.brand.toUpperCase()).width; if (mw > 868) ms *= 868 / mw;
      text(ctx, S, S.brand.toUpperCase(), { x: 106, y: 220, size: ms, maxW: 2000, lh: .85, shadow: false });
      ctx.fillStyle = S.cr; ctx.fillRect(106, 220 + ms * .9 + 20, 868, 3);
      const my = 220 + ms * .9 + 42;
      mono(ctx, S, `N°${String(i + 1).padStart(2, '0')}`, 106, my, 22, S.mu); mono(ctx, S, S.tag.toUpperCase(), W / 2, my, 22, S.mu, 'center'); mono(ctx, S, S.handle.toUpperCase(), 974, my, 22, S.mu, 'right');
      anim(ctx, P(lt, .4), 'up', () => {
        const tsz = 110 * S.font.fs, L = layout(ctx, S, a, tsz, 868).length, th = L * tsz * .95;
        const bh = b ? layout(ctx, S, b, 46, 846).length * 54 + 30 : 0;
        const y0 = 1560 - th - bh;
        mono(ctx, S, 'COVER STORY', 106, y0 - 50, 26, S.ac, 'left', .14);
        text(ctx, S, a, { x: 106, y: y0, size: tsz, maxW: 868 });
        if (b) { const yb = y0 + th + 30; const hh = text(ctx, S, b, { x: 128, y: yb, size: 46, maxW: 846, lh: 1.18 }); ctx.fillStyle = S.ac; ctx.fillRect(106, yb + 4, 4, hh - 4); }
      });
      ctx.restore();
    };
    case 'code': return (ctx, lt) => {
      head(ctx, lt); titleSub(ctx, S, lt, a, '', 300);
      const L = items(b);
      anim(ctx, P(lt, .3), 'up', () => {
        const h = 80 + L.length * 58;
        ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
        ctx.fillStyle = '#141413'; rr(ctx, 70, 640, 940, h, 24); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(239,236,230,.18)'; ctx.lineWidth = 2; ctx.stroke();
        L.forEach((x, k) => {
          const d = .6 + k * .9; if (lt < d) return;
          const n = Math.floor(cl((lt - d) / (x.length * .035)) * x.length);
          mono(ctx, S, '$', 114, 680 + k * 58, 36, S.ac, 'left', 0);
          mono(ctx, S, x.slice(0, n), 160, 680 + k * 58, 36, S.cr, 'left', 0);
        });
      });
    };
    default: return (ctx, lt) => { head(ctx, lt); titleSub(ctx, S, lt, a, b, first ? 520 : 300); };
  }
}

function outro(S) {
  return (ctx, lt) => {
    header(ctx, S, lt, S.brand, S.handle);
    anim(ctx, P(lt, .05), 'up', () => text(ctx, S, S.outro, { x: 80, y: 500, size: 124 * S.font.fs, maxW: 920 }));
    anim(ctx, P(lt, .3), 'up', () => text(ctx, S, 'Abonne-toi pour la suite.', { x: 80, y: 840, size: 50, maxW: 920, align: 'center', lh: 1.18 }));
    anim(ctx, P(lt, .6), 'up', () => {
      ctx.fillStyle = 'rgba(14,13,12,.6)'; rr(ctx, 80, 1040, 920, 190, 20); ctx.fill();
      ctx.strokeStyle = S.ac; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = '38px "JB"'; ctx.textAlign = 'left'; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      const l1 = S.tiktok ? [[S.promise, S.cr]] : [['Commente ', S.cr], [S.keyword, S.ac]];
      const l2 = S.tiktok ? [['→ ', S.cr], ['lien en bio', S.ac]] : [['→ ' + S.promise, S.cr]];
      [l1, l2].forEach((segs, k) => {
        const w = segs.reduce((s, [t]) => s + ctx.measureText(t).width, 0); let x = W / 2 - w / 2;
        for (const [t, c] of segs) { ctx.fillStyle = c; ctx.fillText(t, x, 1112 + k * 55); x += ctx.measureText(t).width; }
      });
    });
  };
}

// ---------- assemblage ----------
export function build(job) {
  const font = FONTS[job.font] || FONTS.editorial;
  const S = {
    font, ac: job.accent || '#3ddc97', cr: '#efece6', mu: 'rgba(239,236,230,.62)', ink: '#17150f',
    brand: job.brand || 'Pixel Studio', handle: job.handle || '@ton.compte', tag: job.tag || 'Reel',
    outro: job.outro || 'Une astuce IA / *par jour.*', promise: job.promise || "je t'envoie le lien",
    keyword: (job.keyword || '').toUpperCase(), tiktok: !!job.tiktok,
  };
  const scenes = []; let t = 0;
  job.screens.forEach((l, i) => {
    const fx = parse(l).fx, extra = /liste|tel|code/.test(fx) ? 1 : 0;
    const d = i === 0 ? Math.max(3.2, job.sec - .6) : job.sec + extra;
    scenes.push({ start: t, end: t + d, draw: scene(l, i, S) }); t += d;
  });
  if (S.keyword) { scenes.push({ start: t, end: t + 4.2, draw: outro(S), last: 1 }); t += 4.2; }
  return { S, scenes, duration: t, transition: job.transition || 'fondu', motion: job.motion || 'zoom', focus: job.focus || 'centre' };
}

function zoomAt(R, t) {
  const D = R.duration || 1;
  if (R.motion === 'fixe') return 1.04;
  if (R.motion === 'recul') return 1.12 - .10 * t / D;
  if (R.motion === 'ecran') { const s = R.scenes.find(s => t >= s.start && t < s.end) || R.scenes.at(-1); return 1.03 + .09 * cl((t - s.start) / (s.end - s.start)); }
  return 1 + .07 * t / D;
}

// Fond : ton rush recadré en 9:16 avec mouvement, ou un dégradé si pas de rush.
export function drawBackground(ctx, R, t, video) {
  if (video && video.readyState >= 2 && video.videoWidth) {
    const vw = video.videoWidth, vh = video.videoHeight;
    let sw = Math.min(vw, vh * 9 / 16), sh = sw * 16 / 9; if (sh > vh) { sh = vh; sw = sh * 9 / 16; }
    const fx = { gauche: .15, centre: .5, droite: .85 }[R.focus] ?? .5;
    let sx = (vw - sw) * fx, sy = (vh - sh) / 2;
    const z = zoomAt(R, t), zw = sw / z, zh = sh / z;
    sx += (sw - zw) / 2; sy += (sh - zh) / 2;
    ctx.drawImage(video, sx, sy, zw, zh, 0, 0, W, H);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#24211d'); g.addColorStop(1, '#0d0c0b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(14,13,12,.9)'); v.addColorStop(.3, 'rgba(14,13,12,.7)'); v.addColorStop(.6, 'rgba(14,13,12,.64)'); v.addColorStop(1, 'rgba(14,13,12,.92)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

export function drawFrame(ctx, R, t, video) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  drawBackground(ctx, R, t, video);
  R.scenes.forEach((s, i) => {
    const lt = t - s.start, du = s.end - s.start;
    if (lt < 0 || lt >= du) return;
    const last = i === R.scenes.length - 1, pi = ease(cl(lt / .4)), po = last ? 0 : cl((lt - (du - .3)) / .3);
    ctx.save(); ctx.globalAlpha = Math.min(cl(lt / .15), 1 - po);
    if (R.transition === 'glisse') ctx.translate(0, (1 - pi) * 160 - po * po * 160);
    else if (R.transition === 'zoom') { const z = 1.18 - .18 * pi + po * po * .35; ctx.translate(W / 2, H * .45); ctx.scale(z, z); ctx.translate(-W / 2, -H * .45); }
    s.draw(ctx, lt);
    ctx.restore();
  });
  ctx.restore();
}

// Zones cachées par l'interface d'Instagram (repères pour l'aperçu, jamais exportés).
export function drawSafeZones(ctx) {
  ctx.save(); ctx.fillStyle = 'rgba(255,60,60,.16)';
  ctx.fillRect(0, 0, W, 220); ctx.fillRect(0, H - 420, W, 420); ctx.fillRect(W - 160, 900, 160, 600);
  ctx.restore();
}

// Temps source dans le rush (léger ralenti si le rush est plus court que le reel).
export function sourceTime(R, t, video) {
  if (!video || !video.duration) return 0;
  const slow = video.duration < R.duration ? (R.duration / video.duration) * 1.02 : 1;
  return Math.min(video.duration - .05, t / slow);
}
