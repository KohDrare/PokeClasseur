import { PCX } from "../data/pokecardex-map.js";
import { logoImg } from "../data/tcgdex.js";
import { eur } from "./variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { idb } from "../lib/storage.js";
import { toast } from "../lib/ui.js";
import { drawSetHead } from "../pages/set.js";
import { saveCol } from "../state/collection.js";
import { S } from "../state/shared.js";

/* ================= PRODUITS (sealed products the user owns) ================= */
export const PROD_TYPES = [
  { k: "booster", l: "Booster", shape: "pack", b: 1 },
  { k: "blister", l: "Blister", shape: "pack", b: 1 },
  { k: "duopack", l: "Duopack", shape: "box", b: 2 },
  { k: "tripack", l: "Tripack", shape: "box", b: 3 },
  { k: "etb", l: "Coffret Dresseur d'élite", shape: "box", b: 9 },
  { k: "demi", l: "Demi-boîte de boosters", shape: "box", b: 18 },
  { k: "display", l: "Boîte de boosters", shape: "box", b: 36 },
  { k: "coffret", l: "Coffret", shape: "box", b: 4 },
  { k: "carte", l: "Carte à l'unité", shape: "box", b: 0 },
  { k: "autre", l: "Autre", shape: "box", b: 0 }
];
export const ptype = k => PROD_TYPES.find(t => t.k === k) || PROD_TYPES[PROD_TYPES.length - 1];
/* product: { id, type, name, qty, opened, price (per unit), bpp (boosters per unit) } — older entries used `sealed` */
export function normProd(p) {
  if (p.opened == null) p.opened = p.sealed === false ? p.qty : 0;
  if (p.bpp == null) p.bpp = ptype(p.type).b;
  delete p.sealed;
  return p;
}
export const prodsOf = sid => ((S.COL.products ||= {})[sid] ||= []).map(normProd);
export async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 700 / Math.max(im.width, im.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k);
    cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
    return cv.toDataURL("image/jpeg", .82);
  } finally { URL.revokeObjectURL(url); }
}
export function prodVisual(p, info) {
  const t = ptype(p.type);
  const logo = logoImg(info.id, info.logo, info.name, info.serie?.id, true) || `<b>${esc(info.name)}</b>`;
  return `<div class="pvis" data-pimg="${esc(p.id)}"><div class="${t.shape === "pack" ? "gpack" : "gbox"}">${logo}<span>${esc(t.l)}</span></div></div>`;
}

/* add / edit one purchase */
export function openProductForm(info, prod, onDone) {
  const root = $("#modal-root");
  const isNew = !prod.name;
  const t0 = ptype(prod.type);
  const p = { qty: 1, opened: 0, bpp: t0.b, name: `${t0.l} ${info.name}`, ...prod };
  let photo = null, confirmDel = false;
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; document.removeEventListener("keydown", key); onDone?.(); };
  const key = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", key); document.body.style.overflow = "hidden";
  const draw = () => {
    root.innerHTML = `<div class="modal" id="mdl"><div class="sheet formsheet" role="dialog" aria-modal="true" aria-label="Achat">
      <button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
      <div class="info"><h2>${isNew ? "Ajouter un achat" : "Modifier l'achat"}</h2><p class="note">${esc(info.name)}</p>
      <div class="pgrid" style="margin-top:16px">
        <label>Type<select id="p-type">${PROD_TYPES.map(t => `<option value="${t.k}" ${t.k === p.type ? "selected" : ""}>${t.l}</option>`).join("")}</select></label>
        <label>Nom<input id="p-name" value="${esc(p.name)}" maxlength="90"></label>
        <label>Quantité achetée<input id="p-qty" type="number" inputmode="numeric" min="1" max="999" value="${p.qty}"></label>
        <label>Dont ouverts<input id="p-open" type="number" inputmode="numeric" min="0" max="999" value="${p.opened}"></label>
        <label>Prix payé par unité (€)<input id="p-price" type="number" inputmode="decimal" min="0" step="0.01" value="${p.price || ""}" placeholder="ex. 5,50"></label>
        <label>Boosters dans chaque unité<input id="p-bpp" type="number" inputmode="numeric" min="0" max="99" value="${p.bpp}"></label>
        <label class="wide">Photo (optionnelle)<input id="p-photo" type="file" accept="image/*"></label>
      </div>
      <div class="ptotal" id="p-total"></div>
      <div class="acts" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:14px">
        <button class="pill" id="p-save">${isNew ? "Ajouter" : "Enregistrer"}</button><button class="pill ghost" id="p-cancel">Annuler</button>
        ${isNew ? "" : confirmDel ? `<span class="confirm" style="padding:6px 10px">Supprimer cet achat ?<button class="pill" id="p-del-yes">Oui</button><button class="pill ghost" id="p-del-no">Non</button></span>` : `<button class="pill ghost danger" id="p-del">Supprimer</button>`}
      </div></div></div></div>`;
    const total = () => {
      const q = Math.max(1, parseInt($("#p-qty").value) || 1), pr = parseFloat(String($("#p-price").value).replace(",", ".")) || 0, b = parseInt($("#p-bpp").value) || 0;
      $("#p-total").innerHTML = `Total : <b>${pr ? eur(q * pr) : "–"}</b>${b ? ` · ${q * b} booster${q * b > 1 ? "s" : ""}${pr ? ` · ${eur(pr / b)} le booster` : ""}` : ""}`;
    };
    total();
    ["p-qty", "p-price", "p-bpp"].forEach(id => $("#" + id).oninput = total);
    $("#m-close").onclick = close; $("#p-cancel").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
    $("#p-type").onchange = e => { const old = ptype(p.type), t = ptype(e.target.value); if ($("#p-name").value === `${old.l} ${info.name}`) $("#p-name").value = `${t.l} ${info.name}`; if (+$("#p-bpp").value === old.b) $("#p-bpp").value = t.b; p.type = t.k; total(); };
    $("#p-photo").onchange = async e => { const f = e.target.files[0]; if (f) { try { photo = await shrinkPhoto(f); toast("Photo prête"); } catch { toast("Photo illisible"); } } };
    $("#p-save").onclick = async () => {
      const qty = Math.max(1, Math.min(999, parseInt($("#p-qty").value) || 1));
      const out = { id: p.id || "p" + Date.now().toString(36), type: $("#p-type").value, name: $("#p-name").value.trim() || ptype($("#p-type").value).l, qty,
        opened: Math.max(0, Math.min(qty, parseInt($("#p-open").value) || 0)), bpp: Math.max(0, parseInt($("#p-bpp").value) || 0),
        price: parseFloat(String($("#p-price").value).replace(",", ".")) || 0 };
      const arr = prodsOf(info.id); const i = arr.findIndex(x => x.id === out.id);
      if (i >= 0) arr[i] = out; else arr.push(out);
      S.COL.products[info.id] = arr;
      if (photo) await idb.set("pimg:" + out.id, photo);
      saveCol(); toast(i >= 0 ? "Achat modifié" : "Achat ajouté"); close();
    };
    const del = $("#p-del"); if (del) del.onclick = () => { confirmDel = true; draw(); };
    const yes = $("#p-del-yes"); if (yes) yes.onclick = () => { S.COL.products[info.id] = prodsOf(info.id).filter(x => x.id !== p.id); saveCol(); toast("Achat supprimé"); close(); };
    const no = $("#p-del-no"); if (no) no.onclick = () => { confirmDel = false; draw(); };
  };
  draw();
}

export function openBuyPicker(info, onDone) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal" id="mdl"><div class="sheet formsheet" role="dialog" aria-modal="true" aria-label="Type d'achat">
    <button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
    <div class="info"><h2>Qu'as-tu acheté ?</h2><p class="note">${esc(info.name)}</p>
    <div class="picks">${PROD_TYPES.map(t => `<button class="pick" data-t="${t.k}">${prodVisual({ id: "", type: t.k }, info)}<span>${t.l}</span>${t.b ? `<small>${t.b} booster${t.b > 1 ? "s" : ""}</small>` : "<small>&nbsp;</small>"}</button>`).join("")}</div></div></div></div>`;
  document.body.style.overflow = "hidden";
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; onDone?.(); };
  $("#m-close").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
  root.querySelectorAll("[data-t]").forEach(b => b.onclick = () => openProductForm(info, { type: b.dataset.t }, onDone));
}


/* purchases window opened from the "Produits" button */
export function openProducts(info) {
  const root = $("#modal-root");
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; document.removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); };
  const draw = () => {
    const list = prodsOf(info.id);
    const spent = list.reduce((a, p) => a + p.qty * (p.price || 0), 0);
    const boosters = list.reduce((a, p) => a + p.opened * p.bpp, 0);
    root.innerHTML = `<div class="modal" id="mdl"><div class="sheet prodsheet" role="dialog" aria-modal="true" aria-label="Produits">
      <button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
      <div class="info"><h2>Produits — ${esc(info.name)}</h2>
      <p class="note">${list.length ? `${eur(spent) === "–" ? "0 €" : eur(spent)} dépensés · ${boosters} booster${boosters > 1 ? "s" : ""} ouvert${boosters > 1 ? "s" : ""}` : "Note ce que tu achètes pour suivre ton argent et ton taux de hit."}</p>
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0"><button class="pill" id="pp-add">+ Ajouter un achat</button><a class="pill ghost" href="#/stats/${encodeURIComponent(info.id)}" id="pp-stats">Voir les stats</a></div>
      ${list.length ? `<div class="buys">${list.map(p => buyTile(p, info)).join("")}</div>` : ""}
      <div class="h3">Voir tous les produits de l'extension</div>
      <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap">${PCX[info.id] || info.abbr ? `<a class="pill ghost" href="https://www.pokecardex.com/series/${encodeURIComponent(PCX[info.id] || info.abbr)}" target="_blank" rel="noopener">Sur Pokécardex</a>` : ""}<a class="pill ghost" href="https://www.cardmarket.com/fr/Pokemon/Products/Search?category=-1&searchString=${encodeURIComponent(info.name)}" target="_blank" rel="noopener">Sur Cardmarket</a></div>
      </div></div></div>`;
    $("#m-close").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
    $("#pp-stats").onclick = close;
    $("#pp-add").onclick = () => openBuyPicker(info, reopen);
    root.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => openProductForm(info, list.find(p => p.id === b.dataset.edit), reopen));
    loadProdPhotos(root);
  };
  const reopen = () => { document.addEventListener("keydown", key); document.body.style.overflow = "hidden"; draw(); if (S.CUR?.data?.info?.id === info.id) drawSetHead(); };
  reopen();
}
export const buyTile = (p, info) => `<button class="buy" data-edit="${esc(p.id)}">${prodVisual(p, info)}<span class="bname">${esc(p.name)}</span><span class="bmeta">${p.qty} acheté${p.qty > 1 ? "s" : ""} · ${p.opened} ouvert${p.opened > 1 ? "s" : ""}</span><span class="bprice">${p.price ? `${eur(p.price)} pièce · <b>${eur(p.price * p.qty)}</b>` : "prix non indiqué"}</span></button>`;
export const loadProdPhotos = root => root.querySelectorAll("[data-pimg]").forEach(async el => { if (!el.dataset.pimg) return; const src = await idb.get("pimg:" + el.dataset.pimg); if (src) el.innerHTML = `<img class="pphoto" src="${src}" alt="">`; });
