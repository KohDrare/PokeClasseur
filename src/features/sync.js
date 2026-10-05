import { $, ICON } from "../lib/core.js";
import { toast } from "../lib/ui.js";
import { route } from "../router.js";
import { saveCol } from "../state/collection.js";
import { S } from "../state/shared.js";

/* ================= SYNC ================= */
export function encodeCol() { return btoa(unescape(encodeURIComponent(JSON.stringify({ app: "pokeclasseur", v: 1, ...S.COL })))); }
export function decodeCol(txt) {
  txt = txt.trim();
  let o; try { o = JSON.parse(txt); } catch { o = JSON.parse(decodeURIComponent(escape(atob(txt)))); }
  if (!o || typeof o.cards !== "object") throw new Error("format");
  return { cards: o.cards, products: o.products || {}, updated: o.updated || Date.now() };
}
export function openSync() {
  const root = $("#modal-root");
  const n = Object.keys(S.COL.cards).length;
  root.innerHTML = `<div class="modal" id="mdl"><div class="sheet syncsheet" role="dialog" aria-modal="true" aria-label="Sauvegarde">
    <button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
    <div class="info"><h2>Sauvegarde et synchro</h2>
    <p class="note">Ta collection (${n} cartes) est enregistrée dans ce navigateur. Pour la retrouver sur ton téléphone ou ton PC, copie le code ici et colle-le de l'autre côté, ou passe par un fichier.</p>
    <div class="h3">Envoyer vers un autre appareil</div>
    <div class="acts"><button class="pill" id="s-copy">Copier le code</button><button class="pill ghost" id="s-file">Télécharger un fichier</button></div>
    <div class="h3">Récupérer depuis un autre appareil</div>
    <textarea id="s-in" placeholder="Colle ici le code copié sur l'autre appareil"></textarea>
    <div class="acts" style="margin-top:8px"><button class="pill" id="s-merge">Fusionner avec ma collection</button><button class="pill ghost" id="s-replace">Remplacer ma collection</button><label class="pill ghost" for="s-upload" style="cursor:pointer">Ouvrir un fichier</label><input type="file" id="s-upload" accept=".json,application/json,text/plain" hidden></div>
    <div id="s-confirm" style="margin-top:10px"></div>
    </div></div></div>`;
  const close = () => { root.innerHTML = ""; route(); };
  $("#m-close").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
  $("#s-copy").onclick = async () => { const code = encodeCol(); try { await navigator.clipboard.writeText(code); toast("Code copié"); } catch { $("#s-in").value = code; $("#s-in").select(); toast("Sélectionne et copie le code"); } };
  $("#s-file").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ app: "pokeclasseur", v: 1, ...S.COL }, null, 1)], { type: "application/json" })); a.download = `pokeclasseur-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  $("#s-upload").onchange = async e => { const f = e.target.files[0]; if (f) $("#s-in").value = await f.text(); };
  const read = () => { try { return decodeCol($("#s-in").value); } catch { toast("Code invalide"); return null; } };
  $("#s-merge").onclick = () => {
    const inc = read(); if (!inc) return;
    for (const [id, e] of Object.entries(inc.cards)) { const cur = S.COL.cards[id] || { s: e.s, v: {} }; for (const [v, q] of Object.entries(e.v || {})) cur.v[v] = Math.max(cur.v[v] || 0, q); if (Object.keys(cur.v).length) S.COL.cards[id] = cur; }
    S.COL.products ||= {};
    for (const [sid, arr] of Object.entries(inc.products || {})) { const cur = S.COL.products[sid] ||= []; for (const p of arr) if (!cur.some(x => x.id === p.id)) cur.push(p); }
    saveCol(); toast("Collections fusionnées"); close();
  };
  $("#s-replace").onclick = () => {
    const inc = read(); if (!inc) return;
    $("#s-confirm").innerHTML = `<div class="confirm"><span>Remplacer tes ${n} cartes par les ${Object.keys(inc.cards).length} du code ?</span><button class="pill" id="s-yes">Oui, remplacer</button><button class="pill ghost" id="s-no">Annuler</button></div>`;
    $("#s-yes").onclick = () => { S.COL = inc; saveCol(); toast("Collection remplacée"); close(); };
    $("#s-no").onclick = () => $("#s-confirm").innerHTML = "";
  };
}
$("#btn-sync").onclick = openSync;
