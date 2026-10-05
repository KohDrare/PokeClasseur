import { eur } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { toast } from "../lib/ui.js";
import { ownedAny } from "../state/collection.js";
import { S } from "../state/shared.js";
import { unCardSheet, unSimulate } from "./feed.js";
import { unAddToCollection, unRemoveFromCollection } from "./market.js";
import { unConvo } from "./messages.js";
import { unPickCards } from "./picker.js";
import { renderUnion, unNeedProfile } from "./shell.js";
import { UI, UN, unAgo, unAvatar, unCard, unCardImg, unDemoTag, unMyDoubles, unName, unNotify, unSave, unUser } from "./store.js";

/* ---------- trades ---------- */
export async function unTrades(main) {
  const myDoubles = new Set(unMyDoubles());
  const myOwned = new Set(Object.keys(S.COL.cards).filter(id => ownedAny(id)));
  const wishIds = new Set(UN.wish.map(w => w.id));
  const matches = Object.values(UN.users).filter(u => !UN.blocked.includes(u.id)).map(u => {
    const theyHave = u.have.filter(id => wishIds.has(id) || !myOwned.has(id)).map(unCard).filter(Boolean);
    const theyWant = u.want.filter(id => myDoubles.has(id) || myOwned.has(id));
    const strong = u.have.filter(id => wishIds.has(id)).length + u.want.filter(id => myDoubles.has(id)).length;
    return { u, theyHave, theyWant, strong };
  }).filter(m => m.theyHave.length && m.theyWant.length).sort((a, b) => b.strong - a.strong);
  const trades = [...UN.trades].sort((a, b) => b.ts - a.ts);
  const stLabel = { pending: "En attente", accepted: "Acceptée", declined: "Refusée", done: "Terminée", cancelled: "Annulée" };
  main.innerHTML = `
    <div class="stsec" style="margin-top:0"><div class="sthead2"><h2>Tes propositions</h2></div>
      ${trades.length ? `<div class="trlist">${trades.map(t => { const u = unUser(t.with); return `<div class="ucard trade st-${t.status}">
        <div class="tr-head">${unAvatar(u, 36)}<div class="ph-t"><div>${unName(u)}</div><small>${t.from === "me" ? "Tu as proposé" : "Te propose"} · ${unAgo(t.ts)}</small></div><span class="tstatus">${stLabel[t.status]}</span></div>
        <div class="tr-body"><div class="tr-side"><small>Tu donnes · ${eur(unSum(t.give))}</small><div class="tr-cards">${t.give.map(c => `<span>${unCardImg(c)}</span>`).join("") || "<em>rien</em>"}</div></div><span class="tr-arrow">${UI.swap}</span>
        <div class="tr-side"><small>Tu reçois · ${eur(unSum(t.get))}${t.cash ? ` + ${eur(Math.abs(t.cash))} ${t.cash > 0 ? "payés par toi" : "reçus"}` : ""}</small><div class="tr-cards">${t.get.map(c => `<span>${unCardImg(c)}</span>`).join("") || "<em>rien</em>"}</div></div></div>
        <div class="tr-acts">${t.status === "pending" && t.from === "me" ? `<button class="pill ghost sm" data-tcancel="${t.id}">Annuler</button>` : ""}${t.status === "accepted" ? `<button class="pill sm" data-tdone="${t.id}">Échange reçu, mettre à jour ma collection</button>` : ""}<a class="pill ghost sm" href="#/union/messages/${UN.convos.find(c => c.with === t.with)?.id || ""}">Messages</a></div></div>`; }).join("")}</div>`
        : `<div class="ucard empty-in"><b>Aucun échange en cours</b><p class="note">Propose un échange depuis un match ci-dessous, une annonce ou le profil d'un dresseur.</p></div>`}
    </div>
    <div class="stsec"><div class="sthead2"><h2>Matchs d'échange</h2><span class="note">D'après tes doubles et ta liste de recherche</span></div>
      ${matches.length ? `<div class="matches">${matches.map(m => `<div class="ucard match">
        <div class="tr-head">${unAvatar(m.u, 40)}<div class="ph-t"><div>${unName(m.u)} ${unDemoTag(m.u)}</div><small>${esc(m.u.city)} · <span class="rate">${UI.star}${m.u.rating.toFixed(1)}</span> · ${m.u.trades} échanges</small></div>${m.strong ? `<span class="mscore">${m.strong} correspondance${m.strong > 1 ? "s" : ""}</span>` : ""}</div>
        <div class="tr-body"><div class="tr-side"><small>Il/elle a</small><div class="tr-cards">${m.theyHave.slice(0, 4).map(c => `<span title="${esc(c.name)}">${unCardImg(c)}${wishIds.has(c.id) ? `<i class="wtag">${UI.bookmark}</i>` : ""}</span>`).join("")}</div></div>
        <span class="tr-arrow">${UI.swap}</span>
        <div class="tr-side"><small>Il/elle cherche (tu l'as)</small><div class="tr-cards">${m.theyWant.slice(0, 4).map(id => { const c = unCard(id); return c ? `<span title="${esc(c.name)}">${unCardImg(c)}${myDoubles.has(id) ? `<i class="dtag">×2</i>` : ""}</span>` : ""; }).join("")}</div></div></div>
        <div class="tr-acts"><button class="pill sm" data-propose="${m.u.id}">Proposer un échange</button><a class="pill ghost sm" href="#/union/u/${m.u.id}">Voir le profil</a></div></div>`).join("")}</div>`
        : `<div class="ucard empty-in"><b>Pas encore de match</b><p class="note">Coche tes cartes en double dans tes extensions et ajoute des cartes à ta liste de recherche (bouton « Je la cherche » sur une carte).</p></div>`}
    </div>
    <div class="stsec"><div class="sthead2"><h2>Ma liste de recherche</h2><button class="pill ghost" id="wish-add">${UI.plus} Ajouter</button></div>
      ${UN.wish.length ? `<div class="grid smallgrid">${UN.wish.map(c => `<button class="tile owned stile" data-wish="${esc(c.id)}"><span class="cardimg">${unCardImg(c)}</span><span class="cap"><span class="nm">${esc(c.name)}</span><span class="pr">${c.p ? eur(c.p) : ""}</span></span></button>`).join("")}</div>` : `<p class="note">Vide pour l'instant.</p>`}
    </div>`;
  main.querySelectorAll("[data-propose]").forEach(b => b.onclick = () => { if (unNeedProfile()) return; const m = matches.find(x => x.u.id === b.dataset.propose); unTradeComposer(m.u.id, m.theyWant.map(unCard).filter(Boolean).filter(c => myOwned.has(c.id)).slice(0, 1), m.theyHave.filter(c => wishIds.has(c.id)).slice(0, 1)); });
  main.querySelectorAll("[data-tcancel]").forEach(b => b.onclick = () => { const t = UN.trades.find(x => x.id === b.dataset.tcancel); t.status = "cancelled"; unSave(); renderUnion("trades"); });
  main.querySelectorAll("[data-tdone]").forEach(b => b.onclick = () => {
    const t = UN.trades.find(x => x.id === b.dataset.tdone); t.status = "done";
    t.give.forEach(c => unRemoveFromCollection(c.id, "holo")); t.get.forEach(unAddToCollection);
    const u = unUser(t.with); if (u.trades != null) u.trades++;
    unSave(); toast("Collection mise à jour"); unNotify(`Échange terminé avec ${u.name}. Pense à lui laisser un avis.`, "#/union/u/" + u.id); renderUnion("trades");
  });
  main.querySelectorAll("[data-wish]").forEach(b => b.onclick = () => unCardSheet(UN.wish.find(w => w.id === b.dataset.wish)));
  $("#wish-add").onclick = () => unPickCards({ title: "Quelles cartes cherches-tu ?", only: "all" }, cs => { cs.forEach(c => { if (!UN.wish.some(w => w.id === c.id)) UN.wish.push(c); }); unSave(); renderUnion("trades"); });
}
export const unSum = cs => cs.reduce((a, c) => a + (c.p || 0), 0);
export async function unTradeComposer(withId, give0 = [], get0 = []) {
  const u = unUser(withId); const root = $("#modal-root");
  let give = [...give0], get = [...get0], cash = 0;
  const theirs = (u.have || []).map(unCard).filter(Boolean);
  for (const l of UN.listings) if (l.seller === withId && l.status === "active" && !theirs.some(c => c.id === l.card.id)) theirs.push(l.card);
  document.body.style.overflow = "hidden";
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; };
  const draw = () => {
    const gv = unSum(give), rv = unSum(get) , diff = rv - gv - cash;
    const tot = Math.max(gv + Math.max(cash, 0), rv + Math.max(-cash, 0), 0.01);
    const lp = Math.round((gv + Math.max(cash, 0)) / (gv + rv + Math.abs(cash) || 1) * 100);
    const fair = Math.abs(diff) <= Math.max(tot * .15, 1.5);
    root.innerHTML = `<div class="modal" id="mdl"><div class="sheet formsheet tcomp" role="dialog" aria-modal="true" aria-label="Proposer un échange"><button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
      <div class="info"><h2>Échange avec ${esc(u.name)}</h2>
      <div class="tc-cols">
        <div class="tc-col"><div class="h3">Tu donnes · ${eur(gv) === "–" ? "0 €" : eur(gv)}</div><div class="tc-cards">${give.map((c, i) => `<span class="att">${unCardImg(c)}<button data-rg="${i}" aria-label="Retirer">${ICON.x}</button></span>`).join("")}<button class="tc-add" id="tc-addg">${UI.plus}<span>Mes cartes</span></button></div></div>
        <div class="tc-col"><div class="h3">Tu reçois · ${eur(rv) === "–" ? "0 €" : eur(rv)}</div><div class="tc-cards">${get.map((c, i) => `<span class="att">${unCardImg(c)}<button data-rr="${i}" aria-label="Retirer">${ICON.x}</button></span>`).join("")}</div>
          <div class="tc-theirs">${theirs.filter(c => !get.some(g => g.id === c.id)).map(c => `<button class="tc-pick" data-pick="${esc(c.id)}" title="${esc(c.name)}">${unCardImg(c)}<small>${eur(c.p)}</small></button>`).join("")}</div></div>
      </div>
      <label class="tc-cash">Complément en argent <input id="tc-cash" type="number" step="0.5" value="${cash || ""}" placeholder="0"> € <small>(positif = tu paies, négatif = tu reçois)</small></label>
      <div class="fair"><div class="fairbar"><i style="width:${lp}%"></i></div><span class="${fair ? "ok" : "warn"}">${!give.length && !get.length ? "Ajoute des cartes des deux côtés" : fair ? "Échange équilibré" : diff > 0 ? `Déséquilibré : tu reçois ${eur(diff)} de plus` : `Déséquilibré : tu donnes ${eur(-diff)} de plus`}</span></div>
      <input id="tc-msg" class="tc-msg" maxlength="300" placeholder="Un petit mot (optionnel)">
      <div style="display:flex;gap:8px;margin-top:14px"><button class="pill" id="tc-send" ${give.length && get.length ? "" : "disabled"}>Envoyer la proposition</button><button class="pill ghost" id="tc-cancel">Annuler</button></div>
      <p class="note" style="margin-top:8px">Valeurs : prix tendance Cardmarket.</p></div></div></div>`;
    $("#m-close").onclick = close; $("#tc-cancel").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
    root.querySelectorAll("[data-rg]").forEach(b => b.onclick = () => { give.splice(+b.dataset.rg, 1); draw(); });
    root.querySelectorAll("[data-rr]").forEach(b => b.onclick = () => { get.splice(+b.dataset.rr, 1); draw(); });
    root.querySelectorAll("[data-pick]").forEach(b => b.onclick = () => { get.push(theirs.find(c => c.id === b.dataset.pick)); draw(); });
    $("#tc-cash").onchange = e => { cash = parseFloat(e.target.value) || 0; draw(); };
    $("#tc-addg").onclick = () => unPickCards({ title: "Quelles cartes donnes-tu ?", only: "mine" }, cs => { cs.forEach(c => { if (!give.some(g => g.id === c.id)) give.push(c); }); unTradeComposer(withId, give, get); });
    $("#tc-send").onclick = () => {
      const t = { id: "t" + Date.now().toString(36), from: "me", with: withId, ts: Date.now(), give, get, cash, status: "pending", msg: $("#tc-msg").value.trim() };
      UN.trades.push(t); unSave(); close();
      const conv = unConvo(withId);
      conv.msgs.push({ from: "me", ts: Date.now(), text: t.msg || "Je te propose cet échange.", ref: { type: "trade", id: t.id } }); unSave();
      toast("Proposition envoyée"); location.hash = "#/union/trades";
      unSimulate(() => {
        const ok = Math.abs(unSum(t.get) - unSum(t.give) - t.cash) <= Math.max(Math.max(unSum(t.give), unSum(t.get)) * .2, 2);
        t.status = ok ? "accepted" : "declined";
        unConvo(withId).msgs.push({ from: withId, ts: Date.now(), text: ok ? "Ça marche pour moi ! On s'organise pour l'envoi ou on se voit ?" : "Merci pour la proposition, mais c'est un peu déséquilibré pour moi. Tu peux ajouter quelque chose ?", demo: true });
        unConvo(withId).unread = (unConvo(withId).unread || 0) + 1;
        unSave(); unNotify(`${u.name} a ${ok ? "accepté" : "refusé"} ton échange`, "#/union/trades");
        if (location.hash.startsWith("#/union/trades")) renderUnion("trades");
      }, 3500);
    };
  };
  draw();
}
