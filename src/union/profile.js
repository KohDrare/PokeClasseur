import { eur } from "../features/variants.js";
import { $, esc } from "../lib/core.js";
import { dexCounts } from "../pages/pokedex.js";
import { unActionSheet, unBindPosts, unCardSheet, unPostHTML, unReport } from "./feed.js";
import { unListingTile } from "./market.js";
import { unOpenConvo } from "./messages.js";
import { unMyCards } from "./picker.js";
import { renderUnion, unFollow, unNeedProfile, unOnboard } from "./shell.js";
import { UI, UN, unAvatar, unBadge, unCard, unCardImg, unDemoTag, unMeName, unSave, unUser } from "./store.js";
import { unTradeComposer } from "./trades.js";

/* ---------- profiles ---------- */
export async function unProfile(main, id) {
  const u = unUser(id); if (!u) { main.innerHTML = `<div class="empty-state"><b>Dresseur introuvable</b></div>`; return; }
  const me = id === "me";
  const posts = UN.posts.filter(p => p.author === id).sort((a, b) => b.ts - a.ts);
  const listings = UN.listings.filter(l => l.seller === id && l.status !== "deleted");
  let stats = { cards: 0, value: 0, dex: 0 }, show = [];
  if (me) {
    const mine = await unMyCards(); stats.cards = mine.length; stats.value = mine.reduce((a, c) => a + (c.p || 0), 0); stats.dex = dexCounts().size; show = mine.slice(0, 8);
  } else { show = u.have.map(unCard).filter(Boolean); stats = { cards: 300 + u.trades * 7, value: 0, dex: 120 + u.trades * 3 }; }
  const following = UN.follows.includes(id);
  const fakeReviews = me ? [] : [["Envoi rapide et carte nickel, merci !", 5], ["Super échange, très sympa.", 5], ["Carte conforme, emballage parfait.", u.rating >= 4.8 ? 5 : 4]];
  main.innerHTML = `<div class="ucard prof">
      <div class="pr-top">${unAvatar(u, 92)}<div class="pr-id"><h2>${esc(me ? unMeName() : u.name)} ${unBadge(u)} ${unDemoTag(u)}</h2><div class="note">@${esc(u.handle || "")}${u.city ? ` · ${UI.pin} ${esc(u.city)}` : ""} · depuis ${new Date(u.joined).toLocaleDateString("fr-BE", { month: "long", year: "numeric" })}</div>${u.bio ? `<p class="ptext">${esc(u.bio)}</p>` : ""}</div>
      <div class="pr-acts">${me ? `<button class="pill ghost" id="pr-edit">Modifier le profil</button>` : `<button class="pill ${following ? "ghost" : ""}" id="pr-follow">${following ? "Abonné" : "Suivre"}</button><button class="pill ghost" id="pr-msg">${UI.mail} Message</button><button class="pill ghost" id="pr-trade">${UI.swap} Échanger</button><button class="iconbtn" id="pr-menu" aria-label="Options">${UI.dots}</button>`}</div></div>
      <div class="pr-stats">
        ${me ? "" : `<div><b><span class="rate">${UI.star}</span>${u.rating.toFixed(1)}</b><small>${u.reviews} avis</small></div><div><b>${u.trades}</b><small>échanges</small></div><div><b>${u.sales}</b><small>ventes</small></div><div><b>${u.followers}</b><small>abonnés</small></div>`}
        ${me ? `<div><b>${stats.cards}</b><small>cartes</small></div><div><b>${eur(stats.value) === "–" ? "0 €" : eur(stats.value)}</b><small>valeur</small></div><div><b>${stats.dex}/1025</b><small>Pokédex</small></div><div><b>${UN.follows.length}</b><small>abonnements</small></div>` : ""}
      </div>
      ${me ? `<div class="verif"><div class="h3">${UI.shield} Confiance</div><div class="vsteps">${[["E-mail", "Confirme ton adresse"], ["Téléphone", "Reçois un code par SMS"], ["Identité", "Badge vendeur vérifié"]].map(([t, d], i) => `<div class="vstep ${UN.me.verified > i ? "done" : ""}"><b>${t}</b><small>${d}</small><span>${UN.me.verified > i ? "Vérifié" : "Avec le serveur"}</span></div>`).join("")}</div><p class="note">La vérification arrivera avec la version en ligne : elle protège acheteurs et vendeurs.</p></div>` : ""}
    </div>
    <div class="seg prtabs" id="pr-tabs"><button data-t="posts" class="on">Publications <em>${posts.length}</em></button><button data-t="listings">Annonces <em>${listings.filter(l => l.status === "active").length}</em></button><button data-t="show">Vitrine</button>${me ? "" : `<button data-t="reviews">Avis <em>${u.reviews}</em></button>`}</div>
    <div id="pr-body"></div>`;
  const body = $("#pr-body");
  const tabs = {
    posts: () => { body.innerHTML = posts.length ? posts.map(unPostHTML).join("") : `<div class="empty-state"><b>Aucune publication</b></div>`; unBindPosts(body); },
    listings: () => { body.innerHTML = listings.length ? `<div class="mkgrid">${listings.map(unListingTile).join("")}</div>` : `<div class="empty-state"><b>Aucune annonce</b></div>`; },
    show: () => { body.innerHTML = show.length ? `<div class="grid smallgrid">${show.map(c => `<button class="tile owned stile" data-cref2="${esc(c.id)}"><span class="cardimg">${unCardImg(c)}</span><span class="cap"><span class="nm">${esc(c.name)}</span><span class="pr">${c.p ? eur(c.p) : ""}</span></span></button>`).join("")}</div>` : `<div class="empty-state"><b>Vitrine vide</b>${me ? "Coche tes cartes dans tes extensions : les plus belles apparaîtront ici." : ""}</div>`; body.querySelectorAll("[data-cref2]").forEach(b => b.onclick = () => unCardSheet(show.find(c => c.id === b.dataset.cref2))); },
    reviews: () => { body.innerHTML = fakeReviews.map(([t, n], i) => { const a = Object.values(UN.users).filter(x => x.id !== id)[i]; return `<div class="ucard review">${unAvatar(a, 32)}<div><div><b>${esc(a.name)}</b> <span class="stars">${UI.star.repeat(n)}</span></div><p class="ptext" style="margin:4px 0 0">${esc(t)}</p></div></div>`; }).join(""); }
  };
  tabs.posts();
  $("#pr-tabs").onclick = e => { const b = e.target.closest("button"); if (!b) return; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); tabs[b.dataset.t](); };
  if (me) $("#pr-edit").onclick = () => unOnboard(main, true);
  else {
    $("#pr-follow").onclick = () => { unFollow(id); renderUnion("u/" + id); };
    $("#pr-msg").onclick = () => { if (unNeedProfile()) return; unOpenConvo(id, ""); };
    $("#pr-trade").onclick = () => { if (unNeedProfile()) return; unTradeComposer(id); };
    $("#pr-menu").onclick = () => unActionSheet([["Signaler ce profil", () => unReport("user", id)], [UN.blocked.includes(id) ? "Débloquer" : `Bloquer ${u.name}`, () => { UN.blocked.includes(id) ? UN.blocked = UN.blocked.filter(x => x !== id) : UN.blocked.push(id); unSave(); renderUnion("u/" + id); }, true]]);
  }
}
