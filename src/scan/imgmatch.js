/* Card scanner, picture part: recognises the card by its whole picture instead of the tiny printed number.
   Each card of an extension gets a "print" (a very small grey picture + a few colours); the camera image is
   compared with every print of the extensions in play. A few milliseconds per frame, and it works on full arts,
   shiny or blurry cards where the text reader struggles. */
import { img, loadSet } from "../data/tcgdex.js";
import { idb } from "../lib/storage.js";

const GW = 18, GH = 25, CW = 6, CH = 8, V = 2;   // V: version of the print format (cache key)
const mem = new Map();                            // setId → Promise<[{ id, n, g, c }]>

/* print of a card picture (canvas or image, already cut to the card) */
function printOf(src, sx = 0, sy = 0, sw = src.width, sh = src.height) {
  // a small margin inside the card: borders and sleeves differ more than the picture
  const mx = sw * 0.05, my = sh * 0.04;
  const can = document.createElement("canvas"), g = can.getContext("2d", { willReadFrequently: true });
  can.width = GW; can.height = GH;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, sx + mx, sy + my, sw - 2 * mx, sh - 2 * my, 0, 0, GW, GH);
  const p = g.getImageData(0, 0, GW, GH).data;
  const gray = new Float32Array(GW * GH);
  let m = 0;
  for (let i = 0; i < gray.length; i++) { gray[i] = p[i * 4] * 0.299 + p[i * 4 + 1] * 0.587 + p[i * 4 + 2] * 0.114; m += gray[i]; }
  m /= gray.length;
  let sd = 0; for (const x of gray) sd += (x - m) ** 2; sd = Math.sqrt(sd / gray.length) || 1;
  for (let i = 0; i < gray.length; i++) gray[i] = (gray[i] - m) / sd;          // same light or not: only shapes count
  can.width = CW; can.height = CH;
  g.drawImage(src, sx + mx, sy + my, sw - 2 * mx, sh - 2 * my, 0, 0, CW, CH);
  const q = g.getImageData(0, 0, CW, CH).data, col = new Float32Array(CW * CH * 3), avg = [0, 0, 0];
  for (let i = 0; i < CW * CH; i++) for (let k = 0; k < 3; k++) { col[i * 3 + k] = q[i * 4 + k]; avg[k] += q[i * 4 + k] / (CW * CH); }
  for (let i = 0; i < CW * CH; i++) for (let k = 0; k < 3; k++) col[i * 3 + k] /= (avg[k] || 1);   // white balance
  return { g: gray, c: col };
}
const dist = (a, b) => {
  let dot = 0; for (let i = 0; i < a.g.length; i++) dot += a.g[i] * b.g[i];
  let dc = 0; for (let i = 0; i < a.c.length; i++) dc += Math.abs(a.c[i] - b.c[i]);
  return 1 - dot / a.g.length + 0.5 * dc / a.c.length;
};

const loadImg = src => new Promise((ok, ko) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = ko; im.src = src; });
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }

/* prints of every card of an extension: made once (a few seconds), then kept on this device */
export function setPrints(setId, onProgress) {
  if (mem.has(setId)) return mem.get(setId);
  const p = (async () => {
    const key = `prints${V}:${setId}`;
    const cached = await idb.get(key);
    if (cached?.length) return cached.map(x => ({ ...x, g: new Float32Array(x.g), c: new Float32Array(x.c) }));
    const s = await loadSet(setId);
    const cards = s.cards.filter(c => c.img && !c.linked);
    let done = 0;
    const prints = (await pool(cards, 8, async c => {
      try { const im = await loadImg(img(c.img, "low")); return { id: c.id, n: c.n, ...printOf(im) }; }
      catch { return null; } finally { onProgress?.(++done, cards.length); }
    })).filter(Boolean);
    if (prints.length) await idb.set(key, prints.map(x => ({ id: x.id, n: x.n, g: [...x.g].map(v => Math.round(v * 100) / 100), c: [...x.c].map(v => Math.round(v * 100) / 100) })));
    return prints;
  })().catch(e => { mem.delete(setId); throw e; });
  mem.set(setId, p);
  return p;
}
export const printsReady = setId => mem.has(setId);

/* compares the card inside the frame with the prints; returns { setId, id, n, d, gap } of the best match */
export function matchFrame(video, rect, sets) {
  const tries = [printOf(video, rect.x, rect.y, rect.w, rect.h)];
  // the card may sit a little inside the frame
  const k = 0.06; tries.push(printOf(video, rect.x + rect.w * k / 2, rect.y + rect.h * k / 2, rect.w * (1 - k), rect.h * (1 - k)));
  let best = null, second = Infinity;
  for (const { setId, prints } of sets) for (const p of prints) {
    const d = Math.min(...tries.map(t => dist(t, p)));
    if (!best || d < best.d) { if (best) second = Math.min(second, best.d); best = { setId, id: p.id, n: p.n, d }; }
    else if (d < second) second = d;
  }
  if (best) best.gap = second - best.d;
  return best;
}
