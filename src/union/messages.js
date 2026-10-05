import { eur } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { unActionSheet, unReport, unSimulate } from "./feed.js";
import { renderUnion } from "./shell.js";
import { UI, UN, unAgo, unAvatar, unCardImg, unDemoTag, unName, unNotify, unSave, unUser } from "./store.js";
import { unTradeComposer } from "./trades.js";

/* ---------- messages ---------- */
export function unConvo(withId) { let c = UN.convos.find(x => x.with === withId); if (!c) { c = { id: "v" + Date.now().toString(36), with: withId, msgs: [], unread: 0 }; UN.convos.push(c); } return c; }
export function unOpenConvo(withId, draft, ref, offerRatio) {
  const c = unConvo(withId); c.draft = draft || ""; c.pendingRef = ref || null; c.offerRatio = offerRatio; unSave();
  location.hash = "#/union/messages/" + c.id;
}
export function unMessages(main, cid) {
  const convos = UN.convos.filter(c => c.msgs.length || c.draft).sort((a, b) => (b.msgs.slice(-1)[0]?.ts || Date.now()) - (a.msgs.slice(-1)[0]?.ts || Date.now()));
  const cur = cid ? UN.convos.find(c => c.id === cid) : null;
  if (cur) cur.unread = 0, unSave();
  main.innerHTML = `<div class="ucard msgs ${cur ? "has-cur" : ""}">
    <div class="mlist">${convos.length ? convos.map(c => { const u = unUser(c.with), last = c.msgs.slice(-1)[0]; return `<a class="mitem ${c === cur ? "on" : ""}" href="#/union/messages/${c.id}">${unAvatar(u, 40)}<div class="ph-t"><div class="mrow"><b>${esc(u.name)}</b><small>${last ? unAgo(last.ts) : ""}</small></div><small class="ell">${last ? esc((last.from === "me" ? "Toi : " : "") + last.text) : "Brouillon"}</small></div>${c.unread ? `<em class="mun">${c.unread}</em>` : ""}</a>`; }).join("") : `<div class="empty-state" style="padding:30px 12px"><b>Aucune conversation</b>Contacte un vendeur ou réponds à une recherche.</div>`}</div>
    <div class="mthread">${cur ? (() => { const u = unUser(cur.with); return `<div class="mt-head"><a class="iconbtn sm mback" href="#/union/messages" aria-label="Retour">${ICON.back}</a>${unAvatar(u, 36)}<div class="ph-t"><div>${unName(u)} ${unDemoTag(u)}</div><small>${esc(u.city || "")}</small></div><button class="iconbtn sm" id="mt-menu" aria-label="Options">${UI.dots}</button></div>
      <div class="mt-body" id="mt-body">${cur.msgs.map(m => `<div class="bub ${m.from === "me" ? "me" : ""}">${m.ref ? unRefHTML(m.ref) : ""}<span>${esc(m.text)}</span><small>${unAgo(m.ts)}${m.demo ? " · réponse simulée" : ""}</small></div>`).join("") || `<p class="note" style="text-align:center;margin:30px 0">Dis bonjour à ${esc(u.name)} !</p>`}</div>
      ${cur.pendingRef ? `<div class="mt-ref">${unRefHTML(cur.pendingRef)}</div>` : ""}
      <form class="mt-form" id="mt-form"><input id="mt-in" maxlength="600" placeholder="Écrire un message…" value="${esc(cur.draft || "")}" aria-label="Message"><button class="pill" aria-label="Envoyer">${UI.send}</button></form>`; })() : `<div class="empty-state" style="padding:60px 20px"><b>Tes messages</b>Choisis une conversation à gauche.</div>`}</div>
  </div>`;
  if (!cur) return;
  const body = $("#mt-body"); body.scrollTop = body.scrollHeight;
  const u = unUser(cur.with);
  $("#mt-menu").onclick = () => unActionSheet([["Voir le profil", () => location.hash = "#/union/u/" + u.id], ["Proposer un échange", () => unTradeComposer(u.id)], ["Signaler", () => unReport("user", u.id)], [`Bloquer ${u.name}`, () => { UN.blocked.push(u.id); unSave(); location.hash = "#/union/messages"; }, true]]);
  $("#mt-form").onsubmit = e => {
    e.preventDefault(); const t = $("#mt-in").value.trim(); if (!t) return;
    cur.msgs.push({ from: "me", ts: Date.now(), text: t, ref: cur.pendingRef || undefined }); const ref = cur.pendingRef, ratio = cur.offerRatio;
    cur.draft = ""; cur.pendingRef = null; cur.offerRatio = undefined; unSave(); renderUnion("messages/" + cur.id);
    if (u.id !== "me") unSimulate(() => {
      let reply = "Merci pour ton message, je te réponds vite !";
      if (ref?.type === "listing") { const l = UN.listings.find(x => x.id === ref.id); reply = ratio != null ? (ratio >= .85 ? `Ok pour ${eur(l.price * ratio)}, je te la réserve !` : `Je descends à ${eur(l.price * .92)} au plus bas, ça te va ?`) : "Oui elle est toujours dispo ! Je te la réserve, on fait comment pour l'envoi ?"; if (ratio == null || ratio >= .85) { l.status = "reserved"; } }
      cur.msgs.push({ from: u.id, ts: Date.now(), text: reply, demo: true }); unSave();
      if (location.hash === "#/union/messages/" + cur.id) renderUnion("messages/" + cur.id); else { cur.unread = (cur.unread || 0) + 1; unSave(); unNotify(`Nouveau message de ${u.name}`, "#/union/messages/" + cur.id); }
    }, 2500);
  };
}
export function unRefHTML(ref) {
  if (ref.type === "listing") { const l = UN.listings.find(x => x.id === ref.id); return l ? `<a class="mref" href="#/union/listing/${l.id}"><span>${unCardImg(l.card)}</span><div><b>${esc(l.card.name)}</b><small>Annonce · ${eur(l.price)}</small></div></a>` : ""; }
  if (ref.type === "trade") { const t = UN.trades.find(x => x.id === ref.id); return t ? `<a class="mref" href="#/union/trades"><span>${unCardImg(t.give[0])}</span><div><b>Proposition d'échange</b><small>${t.give.length} contre ${t.get.length} carte${t.get.length > 1 ? "s" : ""}</small></div></a>` : ""; }
  return "";
}
