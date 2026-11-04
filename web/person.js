// Pixel Studio · repérage de la personne filmée (détourage + visage), entièrement dans le navigateur.
// Utilise MediaPipe Tasks Vision (Google, licence Apache 2.0). Les modèles (~1 Mo) se téléchargent
// la première fois ; ta vidéo, elle, n'est jamais envoyée : tout est calculé sur ton appareil.

const V = '0.10.21';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${V}`;
const MODELS = {
  seg: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
  face: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
};
const SW = 288, SH = 512, W = 1080, H = 1920; // analyse en basse définition, au format 9:16

let seg = null, fd = null, loading = null, ts = 0, last = null;
let sc, sx, mk, mx;

export const personReady = () => !!seg;

export function loadPerson() {
  if (seg) return Promise.resolve(true);
  if (loading) return loading;
  loading = (async () => {
    const m = await import(`${CDN}/vision_bundle.mjs`);
    const files = await m.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    const make = async delegate => {
      seg = await m.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: MODELS.seg, delegate }, runningMode: 'VIDEO', outputConfidenceMasks: true, outputCategoryMask: false });
      fd = await m.FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODELS.face, delegate }, runningMode: 'VIDEO', minDetectionConfidence: .4 });
    };
    try { await make('GPU'); } catch { seg = fd = null; await make('CPU'); }
    return true;
  })().catch(e => { loading = null; seg = fd = null; throw e; });
  return loading;
}

// rect = zone du rush affichée dans le reel (viewRect du moteur). Renvoie { mask, face } en coordonnées du reel.
export function analyzePerson(video, rect, smooth = .55) {
  if (!seg || !video || !video.videoWidth) return null;
  sc = sc || Object.assign(document.createElement('canvas'), { width: SW, height: SH });
  sx = sx || sc.getContext('2d', { willReadFrequently: true });
  sx.drawImage(video, ...rect, 0, 0, SW, SH);
  ts = Math.max(ts + 1, Math.floor(performance.now()));

  const r = seg.segmentForVideo(sc, ts);
  const masks = r.confidenceMasks || [], m = masks[masks.length > 1 ? 1 : 0];
  mk = mk || Object.assign(document.createElement('canvas'), { width: SW, height: SH });
  mx = mx || mk.getContext('2d');
  if (m) {
    const arr = m.getAsFloat32Array(), id = mx.createImageData(SW, SH);
    for (let i = 0; i < arr.length; i++) id.data[i * 4 + 3] = Math.max(0, Math.min(1, (arr[i] - .3) / .4)) * 255;
    mx.putImageData(id, 0, 0);
  }
  if (r.close) r.close();

  let face = null;
  const d = fd.detectForVideo(sc, ts).detections || [];
  if (d.length) {
    const sc0 = x => (x.categories && x.categories[0] ? x.categories[0].score : 0);
    const ok = d.filter(x => x.boundingBox.width < SW * .7); // écarte les fausses détections géantes
    const best = (ok.length ? ok : d).sort((p, q) => sc0(q) - sc0(p))[0], b = best.boundingBox;
    const k = W / SW;
    face = { cx: (b.originX + b.width / 2) * k, cy: (b.originY + b.height / 2) * k, w: b.width * k, h: b.height * k };
  }
  // Lissage pour que le viseur et le zoom ne tremblent pas
  if (face && last) for (const key of ['cx', 'cy', 'w', 'h']) face[key] = last[key] + (face[key] - last[key]) * smooth;
  if (face) last = face; else face = last;
  return { mask: m ? mk : null, face };
}

export function resetPerson() { last = null; }
