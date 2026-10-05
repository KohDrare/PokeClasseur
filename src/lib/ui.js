import { img } from "../data/tcgdex.js";
import { $, esc } from "./core.js";

/* ---------- ui helpers ---------- */
export function toast(msg) {
  document.querySelectorAll(".toast").forEach(x => x.remove());
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}
export const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" }) : "";
export const numLabel = (c, info) => /^\d+$/.test(c.n) && info.official ? `${c.n}/${String(info.official).padStart(c.n.length, "0")}` : c.n;
export function imgTag(c, q, cls = "") {
  return c.img ? `<img class="${cls}" src="${img(c.img, q)}" alt="${esc(c.name)}" loading="lazy" decoding="async" onerror="cardImgErr(this)">`
    : `<div class="fallback">${esc(c.name)}</div>`;
}
export function setNav(which) { $("#nav-series").classList.toggle("on", which === "series"); $("#nav-col").classList.toggle("on", which === "col"); $("#nav-dex").classList.toggle("on", which === "dex"); $("#nav-union").classList.toggle("on", which === "union"); }
