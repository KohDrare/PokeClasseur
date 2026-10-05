import { shrinkPhoto } from "../features/products.js";
import { eur, isSpecial, rareName } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { idb } from "../lib/storage.js";
import { toast } from "../lib/ui.js";
import { ownedAny, setQty } from "../state/collection.js";
import { S } from "../state/shared.js";
import { unReport } from "./feed.js";
import { unOpenConvo } from "./messages.js";
import { unPickCards } from "./picker.js";
import { renderUnion, unNeedProfile } from "./shell.js";
import { UI, UN, UN_COND, UN_COND_SHORT, unAgo, unAvatar, unCardImg, unDemoTag, unName, unSave, unSetOf, unUser } from "./store.js";
import { unTradeComposer } from "./trades.js";

/* ---------- marketplace ---------- */
export let unMk = { q: "", sort: "new", cond: -1, trade: false, mine: false, max: "" };
export function unMarket(main) {
  const q = unMk.q.trim().toLowerCase();
  let ls = UN.listings.filter(l => l.status !== "deleted" && !UN.blocked.includes(l.seller));
  if (unMk.mine) ls = ls.filter(l => l.seller === "me"); else ls = ls.filter(l => l.status === "active" || l.seller === "me");
  if (q) ls = ls.filter(l => (l.card.name + " " + l.card.set).toLowerCase().includes(q));
  if (unMk.cond >= 0) ls = ls.filter(l => l.condition <= unMk.cond);
  if (unMk.trade) ls = ls.filter(l => l.trade);
  if (unMk.max) ls = ls.filter(l => l.price <= +unMk.max);
  const sorters = { new: (a, b) => b.ts - a.ts, cheap: (a, b) => a.price - b.price, exp: (a, b) => b.price - a.price, deal: (a, b) => (a.price / (a.card.p || a.price)) - (b.price / (b.card.p || b.price)) };
  ls.sort(sorters[unMk.sort]);
  main.innerHTML = `<div class="mkbar">
      <label class="search" for="mk-q">${ICON.search}<input id="mk-q" placeholder="Rechercher une carte ou une extension" value="${esc(unMk.q)}" autocomplete="off"></label>
      <button class="pill" id="mk-new">${UI.plus} Vendre une carte</button>
    </div>
    <div class="mkfilters">
      <select id="mk-sort" aria-label="Trier"><option value="new">Plus récentes</option><option value="cheap">Prix croissant</option><option value="exp">Prix décroissant</option><option value="deal">Meilleures affaires</option></select>
      <select id="mk-cond" aria-label="État minimum"><option value="-1">Tous les états</option>${UN_COND.map((c, i) => `<option value="${i}">${c} ou mieux</option>`).join("")}</select>
      <label class="mkmax">Max <input id="mk-max" type="number" inputmode="decimal" min="0" placeholder="€" value="${esc(unMk.max)}"></label>
      <button class="toggle sm ${unMk.trade ? "on" : ""}" id="mk-trade">${UI.swap} Échange possible</button>
      <button class="toggle sm ${unMk.mine ? "on" : ""}" id="mk-mine">Mes annonces</button>
    </div>
    <div class="mkgrid">${ls.length ? ls.map(unListingTile).join("") : `<div class="empty-state" style="grid-column:1/-1"><b>${unMk.mine ? "Tu n'as pas encore d'annonce" : "Aucune annonce trouvée"}</b>${unMk.mine ? "Vends tes doubles en deux minutes avec « Vendre une carte »." : "Essaie une autre recherche ou d'autres filtres."}</div>`}</div>`;
  $("#mk-sort").value = unMk.sort; $("#mk-cond").value = unMk.cond;
  const re = () => { const y = scrollY; renderUnion("market"); scrollTo(0, y); };
  let t; $("#mk-q").oninput = e => { unMk.q = e.target.value; clearTimeout(t); t = setTimeout(() => { re(); const i = $("#mk-q"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250); };
  $("#mk-sort").onchange = e => { unMk.sort = e.target.value; re(); };
  $("#mk-cond").onchange = e => { unMk.cond = +e.target.value; re(); };
  $("#mk-max").onchange = e => { unMk.max = e.target.value; re(); };
  $("#mk-trade").onclick = () => { unMk.trade = !unMk.trade; re(); };
  $("#mk-mine").onclick = () => { unMk.mine = !unMk.mine; re(); };
  $("#mk-new").onclick = () => { if (unNeedProfile()) return; unPickCards({ multi: false, title: "Quelle carte veux-tu vendre ?" }, cs => cs[0] && unListingForm(cs[0])); };
  main.querySelectorAll("[data-save]").forEach(b => b.onclick = e => { e.preventDefault(); const l = UN.listings.find(x => x.id === b.dataset.save); l.saves = l.saves || []; l.saves.includes("me") ? l.saves = l.saves.filter(x => x !== "me") : l.saves.push("me"); unSave(); b.classList.toggle("on"); });
}
export function unDealTag(l) {
  if (!l.card.p || l.variant === "reverse") return "";
  const r = l.price / l.card.p;
  if (r <= .9) return `<span class="deal good">−${Math.round((1 - r) * 100)} % vs marché</span>`;
  if (r >= 1.25) return `<span class="deal high">+${Math.round((r - 1) * 100)} % vs marché</span>`;
  return `<span class="deal">prix du marché</span>`;
}
export function unListingTile(l) {
  const s = unUser(l.seller), saved = (l.saves || []).includes("me");
  return `<a class="ltile ${l.status !== "active" ? "st-" + l.status : ""}" href="#/union/listing/${l.id}">
    <span class="lt-img">${unCardImg(l.card)}${l.status !== "active" ? `<span class="lt-status">${l.status === "sold" ? "Vendue" : "Réservée"}</span>` : ""}<button class="lt-save ${saved ? "on" : ""}" data-save="${l.id}" aria-label="Enregistrer">${UI.bookmark}</button></span>
    <span class="lt-body"><b class="ell">${esc(l.card.name)}</b><small class="ell">${esc(l.card.set)} · ${UN_COND_SHORT[l.condition]}${l.variant === "reverse" ? " · Reverse" : ""}</small>
    <span class="lt-price">${eur(l.price)} ${unDealTag(l)}</span>
    <span class="lt-seller">${unAvatar(s, 20)}<span class="ell">${esc(s.id === "me" ? "Toi" : s.name)}</span>${s.id !== "me" ? `<span class="rate">${UI.star}${s.rating.toFixed(1)}</span>` : ""}<span class="ell city">${UI.pin}${esc(l.city || "")}</span></span></span></a>`;
}
export function unListingForm(card, edit) {
  const root = $("#modal-root"); const l = edit || { condition: 1, variant: "holo", lang: "FR", price: card.p ? Math.round(card.p * 100) / 100 : "", qty: 1, ship: { post: true, hand: true, cost: 2.5 }, desc: "", trade: true };
  let photo = null;
  root.innerHTML = `<div class="modal" id="mdl"><div class="sheet formsheet lform" role="dialog" aria-modal="true" aria-label="Annonce"><button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
    <div class="info"><h2>${edit ? "Modifier l'annonce" : "Mettre en vente"}</h2>
    <div class="lf-card"><span>${unCardImg(card)}</span><div><b>${esc(card.name)}</b><small>${esc(card.set || "")}${card.n ? " · " + esc(card.n) : ""}</small>${card.p ? `<small>Prix marché : <b>${eur(card.p)}</b></small>` : ""}</div></div>
    <div class="pgrid" style="margin-top:14px">
      <label>État<select id="lf-cond">${UN_COND.map((c, i) => `<option value="${i}" ${i === l.condition ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <label>Version<select id="lf-var"><option value="normal">Normale</option><option value="holo">Holo / rare</option><option value="reverse">Reverse</option></select></label>
      <label>Prix (€)<input id="lf-price" type="number" inputmode="decimal" min="0" step="0.01" value="${l.price}"></label>
      <label>Langue<select id="lf-lang">${["FR", "EN", "JP", "DE", "IT", "ES"].map(x => `<option ${x === l.lang ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <label class="wide">Description<input id="lf-desc" maxlength="300" value="${esc(l.desc)}" placeholder="Centrage, défauts, protection à l'envoi…"></label>
      <label class="wide">Photo de ta carte (recommandé)<input id="lf-photo" type="file" accept="image/*"></label>
    </div>
    <div class="lf-opts"><label><input type="checkbox" id="lf-post" ${l.ship.post ? "checked" : ""}> Envoi postal <input id="lf-ship" type="number" min="0" step="0.1" value="${l.ship.cost}" aria-label="Frais d'envoi"> €</label>
    <label><input type="checkbox" id="lf-hand" ${l.ship.hand ? "checked" : ""}> Remise en main propre${UN.me.city ? " à " + esc(UN.me.city) : ""}</label>
    <label><input type="checkbox" id="lf-trade" ${l.trade ? "checked" : ""}> J'accepte aussi les échanges</label></div>
    <div class="ptotal" id="lf-hint"></div>
    <div style="display:flex;gap:8px;margin-top:14px"><button class="pill" id="lf-save">${edit ? "Enregistrer" : "Publier l'annonce"}</button><button class="pill ghost" id="lf-cancel">Annuler</button></div></div></div></div>`;
  document.body.style.overflow = "hidden";
  $("#lf-var").value = l.variant;
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; };
  const hint = () => { const pr = parseFloat(String($("#lf-price").value).replace(",", ".")) || 0; $("#lf-hint").innerHTML = card.p && pr ? (pr <= card.p * .9 ? `Bon prix : ${Math.round((1 - pr / card.p) * 100)} % sous le marché, ça partira vite.` : pr >= card.p * 1.25 ? `Attention : ${Math.round((pr / card.p - 1) * 100)} % au-dessus du marché.` : "Prix dans la moyenne du marché.") : "Astuce : un prix proche de Cardmarket se vend plus vite."; };
  hint(); $("#lf-price").oninput = hint;
  $("#m-close").onclick = close; $("#lf-cancel").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
  $("#lf-photo").onchange = async e => { const f = e.target.files[0]; if (f) { try { photo = await shrinkPhoto(f); toast("Photo prête"); } catch { toast("Photo illisible"); } } };
  $("#lf-save").onclick = async () => {
    const price = parseFloat(String($("#lf-price").value).replace(",", ".")); if (!(price >= 0)) { toast("Indique un prix"); return; }
    const out = { ...(edit || { id: "l" + Date.now().toString(36), seller: "me", ts: Date.now(), status: "active", views: 0, saves: [], card, city: UN.me.city }),
      condition: +$("#lf-cond").value, variant: $("#lf-var").value, lang: $("#lf-lang").value, price, desc: $("#lf-desc").value.trim(),
      ship: { post: $("#lf-post").checked, hand: $("#lf-hand").checked, cost: parseFloat($("#lf-ship").value) || 0 }, trade: $("#lf-trade").checked };
    if (photo) { await idb.set("uimg:" + out.id, photo); out.photo = true; }
    if (edit) Object.assign(edit, out); else UN.listings.unshift(out);
    unSave(); close(); toast(edit ? "Annonce modifiée" : "Annonce publiée"); location.hash = "#/union/listing/" + out.id; if (edit) renderUnion("listing/" + out.id);
  };
}
export function unListingPage(main, id) {
  const l = UN.listings.find(x => x.id === id);
  if (!l || l.status === "deleted") { main.innerHTML = `<div class="empty-state"><b>Annonce introuvable</b><a href="#/union/market">Retour au marché</a></div>`; return; }
  const s = unUser(l.seller), mine = l.seller === "me";
  if (!mine) { l.views = (l.views || 0) + 1; unSave(); }
  const others = UN.listings.filter(x => x.id !== l.id && x.card.id === l.card.id && x.status === "active");
  main.innerHTML = `<a class="crumb" href="#/union/market">${ICON.back} Marché</a>
    <div class="ucard lpage">
      <div class="lp-img"><div class="holo" id="holo">${unCardImg(l.card, "high")}<div class="glare"></div></div>${l.photo ? `<div class="lp-photo" data-lphoto="${l.id}"></div>` : ""}</div>
      <div class="lp-info">
        ${l.status !== "active" ? `<span class="lt-status inline">${l.status === "sold" ? "Vendue" : "Réservée"}</span>` : ""}
        <h2>${esc(l.card.name)}</h2><div class="line">${esc(l.card.set)}${l.card.n ? " · " + esc(l.card.n) : ""}</div>
        <div class="lp-price">${eur(l.price)} ${unDealTag(l)}</div>
        <dl class="facts"><dt>État</dt><dd>${UN_COND[l.condition]}</dd><dt>Version</dt><dd>${l.variant === "reverse" ? "Reverse" : l.variant === "normal" ? "Normale" : l.card.r ? esc(isSpecial(l.card) ? rareName(l.card) : l.card.r) : "Holo"}</dd><dt>Langue</dt><dd>${esc(l.lang)}</dd>
        <dt>Livraison</dt><dd>${[l.ship.post ? `Envoi suivi (${eur(l.ship.cost) === "–" ? "gratuit" : eur(l.ship.cost)})` : "", l.ship.hand ? `Main propre à ${esc(l.city || "convenir")}` : ""].filter(Boolean).join(" · ")}</dd>
        <dt>Échange</dt><dd>${l.trade ? "Possible" : "Vente uniquement"}</dd>${l.card.p ? `<dt>Prix marché</dt><dd>${eur(l.card.p)}</dd>` : ""}</dl>
        ${l.desc ? `<p class="ptext">${esc(l.desc)}</p>` : ""}
        <div class="lp-acts">${mine ? `<button class="pill" id="lp-edit">Modifier</button><button class="pill ghost" id="lp-status">${l.status === "active" ? "Marquer réservée" : "Remettre en vente"}</button><button class="pill ghost" id="lp-sold">Marquer vendue</button><button class="pill ghost danger" id="lp-del">Supprimer</button>`
          : l.status === "active" ? `<button class="pill" id="lp-buy">Acheter</button><button class="pill ghost" id="lp-offer">Faire une offre</button>${l.trade ? `<button class="pill ghost" id="lp-trade">${UI.swap} Proposer un échange</button>` : ""}` : ""}</div>
        <div id="lp-confirm"></div>
        <a class="seller" href="#/union/u/${s.id}">${unAvatar(s, 48)}<div><div>${unName(s, false)} ${unDemoTag(s)}</div><small>${s.id === "me" ? "Ton annonce" : `<span class="rate">${UI.star}${s.rating.toFixed(1)}</span> ${s.reviews} avis · ${s.sales} ventes · ${s.trades} échanges`}</small></div></a>
        <p class="note">${l.views || 0} vues · ${(l.saves || []).length} enregistrement${(l.saves || []).length > 1 ? "s" : ""} · publiée ${unAgo(l.ts)}</p>
        <button class="linkbtn" id="lp-report">${UI.flag} Signaler l'annonce</button>
      </div></div>
    ${others.length ? `<div class="stsec"><h2>Autres annonces pour cette carte</h2><div class="mkgrid">${others.map(unListingTile).join("")}</div></div>` : ""}`;
  main.querySelectorAll("[data-lphoto]").forEach(async el => { const src = await idb.get("uimg:" + el.dataset.lphoto); if (src) el.innerHTML = `<img src="${src}" alt="Photo du vendeur">`; });
  const h = $("#holo"); h.onpointermove = e => { const b = h.getBoundingClientRect(); const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height; h.style.transform = `rotateY(${(x - .5) * 14}deg) rotateX(${(.5 - y) * 14}deg)`; h.style.setProperty("--gx", x * 100 + "%"); h.style.setProperty("--gy", y * 100 + "%"); };
  h.onpointerleave = () => h.style.transform = "";
  $("#lp-report").onclick = () => unReport("listing", l.id);
  const re = () => renderUnion("listing/" + l.id);
  if (mine) {
    $("#lp-edit").onclick = () => unListingForm(l.card, l);
    $("#lp-status").onclick = () => { l.status = l.status === "active" ? "reserved" : "active"; unSave(); re(); };
    $("#lp-sold").onclick = () => {
      const owned = ownedAny(l.card.id);
      $("#lp-confirm").innerHTML = `<div class="confirm" style="margin-top:10px"><span>Marquer comme vendue${owned ? " et retirer 1 exemplaire de ta collection" : ""} ?</span><button class="pill" id="sold-yes">Oui</button><button class="pill ghost" id="sold-no">Non</button></div>`;
      $("#sold-yes").onclick = () => { l.status = "sold"; if (owned) unRemoveFromCollection(l.card.id, l.variant); unSave(); toast("Annonce marquée vendue"); re(); };
      $("#sold-no").onclick = () => $("#lp-confirm").innerHTML = "";
    };
    $("#lp-del").onclick = () => {
      $("#lp-confirm").innerHTML = `<div class="confirm" style="margin-top:10px"><span>Supprimer cette annonce ?</span><button class="pill" id="del-yes">Supprimer</button><button class="pill ghost" id="del-no">Annuler</button></div>`;
      $("#del-yes").onclick = () => { l.status = "deleted"; unSave(); toast("Annonce supprimée"); location.hash = "#/union/market"; };
      $("#del-no").onclick = () => $("#lp-confirm").innerHTML = "";
    };
  } else if (l.status === "active") {
    $("#lp-buy").onclick = () => { if (unNeedProfile()) return; unOpenConvo(s.id, `Bonjour ! Je t'achète ta ${l.card.name} à ${eur(l.price)}${l.ship.post ? " avec envoi suivi" : ""}. Elle est toujours dispo ?`, { type: "listing", id: l.id }); };
    $("#lp-offer").onclick = () => {
      if (unNeedProfile()) return;
      $("#lp-confirm").innerHTML = `<form class="confirm" id="of-form" style="margin-top:10px"><span>Ton offre</span><input id="of-v" type="number" inputmode="decimal" min="0" step="0.5" value="${Math.round(l.price * .85 * 2) / 2}" style="width:90px;height:38px;border-radius:8px;border:1px solid var(--line);padding:0 8px;background:var(--surface);color:var(--fg)"> €<button class="pill">Envoyer</button></form>`;
      $("#of-form").onsubmit = e => { e.preventDefault(); const v = parseFloat($("#of-v").value) || 0; unOpenConvo(s.id, `Bonjour ! Je te propose ${eur(v)} pour ta ${l.card.name}, ça te va ?`, { type: "listing", id: l.id }, v / l.price); };
    };
    const tb = $("#lp-trade"); if (tb) tb.onclick = () => { if (unNeedProfile()) return; unTradeComposer(s.id, [], [l.card]); };
  }
}
export function unRemoveFromCollection(id, variant) {
  const e = S.COL.cards[id]; if (!e) return;
  const v = e.v[variant] ? variant : Object.keys(e.v).find(k => e.v[k] > 0); if (!v) return;
  setQty({ id, setId: e.s, ok: 0 }, v, e.v[v] - 1);
}
export function unAddToCollection(c) {
  const sid = unSetOf(c.id), e = S.COL.cards[c.id];
  const v = (c.r && isSpecial(c)) ? "holo" : "normal";
  const cur = e?.v?.[v] || 0;
  setQty({ id: c.id, setId: sid, ok: 0 }, v, cur + 1);
}
