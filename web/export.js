// Pixel Studio · export MP4 dans le navigateur (WebCodecs + mp4-muxer). Rien n'est envoyé sur un serveur.
import { Muxer, ArrayBufferTarget } from './vendor/mp4-muxer.mjs';
import { W, H, FPS, build, drawFrame, sourceTime } from './engine.js';

const CODECS = [
  ['avc1.640028', 'avc'], ['avc1.4d0028', 'avc'], ['avc1.42e028', 'avc'], // H.264 : lu partout, accepté par Instagram et TikTok
  ['vp09.00.40.08', 'vp9'], ['av01.0.08M.08', 'av1'],                     // repli si le navigateur n'a pas d'encodeur H.264
];

export async function pickCodec() {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const [codec, mux] of CODECS) {
    try {
      const cfg = { codec, width: W, height: H, bitrate: 10e6, framerate: FPS, ...(mux === 'avc' ? { avc: { format: 'avc' } } : {}) };
      if ((await VideoEncoder.isConfigSupported(cfg)).supported) return { cfg, mux };
    } catch { /* codec suivant */ }
  }
  return null;
}

function seek(video, t) {
  return new Promise(res => {
    if (Math.abs(video.currentTime - t) < 1e-3) return res();
    const done = () => { video.removeEventListener('seeked', done); clearTimeout(to); res(); };
    const to = setTimeout(done, 4000);
    video.addEventListener('seeked', done);
    video.currentTime = t;
  });
}

// Lit le rush en continu (au bon ralenti) et capture chaque image au moment où elle s'affiche.
// Bien plus rapide que de sauter d'image en image : l'export dure à peu près la durée du reel.
async function captureByPlayback(R, video, n, emit, drain, check, queued) {
  const slow = video.duration < R.duration ? (R.duration / video.duration) * 1.02 : 1;
  video.pause(); video.muted = true;
  await seek(video, 0);
  video.playbackRate = Math.max(.0625, 1 / slow);
  let next = 0, done = false;
  await new Promise((resolve, reject) => {
    const end = err => { if (done) return; done = true; video.pause(); video.onended = null; err ? reject(err) : resolve(); };
    const finish = async () => { try { while (next < n) { check(); emit(next++); if (queued() > 6) await drain(); } end(); } catch (e) { end(e); } };
    const onFrame = async (_, meta) => {
      if (done) return;
      try {
        check();
        const t = meta.mediaTime * slow;
        while (next < n && next / FPS <= t + 1e-3) emit(next++);
        if (next >= n) return end();
        if (queued() > 6) { video.pause(); await drain(); check(); await video.play(); }
      } catch (e) { return end(e); }
      if (video.ended) return finish();
      video.requestVideoFrameCallback(onFrame);
    };
    video.onended = () => finish();
    video.requestVideoFrameCallback(onFrame);
    video.play().catch(end);
  });
}

// job : réglages + écrans. video : <video> du rush (ou null). onProgress(0..1). signal : AbortSignal.
export async function exportMp4(job, video, onProgress = () => {}, signal) {
  const codec = await pickCodec();
  if (!codec) throw new Error("Ton navigateur ne sait pas encoder la vidéo. Utilise Chrome, Edge ou Safari à jour.");
  const R = build(job);
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { alpha: false });
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: codec.mux, width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' });
  let failure = null;
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failure = e; } });
  encoder.configure(codec.cfg);
  const n = Math.round(R.duration * FPS);
  const emit = i => {
    const t = i / FPS;
    drawFrame(ctx, R, t, video);
    const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
    frame.close();
    if (i % 5 === 0) onProgress(i / n);
  };
  const drain = async () => { while (encoder.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4)); };
  const check = () => {
    if (signal?.aborted) throw new DOMException('Export annulé', 'AbortError');
    if (failure) throw failure;
  };
  try {
    if (video && video.duration && 'requestVideoFrameCallback' in video) await captureByPlayback(R, video, n, emit, drain, check, () => encoder.encodeQueueSize);
    else if (video && video.duration) for (let i = 0; i < n; i++) { check(); await seek(video, sourceTime(R, i / FPS, video)); emit(i); await drain(); }
    else for (let i = 0; i < n; i++) { check(); emit(i); await drain(); }
    await encoder.flush();
  } finally {
    if (video) { video.pause(); video.playbackRate = 1; }
    if (encoder.state !== 'closed') encoder.close();
  }
  if (failure) throw failure;
  muxer.finalize();
  onProgress(1);
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), codec: codec.mux, duration: R.duration };
}

// Couverture : l'image de l'accroche, en PNG.
export async function exportCover(job, video, at = 1.8) {
  const R = build(job);
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  if (video && video.duration) { video.pause(); await seek(video, sourceTime(R, at, video)); }
  drawFrame(canvas.getContext('2d'), R, at, video);
  return new Promise(r => canvas.toBlob(r, 'image/png'));
}
