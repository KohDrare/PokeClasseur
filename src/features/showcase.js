/* "Ma vitrine": the (up to) 12 cards shown at the top of my public profile.
   Tap a card of my collection to add or remove it; in the strip above, move them or take them out. */
import { $, ICON, esc } from "../lib/core.js";
import { toast } from "../lib/ui.js";
import { cloud } from "../cloud/session.js";
import { saveMyProfile } from "../cloud/profiles.js";
import { unCardImg, unCardRefFromLocal } from "../union/store.js";
import { loadSet, peekSet, pool } from "../data/tcgdex.js";
import { S } from "../state/shared.js";

const MAX = 12;
/* my cards (an extension never opened on this device is downloaded), most valuable first */
async function myCards() {
  const bySet = {};
  for (const [id, e] of Object.entries(S.COL.cards)) if (Object.values(e.v || {}).some(n => n > 0)) (bySet[e.s] ||= []).push(id);
  const out = [];
  await pool(Object.keys(bySet), 3, async sid => {
    const s = (await peekSet(sid).catch(() => null)) || (await loadSet(sid).catch(() => null)); if (!s) return;
    const m = new Map(s.cards.map(c => [c.id, c]));
    for (const id of bySet[sid]) { const c = m.get(id); if (c) out.push(unCardRefFromLocal(c, s.info.name)); }
  });
  return out.sort((a, b) => (b.p || 0) - (a.p || 0));
}
export function openShowcaseEditor() {
  const cur = Array.isArray(cloud.profile?.showcase) ? cloud.profile.showcase : [];
  let picked = cur.map(c => ({ ...c })), mine = null, q = "";
  const root = $("#modal-root");
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", key); document.body.style.overflow = "hidden";
  root.innerHTML = `<div class="modal" id="mdl"><div class="sheet beditor scedit" role="dialog" aria-modal="true" aria-label="Ma vitrine">
    <button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
    <h2>Ma vitrine</h2>
    <p class="note">Jusqu'à ${MAX} cartes, en haut de ton profil. Touche une carte pour l'ajouter ou la retirer.</p>
    <div class="be-lbl">Dans l'ordre <em id="sc-n"></em></div>
    <div class="sc-strip" id="sc-strip"></div>
    <label class="search" for="sc-q">${ICON.search}<input id="sc-q" placeholder="Rechercher dans ma collection" autocomplete="off"></label>
    <div class="be-grid" id="sc-grid"></div>
    <div class="be-foot"><button class="linkbtn be-del" id="sc-none">Tout retirer</button><button class="pill" id="sc-save">Enregistrer</button></div>
  </div></div>`;
  const strip = () => {
    $("#sc-n").textContent = `${picked.length}/${MAX}`;
    $("#sc-none").disabled = !picked.length;
    $("#sc-strip").innerHTML = picked.length ? picked.map((c, i) => `<div class="sc-it">${unCardImg(c)}<span class="be-k">${i + 1}</span>
        <button class="sc-x" data-x="${i}" aria-label="Retirer ${esc(c.name)}">${ICON.x}</button>
        <div class="sc-mv"><button data-l="${i}" ${i ? "" : "disabled"} aria-label="Plus tôt">‹</button><button data-r="${i}" ${i < picked.length - 1 ? "" : "disabled"} aria-label="Plus tard">›</button></div></div>`).join("")
      : `<p class="note sc-empty">Aucune carte : choisis-les ci-dessous.</p>`;
  };
  const grid = () => {
    if (!mine) { $("#sc-grid").innerHTML = `<p class="note">Chargement de ta collection…</p>`; return; }
    const t = q.trim().toLowerCase();
    const list = t ? mine.filter(c => c.name.toLowerCase().includes(t) || (c.set || "").toLowerCase().includes(t)) : mine;
    $("#sc-grid").innerHTML = list.length ? list.slice(0, 300).map(c => { const k = picked.findIndex(p => p.id === c.id);
      return `<button class="be-card ${k >= 0 ? "on" : ""}" data-id="${esc(c.id)}" aria-pressed="${k >= 0}">${unCardImg(c)}${k >= 0 ? `<span class="be-k">${k + 1}</span>` : ""}</button>`; }).join("")
      : `<p class="note">Aucune carte.</p>`;
  };
  const draw = () => { strip(); grid(); };
  $("#sc-grid").onclick = e => {
    const b = e.target.closest("[data-id]"); if (!b) return;
    const k = picked.findIndex(p => p.id === b.dataset.id);
    if (k >= 0) picked.splice(k, 1);
    else if (picked.length >= MAX) { toast(`${MAX} cartes maximum : retires-en une d'abord`); return; }
    else picked.push(mine.find(c => c.id === b.dataset.id));
    draw();
  };
  $("#sc-strip").onclick = e => {
    const x = e.target.closest("[data-x]"), l = e.target.closest("[data-l]"), r = e.target.closest("[data-r]");
    if (x) picked.splice(+x.dataset.x, 1);
    else if (l) { const i = +l.dataset.l; [picked[i - 1], picked[i]] = [picked[i], picked[i - 1]]; }
    else if (r) { const i = +r.dataset.r; [picked[i + 1], picked[i]] = [picked[i], picked[i + 1]]; }
    else return;
    draw();
  };
  $("#sc-q").oninput = e => { q = e.target.value; grid(); };
  $("#sc-none").onclick = () => { picked = []; draw(); };
  $("#m-close").onclick = close;
  $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
  $("#sc-save").onclick = async () => {
    const b = $("#sc-save"); b.disabled = true;
    const next = picked.map(c => ({ id: c.id, name: c.name, img: c.img || "", set: c.set || "", n: c.n || "", r: c.r || "", p: c.p || 0 }));
    try { await saveMyProfile({ showcase: next }); close(); toast("Vitrine mise à jour"); }
    catch (x) { toast(x.message || "Impossible pour le moment"); b.disabled = false; }
  };
  draw();
  myCards().then(m => { mine = m; grid(); }).catch(() => { mine = []; grid(); });
}
