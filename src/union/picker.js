import { getJSON, peekSet } from "../data/tcgdex.js";
import { eur } from "../features/variants.js";
import { $, API, ICON, esc } from "../lib/core.js";
import { LS } from "../lib/storage.js";
import { S } from "../state/shared.js";
import { UI, unCardImg, unCardRefFromLocal, unSetOf } from "./store.js";

/* ---------- card picker (search TCGdex or pick from my collection) ---------- */
export async function unMyCards() {
  const out = [];
  const bySet = {};
  for (const [id, e] of Object.entries(S.COL.cards)) if (Object.values(e.v || {}).some(n => n > 0)) (bySet[e.s] ||= []).push(id);
  for (const [sid, ids] of Object.entries(bySet)) {
    const s = await peekSet(sid); if (!s) continue;
    const m = new Map(s.cards.map(c => [c.id, c]));
    for (const id of ids) { const c = m.get(id); if (c) out.push(unCardRefFromLocal(c, s.info.name)); }
  }
  return out.sort((a, b) => (b.p || 0) - (a.p || 0));
}
export function unPickCards(opts, done) {
  const { multi = true, title = "Ajouter des cartes", only = null } = opts || {};
  const root = $("#modal-root"); let tab = only || "mine", picked = [], q = "", results = [], mine = null, timer = null, busy = false;
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; };
  document.body.style.overflow = "hidden";
  const draw = () => {
    const list = tab === "mine" ? (mine || []).filter(c => !q || c.name.toLowerCase().includes(q.toLowerCase())) : results;
    root.innerHTML = `<div class="modal" id="mdl"><div class="sheet pickersheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
      <div class="info"><h2>${esc(title)}</h2>
      ${only ? "" : `<div class="seg" id="pk-tab" style="margin:12px 0"><button data-t="mine" class="${tab === "mine" ? "on" : ""}">Ma collection</button><button data-t="all" class="${tab === "all" ? "on" : ""}">Toutes les cartes</button></div>`}
      <label class="search" for="pk-q" style="margin-top:${only ? 12 : 0}px">${ICON.search}<input id="pk-q" placeholder="${tab === "mine" ? "Filtrer mes cartes" : "Nom de la carte, ex. Dracaufeu"}" value="${esc(q)}" autocomplete="off"></label>
      <div class="pkgrid" id="pk-list">${busy ? `<div class="empty-state" style="grid-column:1/-1;padding:30px 0"><b>Recherche…</b></div>` : list.length ? list.slice(0, 80).map((c, i) => `<button class="pk ${picked.some(p => p.id === c.id) ? "on" : ""}" data-i="${i}">${unCardImg(c)}<span>${esc(c.name)}</span><small>${esc(c.set || "")}${c.p ? " · " + eur(c.p) : ""}</small><i>${UI.check}</i></button>`).join("")
        : `<div class="empty-state" style="grid-column:1/-1;padding:30px 0"><b>${tab === "mine" ? (mine === null ? "Chargement…" : "Aucune carte") : q.length < 2 ? "Tape au moins 2 lettres" : "Aucun résultat"}</b>${tab === "mine" && mine && !mine.length ? "Coche des cartes dans tes extensions pour les retrouver ici." : ""}</div>`}</div>
      <div class="pkfoot"><span class="note">${picked.length ? `${picked.length} carte${picked.length > 1 ? "s" : ""} choisie${picked.length > 1 ? "s" : ""}` : multi ? "Choisis une ou plusieurs cartes" : "Choisis une carte"}</span><button class="pill" id="pk-ok" ${picked.length ? "" : "disabled"}>Valider</button></div>
      </div></div></div>`;
    $("#m-close").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
    const t = $("#pk-tab"); if (t) t.onclick = e => { const b = e.target.closest("button"); if (!b) return; tab = b.dataset.t; draw(); };
    const inp = $("#pk-q"); inp.focus(); inp.setSelectionRange(q.length, q.length);
    inp.oninput = e => { q = e.target.value; if (tab === "mine") { draw(); return; } clearTimeout(timer); timer = setTimeout(search, 350); };
    $("#pk-list").onclick = async e => {
      const b = e.target.closest(".pk"); if (!b) return;
      const c = list[+b.dataset.i];
      if (picked.some(p => p.id === c.id)) picked = picked.filter(p => p.id !== c.id);
      else { if (!multi) picked = []; picked.push(c); }
      draw();
    };
    $("#pk-ok").onclick = async () => {
      $("#pk-ok").disabled = true;
      const full = await Promise.all(picked.map(async c => {
        if (c.set && c.set !== unSetOf(c.id)) return c;
        try { const d = await getJSON(`${API}/cards/${encodeURIComponent(c.id)}`); const p = d.pricing?.cardmarket || {}; return { id: d.id, name: d.name, img: d.image || "", set: d.set?.name || "", n: d.localId, r: d.rarity || "", p: p.trend || p.avg || 0, dx: d.dexId || [] }; } catch { return c; }
      }));
      close(); done(full);
    };
  };
  const search = async () => {
    if (q.trim().length < 2) { results = []; draw(); return; }
    busy = true; draw();
    try {
      const r = (await getJSON(`${API}/cards?name=${encodeURIComponent(q.trim())}`)) || [];
      const meta = LS.get("pc-setmeta", {});
      results = r.filter(c => c.image).map(c => ({ id: c.id, name: c.name, img: c.image, set: unSetOf(c.id), n: c.localId, p: 0 }))
        .sort((a, b) => (meta[unSetOf(b.id)]?.d || "").localeCompare(meta[unSetOf(a.id)]?.d || ""));
    } catch { results = []; }
    busy = false; draw();
  };
  draw();
  unMyCards().then(m => { mine = m; if (tab === "mine") draw(); });
}
