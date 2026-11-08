/* Card scanner, picture part: recognises the card by its whole picture instead of the tiny printed number.
   Each card of an extension gets a "print" (a very small grey picture + a few colours); the camera image is
   compared with every print of the extensions in play. A few milliseconds per frame, and it works on full arts,
   shiny or blurry cards where the text reader struggles. */
import { img, loadSet } from "../data/tcgdex.js";
import { idb } from "../lib/storage.js";

const GW = 18, GH = 25, CW = 6, CH = 8, V = 3;
// the artwork window of a card: never foil on a reverse, so it still matches when the rest sparkles
const ART = { x: 0.08, y: 0.11, w: 0.84, h: 0.42 };
const artOf = (sx, sy, sw, sh) => [sx + sw * ART.x, sy + sh * ART.y, sw * ART.w, sh * ART.h];   // V: version of the print format (cache key)
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
/* print of the camera picture, ignoring the reflections of a shiny card: pixels that are almost white and
   colourless (the lamp seen in the foil) are left out, and a cell mostly covered by them is not compared */
export const OPT = { glare: 215, sat: 0.22, cover: 0.35, cw: 0.5, art: 0.02 };
const FX = 3;                                      // fine pixels per print cell, each way
function camPrint(src, sx, sy, sw, sh) {
  const mx = sw * 0.05, my = sh * 0.04, FW = GW * FX, FH = GH * FX;
  const can = document.createElement("canvas"), g = can.getContext("2d", { willReadFrequently: true });
  can.width = FW; can.height = FH;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, sx + mx, sy + my, sw - 2 * mx, sh - 2 * my, 0, 0, FW, FH);
  const p = g.getImageData(0, 0, FW, FH).data;
  const gs = new Float32Array(GW * GH), gn = new Float32Array(GW * GH), gt = new Float32Array(GW * GH);
  const cs = new Float32Array(CW * CH * 3), cn = new Float32Array(CW * CH), ct = new Float32Array(CW * CH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const i = (y * FW + x) * 4, r = p[i], gg = p[i + 1], b = p[i + 2];
    const v = Math.max(r, gg, b), sat = v ? (v - Math.min(r, gg, b)) / v : 0;
    const glare = v >= OPT.glare && sat < OPT.sat;
    const k = ((y / FX) | 0) * GW + ((x / FX) | 0), kc = ((y * CH / FH) | 0) * CW + ((x * CW / FW) | 0);
    gt[k]++; ct[kc]++;
    if (glare) continue;
    gs[k] += r * 0.299 + gg * 0.587 + b * 0.114; gn[k]++;
    cs[kc * 3] += r; cs[kc * 3 + 1] += gg; cs[kc * 3 + 2] += b; cn[kc]++;
  }
  const gm = new Uint8Array(GW * GH), cm = new Uint8Array(CW * CH);
  for (let k = 0; k < gs.length; k++) if (gn[k] > gt[k] * (1 - OPT.cover)) { gm[k] = 1; gs[k] /= gn[k]; }
  for (let k = 0; k < cm.length; k++) if (cn[k] > ct[k] * (1 - OPT.cover)) { cm[k] = 1; for (let j = 0; j < 3; j++) cs[k * 3 + j] /= cn[k]; }
  return { g: gs, gm, c: cs, cm, glare: 1 - gm.reduce((s, x) => s + x, 0) / gm.length };
}
/* distance between the camera print and a card print, over the cells both can be trusted on */
const dist = (a, b) => {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < a.g.length; i++) if (a.gm[i]) { const x = a.g[i], y = b.g[i]; n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; }
  if (n < a.g.length * 0.4) return 9;
  const va = saa - sa * sa / n, vb = sbb - sb * sb / n;
  const r = (sab - sa * sb / n) / (Math.sqrt(va * vb) || 1);
  // colours: white balance of both on the same cells, then the mean difference
  const ma = [0, 0, 0], mb = [0, 0, 0]; let nc = 0;
  for (let i = 0; i < a.cm.length; i++) if (a.cm[i]) { nc++; for (let j = 0; j < 3; j++) { ma[j] += a.c[i * 3 + j]; mb[j] += b.c[i * 3 + j]; } }
  let dc = 0;
  if (nc) for (let i = 0; i < a.cm.length; i++) if (a.cm[i]) for (let j = 0; j < 3; j++) dc += Math.abs(a.c[i * 3 + j] * nc / (ma[j] || 1) - b.c[i * 3 + j] * nc / (mb[j] || 1));
  return 1 - r + OPT.cw * (nc ? dc / (nc * 3) : 0.3);
};

const loadImg = src => new Promise((ok, ko) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => ok(im); im.onerror = ko; im.src = src; });
async function pool(items, n, fn) { const out = new Array(items.length); let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } })); return out; }

/* prints of every card of an extension: made once (a few seconds), then kept on this device */
export function setPrints(setId, onProgress) {
  if (mem.has(setId)) return mem.get(setId);
  const p = (async () => {
    const key = `prints${V}:${setId}`;
    const cached = await idb.get(key);
    if (cached?.length) return cached.map(x => ({ id: x.id, n: x.n, g: new Float32Array(x.g), c: new Float32Array(x.c), a: { g: new Float32Array(x.ag), c: new Float32Array(x.ac) } }));
    const s = await loadSet(setId);
    const cards = s.cards.filter(c => c.img && !c.linked);
    let done = 0;
    const prints = (await pool(cards, 8, async c => {
      try { const im = await loadImg(img(c.img, "low")); return { id: c.id, n: c.n, ...printOf(im), a: printOf(im, ...artOf(0, 0, im.width, im.height)) }; }
      catch { return null; } finally { onProgress?.(++done, cards.length); }
    })).filter(Boolean);
    const r2 = a => [...a].map(v => Math.round(v * 100) / 100);
    if (prints.length) await idb.set(key, prints.map(x => ({ id: x.id, n: x.n, g: r2(x.g), c: r2(x.c), ag: r2(x.a.g), ac: r2(x.a.c) })));
    return prints;
  })().catch(e => { mem.delete(setId); throw e; });
  mem.set(setId, p);
  return p;
}
export const printsReady = setId => mem.has(setId);

/* compares the card inside the frame with the prints; returns { setId, id, n, d, gap } of the best match */
export function matchFrame(video, rect, sets) {
  // the card may sit a little inside the frame
  const k = 0.06, crops = [[rect.x, rect.y, rect.w, rect.h], [rect.x + rect.w * k / 2, rect.y + rect.h * k / 2, rect.w * (1 - k), rect.h * (1 - k)]];
  const tries = crops.map(r => camPrint(video, ...r)), arts = crops.map(r => camPrint(video, ...artOf(...r)));
  let best = null, second = Infinity;
  for (const { setId, prints } of sets) for (const p of prints) {
    // whole card, or the artwork alone (a reverse: the foil around it changes everything else)
    const d = Math.min(...tries.map(t => dist(t, p)), ...(p.a ? arts.map(t => dist(t, p.a) + OPT.art) : []));
    if (!best || d < best.d) { if (best) second = Math.min(second, best.d); best = { setId, id: p.id, n: p.n, d }; }
    else if (d < second) second = d;
  }
  if (best) { best.gap = second - best.d; best.glare = tries[0].glare; }
  return best;
}
