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
export const EFFECTS = ['verre', 'liste', 'mur', 'chiffre', 'tel', 'magazine', 'code',
  'ticket', 'tampon', 'commentaire', 'abonne', 'widgets', 'rebours',
  'derriere', 'projecteur', 'cible', 'zoomvisage', 'orbite', 'murtete'];
// Effets qui ont besoin de repérer la personne filmée (détourage + visage, calculés dans le navigateur).
export const PERSON_FX = ['derriere', 'projecteur', 'cible', 'zoomvisage', 'orbite', 'murtete'];

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

    // ---------- effets sans visage ----------
    case 'ticket': return (ctx, lt) => {
      head(ctx, lt);
      const L = items(b), lh = 78, h = 250 + L.length * lh + 50, top = 460;
      const p = ease(cl((lt - .2) / (0.6 + L.length * .35)));
      const shown = h * p;
      ctx.save();
      // fente de l'imprimante
      ctx.fillStyle = '#1c1b19'; rr(ctx, 110, top - 34, 860, 44, 22); ctx.fill();
      ctx.fillStyle = '#0a0a09'; rr(ctx, 140, top - 16, 800, 10, 5); ctx.fill();
      ctx.beginPath(); ctx.rect(0, top - 6, W, shown + 40); ctx.clip();
      ctx.translate(0, shown - h);
      ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
      ctx.fillStyle = '#f6f2e9';
      ctx.beginPath(); ctx.moveTo(160, top);
      ctx.lineTo(920, top); ctx.lineTo(920, top + h);
      for (let x = 920; x > 160; x -= 38) { ctx.lineTo(x - 19, top + h - 18); ctx.lineTo(x - 38, top + h); }
      ctx.closePath(); ctx.fill(); ctx.shadowColor = 'transparent';
      mono(ctx, S, (S.brand || '').toUpperCase(), W / 2, top + 50, 32, '#17150f', 'center', .2);
      text(ctx, S, a, { x: 200, y: top + 104, size: 76 * S.font.fs, maxW: 680, align: 'center', color: '#17150f', accent: S.ac, shadow: false, lh: 1 });
      ctx.strokeStyle = 'rgba(23,21,15,.35)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(200, top + 216); ctx.lineTo(880, top + 216); ctx.stroke(); ctx.setLineDash([]);
      L.forEach((x, k) => {
        const [lab, val] = x.split(':').map(v => v.trim());
        const y = top + 244 + k * lh, tot = /^total/i.test(lab);
        mono(ctx, S, lab, 200, y, tot ? 44 : 38, tot ? S.ac : '#17150f', 'left', .02);
        if (val) mono(ctx, S, val, 880, y, tot ? 44 : 38, tot ? S.ac : '#17150f', 'right', .02);
      });
      ctx.restore();
    };
    case 'tampon': return (ctx, lt) => {
      head(ctx, lt);
      if (b) anim(ctx, P(lt, .05), 'up', () => text(ctx, S, b, { x: 80, y: 300, size: 100 * S.font.fs, maxW: 920 }));
      const d = b ? .7 : .15, p = cl((lt - d) / .28);
      if (p <= 0) return;
      const s = 2.4 - 1.4 * ease(p), shake = p >= 1 ? Math.max(0, 1 - (lt - d - .28) / .25) : 0;
      ctx.save(); ctx.globalAlpha *= cl(p * 2.5);
      ctx.translate(W / 2 + Math.sin(lt * 90) * 10 * shake, 1000 + Math.cos(lt * 80) * 8 * shake); ctx.rotate(-.21); ctx.scale(s, s);
      const word = a.replace(/\*/g, '').toUpperCase();
      ctx.font = `${170 * (S.font.sans ? .9 : 1)}px "${S.font.ff}"`; if ('letterSpacing' in ctx) ctx.letterSpacing = '6px';
      let w = ctx.measureText(word).width; const k = Math.min(1, 760 / w); ctx.scale(k, k); w *= 1;
      ctx.strokeStyle = S.ac; ctx.lineWidth = 14; rr(ctx, -w / 2 - 50, -130, w + 100, 230, 26); ctx.stroke();
      ctx.lineWidth = 5; rr(ctx, -w / 2 - 30, -110, w + 60, 190, 16); ctx.stroke();
      ctx.fillStyle = S.ac; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(word, 0, -12);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();
    };
    case 'commentaire': return (ctx, lt) => {
      head(ctx, lt);
      if (b) anim(ctx, P(lt, .05), 'up', () => text(ctx, S, b, { x: 80, y: 300, size: 100 * S.font.fs, maxW: 920 }));
      const y0 = 900, word = a.replace(/\*/g, '');
      anim(ctx, P(lt, .3), 'rise', () => {
        ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
        ctx.fillStyle = '#1b1a18'; rr(ctx, 70, y0, 940, 420, 36); ctx.fill(); ctx.shadowColor = 'transparent';
        mono(ctx, S, 'COMMENTAIRES', W / 2, y0 + 36, 24, S.mu, 'center', .14);
        const posted = lt > 1.15 + word.length * .09 + .5;
        if (posted) {
          const q = ease(cl((lt - (1.15 + word.length * .09 + .5)) / .4));
          ctx.save(); ctx.globalAlpha *= q; ctx.translate(0, (1 - q) * 40);
          ctx.fillStyle = S.ac; ctx.beginPath(); ctx.arc(140, y0 + 140, 34, 0, 7); ctx.fill();
          mono(ctx, S, 'toi · à l\'instant', 196, y0 + 110, 24, S.mu, 'left', .02);
          text(ctx, S, word, { x: 196, y: y0 + 140, size: 50, maxW: 700, color: S.cr, family: 'JB', shadow: false, lh: 1 });
          ctx.restore();
        }
        // champ de saisie
        ctx.fillStyle = '#262523'; rr(ctx, 100, y0 + 290, 880, 96, 48); ctx.fill();
        const n = Math.floor(cl((lt - 1.15) / Math.max(.3, word.length * .09)) * word.length);
        const typed = posted ? '' : word.slice(0, n);
        mono(ctx, S, typed || 'Ajouter un commentaire…', 140, y0 + 318, 34, typed ? S.cr : S.mu, 'left', .02);
        if (!posted && Math.floor(lt * 2.5) % 2 === 0 && n < word.length) { ctx.font = '34px "JB"'; ctx.fillStyle = S.ac; ctx.fillRect(140 + ctx.measureText(typed).width + 4, y0 + 318, 4, 40); }
        const pressT = 1.15 + word.length * .09 + .25, press = lt > pressT && lt < pressT + .25;
        mono(ctx, S, 'Publier', 940, y0 + 318, 34, n >= word.length ? S.ac : 'rgba(239,236,230,.3)', 'right', .02);
        if (press) { ctx.fillStyle = hexA(S.ac, .25); ctx.beginPath(); ctx.arc(880, y0 + 338, 60 * (1 + (lt - pressT) * 2), 0, 7); ctx.fill(); }
      }, W / 2, y0 + 200);
    };
    case 'abonne': return (ctx, lt) => {
      head(ctx, lt);
      anim(ctx, P(lt, .05), 'up', () => text(ctx, S, a, { x: 80, y: 300, size: 100 * S.font.fs, maxW: 920 }));
      const y0 = 860;
      anim(ctx, P(lt, .3), 'pop', () => {
        ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
        ctx.fillStyle = '#f4f1ea'; rr(ctx, 110, y0, 860, 470, 40); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = S.ac; ctx.beginPath(); ctx.arc(W / 2, y0 + 120, 74, 0, 7); ctx.fill();
        text(ctx, S, (S.brand || 'P')[0].toUpperCase(), { x: W / 2 - 100, y: y0 + 64, size: 100, maxW: 200, align: 'center', color: '#17150f', shadow: false, family: S.font.ff });
        text(ctx, S, b || S.brand, { x: 150, y: y0 + 214, size: 54, maxW: 780, align: 'center', color: '#17150f', shadow: false, lh: 1 });
        mono(ctx, S, S.handle, W / 2, y0 + 286, 26, 'rgba(23,21,15,.55)', 'center', .02);
        const tapT = 1.5, done = lt > tapT;
        const bx = 270, by = y0 + 350, bw = 540, bh = 86;
        if (!done) { ctx.fillStyle = S.ac; rr(ctx, bx, by, bw, bh, 43); ctx.fill(); mono(ctx, S, "S'abonner", W / 2, by + 24, 36, '#17150f', 'center', .04); }
        else { ctx.strokeStyle = 'rgba(23,21,15,.3)'; ctx.lineWidth = 3; rr(ctx, bx, by, bw, bh, 43); ctx.stroke(); mono(ctx, S, 'Abonné ✓', W / 2, by + 24, 36, '#17150f', 'center', .04); }
        // le doigt qui tape
        const fp = cl((lt - .9) / .6), fx = 760 - 120 * ease(fp), fy = by + 140 - 90 * ease(fp);
        if (lt > .9 && lt < tapT + .6) {
          if (lt > tapT && lt < tapT + .35) { ctx.fillStyle = hexA(S.ac, .3); ctx.beginPath(); ctx.arc(fx, fy, 30 + (lt - tapT) * 160, 0, 7); ctx.fill(); }
          ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(fx, fy, 30, 0, 7); ctx.fill(); ctx.stroke();
        }
      }, W / 2, y0 + 230);
    };
    case 'widgets': return (ctx, lt) => {
      head(ctx, lt); titleSub(ctx, S, lt, a, '', 300);
      const L = items(b), pos = [[80, 640], [560, 700], [80, 1000], [560, 1060], [80, 1360], [560, 1420]];
      L.slice(0, 6).forEach((x, k) => {
        const [px, py] = pos[k], bob = Math.sin(lt * 1.6 + k) * 10;
        anim(ctx, P(lt, .4 + k * .25), 'pop', () => {
          const g = ctx.createLinearGradient(px, py, px + 440, py + 280);
          g.addColorStop(0, 'rgba(255,255,255,.24)'); g.addColorStop(1, 'rgba(255,255,255,.07)');
          ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
          ctx.fillStyle = g; rr(ctx, px, py + bob, 440, 280, 44); ctx.fill(); ctx.shadowColor = 'transparent';
          ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = S.ac; ctx.beginPath(); ctx.arc(px + 64, py + bob + 64, 22, 0, 7); ctx.fill();
          const m = x.match(/^(\d[\d\s.,]*[%+k×]?)\s+(\D.*)$/i);
          if (m) { text(ctx, S, `*${m[1]}*`, { x: px + 40, y: py + bob + 104, size: 96 * S.font.fs, maxW: 380, shadow: false, lh: 1 }); text(ctx, S, m[2], { x: px + 40, y: py + bob + 206, size: 38, maxW: 380, shadow: false, lh: 1.05, color: 'rgba(239,236,230,.85)' }); }
          else text(ctx, S, x, { x: px + 40, y: py + bob + 112, size: 50, maxW: 370, shadow: false, lh: 1.08 });
        }, px + 220, py + 140);
      });
    };
    case 'rebours': return (ctx, lt) => {
      head(ctx, lt);
      const step = .65, k = Math.floor(lt / step), n = 3 - k;
      if (n >= 1) {
        const f = cl((lt - k * step) / .25);
        const cx = W / 2, cy = 820, w = 420, h = 520;
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
        ctx.fillStyle = '#1b1a18'; rr(ctx, cx - w / 2, cy - h / 2, w, h, 40); ctx.fill(); ctx.shadowColor = 'transparent';
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cx - w / 2, cy - 3, w, 6);
        ctx.translate(cx, cy); ctx.scale(1, f < 1 ? Math.abs(Math.cos(f * Math.PI)) * .3 + .7 : 1);
        text(ctx, S, `*${n}*`, { x: -w / 2, y: -230, size: 420 * S.font.fs, maxW: w, align: 'center', shadow: false, lh: .9 });
        ctx.restore();
      } else {
        const lt2 = lt - 3 * step;
        anim(ctx, P(lt2, 0), 'pop', () => text(ctx, S, a, { x: 80, y: 640, size: 140 * S.font.fs, maxW: 920, align: 'center', lh: .92 }), W / 2, 760);
        if (b) anim(ctx, P(lt2, .5), 'up', () => text(ctx, S, b, { x: 80, y: 1000, size: 50, maxW: 920, align: 'center', lh: 1.18 }));
      }
    };
    // ---------- effets avec la personne filmée ----------
    case 'derriere': return (ctx, lt, X) => {
      const word = a.replace(/\*/g, '').toUpperCase();
      ctx.save(); ctx.globalAlpha *= cl(lt / .35);
      const size = Math.min(520, 1900 / Math.max(3, word.length)) * (S.font.sans ? .92 : 1.05);
      const q = ease(cl(lt / .55)), y = X.face.cy - X.face.h * .15 - size * .5;
      ctx.translate(W / 2, y + size * .5); ctx.scale(1.25 - .25 * q, 1.25 - .25 * q); ctx.translate(-W / 2, -(y + size * .5));
      ctx.font = `${size}px "${S.font.ff}"`; if ('letterSpacing' in ctx) ctx.letterSpacing = `${-size * .02}px`;
      const fit = Math.min(1, 1000 / ctx.measureText(word).width);
      ctx.translate(W / 2, y); ctx.scale(fit, fit); ctx.translate(-W / 2, -y);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = S.ac; ctx.fillText(word, W / 2, y);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.restore();
      X.cutout(ctx);
      if (b) anim(ctx, P(lt, .6), 'up', () => text(ctx, S, b, { x: 80, y: 1380, size: 56, maxW: 920, align: 'center', lh: 1.15 }));
    };
    case 'projecteur': return (ctx, lt, X) => {
      const q = ease(cl(lt / .5));
      ctx.fillStyle = `rgba(0,0,0,${.78 * q})`; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(X.face.cx, X.face.cy, 40, X.face.cx, X.face.cy + 300, 900);
      g.addColorStop(0, hexA(S.ac, .35 * q)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      X.cutout(ctx, { veil: 1 - q });
      head(ctx, lt);
      anim(ctx, P(lt, .5), 'up', () => text(ctx, S, a, { x: 80, y: 260, size: 110 * S.font.fs, maxW: 920, align: 'center' }));
      if (b) anim(ctx, P(lt, .9), 'up', () => text(ctx, S, b, { x: 80, y: 1400, size: 52, maxW: 920, align: 'center', lh: 1.15 }));
    };
    case 'cible': return (ctx, lt, X) => {
      const f = X.face, p = ease(cl((lt - .1) / .6)), pad = 1.6 - .6 * p;
      const w = f.w * pad * 1.15, h = f.h * pad * 1.15, x = f.cx - w / 2, y = f.cy - h / 2, c = Math.min(w, h) * .22;
      ctx.save(); ctx.strokeStyle = S.ac; ctx.lineWidth = 8; ctx.lineCap = 'square'; ctx.globalAlpha *= cl(lt / .2);
      for (const [px, py, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
        ctx.beginPath(); ctx.moveTo(px, py + dy * c); ctx.lineTo(px, py); ctx.lineTo(px + dx * c, py); ctx.stroke();
      }
      if (p >= 1) {
        ctx.fillStyle = S.ac; rr(ctx, x, y + h + 24, 330, 52, 8); ctx.fill();
        mono(ctx, S, 'CIBLE VERROUILLÉE', x + 18, y + h + 36, 24, '#121110', 'left', .1);
        ctx.strokeStyle = hexA(S.ac, .5); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.cx - 30, f.cy); ctx.lineTo(f.cx + 30, f.cy); ctx.moveTo(f.cx, f.cy - 30); ctx.lineTo(f.cx, f.cy + 30); ctx.stroke();
      }
      ctx.restore();
      anim(ctx, P(lt, .8), 'up', () => text(ctx, S, a, { x: 80, y: 1360, size: 96 * S.font.fs, maxW: 920, align: 'center' }));
      if (b) anim(ctx, P(lt, 1.2), 'up', () => text(ctx, S, b, { x: 80, y: 1560, size: 46, maxW: 920, align: 'center', lh: 1.15 }));
    };
    case 'zoomvisage': return (ctx, lt, X) => {
      const z = 1 + .45 * ease(cl(lt / .35));
      X.redraw(ctx, z, X.face.cx, X.face.cy - X.face.h * .1);
      anim(ctx, P(lt, .2), 'up', () => {
        const tsz = 120 * S.font.fs, L = layout(ctx, S, a, tsz, 900).length, th = L * tsz * .95;
        ctx.fillStyle = 'rgba(14,13,12,.82)'; rr(ctx, 60, 1250, 960, th + 90, 26); ctx.fill();
        text(ctx, S, a, { x: 90, y: 1290, size: tsz, maxW: 900, align: 'center' });
      });
      if (b) anim(ctx, P(lt, .7), 'up', () => text(ctx, S, b, { x: 80, y: 260, size: 52, maxW: 920, align: 'center', lh: 1.15 }));
    };
    case 'orbite': return (ctx, lt, X) => {
      const L = items(b).length ? items(b) : items(a), f = X.face, cx = f.cx, cy = f.cy - f.h * .35;
      const rx = Math.min(330, Math.max(240, f.w * 1.1)), ry = 110, n = L.length, rot = lt * .9;
      const cards = L.map((x, k) => { const ang = rot + k * Math.PI * 2 / n; return { x, k, X: cx + Math.cos(ang) * rx, Y: cy + Math.sin(ang) * ry, z: Math.sin(ang) }; });
      const draw = cdl => cdl.forEach(c => anim(ctx, P(lt, .1 + c.k * .15), 'pop', () => {
        const s = .78 + .22 * (c.z + 1) / 2, w = 360 * s, h = 132 * s;
        ctx.save(); ctx.globalAlpha *= .55 + .45 * (c.z + 1) / 2;
        ctx.fillStyle = c.z > 0 ? '#f4f1ea' : 'rgba(244,241,234,.85)'; rr(ctx, c.X - w / 2, c.Y - h / 2, w, h, 22 * s); ctx.fill();
        text(ctx, S, c.x, { x: c.X - w / 2 + 16, y: c.Y - 28 * s, size: 54 * s, maxW: w - 32, align: 'center', color: '#17150f', accent: S.ac, shadow: false, lh: 1 });
        ctx.restore();
      }, c.X, c.Y));
      draw(cards.filter(c => c.z <= 0).sort((p, q) => p.z - q.z));
      X.cutout(ctx);
      draw(cards.filter(c => c.z > 0).sort((p, q) => p.z - q.z));
      if (items(b).length && a) anim(ctx, P(lt, .5), 'up', () => text(ctx, S, a, { x: 80, y: 1400, size: 96 * S.font.fs, maxW: 920, align: 'center' }));
    };
    case 'murtete': return (ctx, lt, X) => {
      const L = items(b); let y = 200;
      L.forEach((x, k) => {
        const len = x.replace(/\*/g, '').length, size = Math.min(150, Math.round(1450 / Math.max(len, 1))) * S.font.fs, yy = y; y += size * .92;
        anim(ctx, P(lt, k * .18), k % 2 ? 'slideR' : 'slideL', () => {
          ctx.globalAlpha *= .9;
          text(ctx, S, k % 2 ? `*${x.replace(/\*/g, '')}*` : x, { x: 40, y: yy, size, maxW: 2000, lh: .9, shadow: false });
        });
      });
      X.cutout(ctx);
      if (a) anim(ctx, P(lt, .3 + L.length * .18), 'pop', () => {
        const tsz = 130 * S.font.fs;
        ctx.fillStyle = S.ac; const L2 = layout(ctx, S, a, tsz, 860), w = Math.max(...L2.map(l => l.w)) + 80, h = L2.length * tsz * .95 + 70;
        rr(ctx, W / 2 - w / 2, 1330, w, h, 24); ctx.fill();
        text(ctx, S, a.replace(/\*/g, ''), { x: W / 2 - w / 2 + 40, y: 1360, size: tsz, maxW: w - 80, align: 'center', color: '#121110', shadow: false });
      }, W / 2, 1400);
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
    const fx = parse(l).fx, extra = /^(liste|tel|code|ticket|commentaire|abonne|rebours|widgets)$/.test(fx) ? 1 : 0;
    const d = i === 0 ? Math.max(3.2, job.sec - .6) : job.sec + extra;
    scenes.push({ start: t, end: t + d, draw: scene(l, i, S) }); t += d;
  });
  if (S.keyword) { scenes.push({ start: t, end: t + 4.2, draw: outro(S), last: 1 }); t += 4.2; }
  const needsPerson = job.screens.some(l => PERSON_FX.includes(parse(l).fx));
  return { S, scenes, needsPerson, duration: t, transition: job.transition || 'fondu', motion: job.motion || 'zoom', focus: job.focus || 'centre' };
}

function zoomAt(R, t) {
  const D = R.duration || 1;
  if (R.motion === 'fixe') return 1.04;
  if (R.motion === 'recul') return 1.12 - .10 * t / D;
  if (R.motion === 'ecran') { const s = R.scenes.find(s => t >= s.start && t < s.end) || R.scenes.at(-1); return 1.03 + .09 * cl((t - s.start) / (s.end - s.start)); }
  return 1 + .07 * t / D;
}

// Zone du rush affichée à l'instant t (recadrage 9:16 + mouvement), en pixels de la vidéo.
export function viewRect(R, t, video) {
  const vw = video.videoWidth, vh = video.videoHeight;
  let sw = Math.min(vw, vh * 9 / 16), sh = sw * 16 / 9; if (sh > vh) { sh = vh; sw = sh * 9 / 16; }
  const fx = { gauche: .15, centre: .5, droite: .85 }[R.focus] ?? .5;
  let sx = (vw - sw) * fx, sy = (vh - sh) / 2;
  const z = zoomAt(R, t), zw = sw / z, zh = sh / z;
  sx += (sw - zw) / 2; sy += (sh - zh) / 2;
  return [sx, sy, zw, zh];
}
const hasVideo = v => v && v.readyState >= 2 && v.videoWidth;
function veil(ctx, a = 1) {
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, `rgba(14,13,12,${.9 * a})`); v.addColorStop(.3, `rgba(14,13,12,${.7 * a})`); v.addColorStop(.6, `rgba(14,13,12,${.64 * a})`); v.addColorStop(1, `rgba(14,13,12,${.92 * a})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// Fond : ton rush recadré en 9:16 avec mouvement, ou un dégradé si pas de rush.
export function drawBackground(ctx, R, t, video) {
  if (hasVideo(video)) ctx.drawImage(video, ...viewRect(R, t, video), 0, 0, W, H);
  else {
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#24211d'); g.addColorStop(1, '#0d0c0b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  veil(ctx);
}

// Outils pour les effets « avec la personne » : visage (coordonnées du reel) et détourage.
let OC = null;
function personTools(R, t, video, person) {
  const f = person && person.face;
  const face = f ? { cx: f.cx, cy: f.cy, w: f.w, h: f.h } : { cx: W / 2, cy: H * .38, w: 360, h: 440 };
  return {
    face, found: !!(person && person.mask),
    // Redessine la personne (détourée) par-dessus ce qui vient d'être dessiné.
    cutout(ctx, { veil: va = 1 } = {}) {
      if (!hasVideo(video) || !person || !person.mask) return;
      OC = OC || Object.assign(document.createElement('canvas'), { width: W, height: H });
      const o = OC.getContext('2d'); o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, W, H);
      o.drawImage(video, ...viewRect(R, t, video), 0, 0, W, H);
      if (va > 0) { o.globalCompositeOperation = 'source-atop'; veil(o, va * .75); }
      o.globalCompositeOperation = 'destination-in'; o.imageSmoothingEnabled = true; o.drawImage(person.mask, 0, 0, W, H);
      o.globalCompositeOperation = 'source-over';
      ctx.drawImage(OC, 0, 0);
    },
    // Redessine tout le rush zoomé autour d'un point (zoom sur le visage).
    redraw(ctx, z, cx, cy) {
      if (!hasVideo(video)) return;
      const [sx, sy, sw, sh] = viewRect(R, t, video), k = sw / W;
      const zw = sw / z, zh = sh / z, px = sx + cx * k - zw * (cx / W), py = sy + cy * k - zh * (cy / H);
      ctx.drawImage(video, px, py, zw, zh, 0, 0, W, H); veil(ctx, .8);
    },
  };
}

export function drawFrame(ctx, R, t, video, person) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  drawBackground(ctx, R, t, video);
  R.scenes.forEach((s, i) => {
    const lt = t - s.start, du = s.end - s.start;
    if (lt < 0 || lt >= du) return;
    const last = i === R.scenes.length - 1, pi = ease(cl(lt / .4)), po = last ? 0 : cl((lt - (du - .3)) / .3);
    ctx.save(); ctx.globalAlpha = Math.min(cl(lt / .15), 1 - po);
    if (R.transition === 'glisse') ctx.translate(0, (1 - pi) * 160 - po * po * 160);
    else if (R.transition === 'zoom') { const z = 1.18 - .18 * pi + po * po * .35; ctx.translate(W / 2, H * .45); ctx.scale(z, z); ctx.translate(-W / 2, -H * .45); }
    s.draw(ctx, lt, personTools(R, t, video, person));
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
