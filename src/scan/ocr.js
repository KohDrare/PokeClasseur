/* Card scanner, reading part: camera frame → cleaned-up images of the card's bottom strip → text.
   Tesseract runs in the browser (files copied to public/ocr by scripts/copy-ocr.mjs). */

const BASE = import.meta.env.BASE_URL + "ocr/";
let workerP = null;

export function getReader() {
  workerP ||= (async () => {
    const { createWorker, PSM } = await import("tesseract.js");
    const w = await createWorker("eng", 1, { workerPath: BASE + "worker.min.js", corePath: BASE, langPath: BASE.replace(/\/$/, ""), workerBlobURL: false });
    await w.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/ ", tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    return w;
  })().catch(e => { workerP = null; throw e; });
  return workerP;
}

/* where the card sits in the camera image: the on-screen frame, mapped from the displayed video to its real pixels */
export function frameInVideo(video, frameEl) {
  const vr = video.getBoundingClientRect(), fr = frameEl.getBoundingClientRect();
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.max(vr.width / vw, vr.height / vh);   // the video is shown with object-fit: cover
  const ox = (vr.width - vw * scale) / 2, oy = (vr.height - vh * scale) / 2;
  return { x: (fr.left - vr.left - ox) / scale, y: (fr.top - vr.top - oy) / scale, w: fr.width / scale, h: fr.height / scale };
}

/* bottom strip of the card, full width: recent cards print code and number on the left,
   older ones (« 98/99 ») on the right; a bit taller than needed to forgive the framing */
export function stripCanvas(src, r, width = 1500) {
  const sx = r.x, sy = r.y + r.h * 0.86, sw = r.w, sh = r.h * 0.135;
  const c = document.createElement("canvas");
  c.width = width; c.height = Math.round(width * sh / sw);
  const g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingQuality = "high";
  g.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

const gray = (c) => {
  const g = c.getContext("2d", { willReadFrequently: true }), d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  const out = new Float32Array(c.width * c.height);
  for (let i = 0, j = 0; i < p.length; i += 4, j++) out[j] = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114;
  return out;
};
function stretch(v, cut = 0.01) {
  const s = Float32Array.from(v).sort(), lo = s[Math.floor(s.length * cut)], hi = s[Math.floor(s.length * (1 - cut)) - 1];
  const k = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < v.length; i++) v[i] = Math.max(0, Math.min(255, (v[i] - lo) * k));
  return v;
}
function boxBlur(v, w, h, r) {   // mean over a (2r+1)² square, with an integral image
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += v[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    out[y * w + x] = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
  }
  return out;
}
const toCanvas = (v, w, h) => {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"), d = g.createImageData(w, h);
  for (let i = 0; i < v.length; i++) { const x = v[i]; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = x; d.data[i * 4 + 3] = 255; }
  g.putImageData(d, 0, 0); return c;
};

/* two clean-ups that fail on different cards: sharpened contrast, and "flattened" (background lighting removed) */
export function variants(strip) {
  const w = strip.width, h = strip.height, v = gray(strip);
  const soft = boxBlur(v, w, h, 2), a = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) a[i] = v[i] + 1.6 * (v[i] - soft[i]);   // unsharp mask
  const bg = boxBlur(v, w, h, 18), b = new Float32Array(v.length);
  for (let i = 0; i < v.length; i++) b[i] = 128 + (v[i] - bg[i]);           // dark text on any background
  return [toCanvas(stretch(a), w, h), toCanvas(stretch(b), w, h)];
}

/* reads one camera frame; returns the text of both clean-ups, joined */
export async function readFrame(src, rect) {
  const w = await getReader();
  const texts = [];
  for (const c of variants(stripCanvas(src, rect))) texts.push((await w.recognize(c)).data.text);
  return texts.join("\n");
}
