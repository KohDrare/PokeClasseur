import { shrinkPhoto } from "../features/products.js";
import { symHTML } from "../features/rarity.js";
import { eur, isSpecial, rareName } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { idb } from "../lib/storage.js";
import { toast } from "../lib/ui.js";
import { unOpenConvo } from "./messages.js";
import { unPickCards } from "./picker.js";
import { renderUnion, unFollow, unNeedProfile } from "./shell.js";
import { UI, UN, UN_COND_SHORT, UN_KINDS, unAgo, unAvatar, unCard, unCardImg, unDemoTag, unMeName, unName, unNotify, unSave, unSetOf, unUser } from "./store.js";

/* ---------- feed ---------- */
export let unFeedFilter = "all", unDraft = { kind: "pull", text: "", cards: [], photo: null };
export function unFeed(main) {
  let posts = UN.posts.filter(p => !UN.blocked.includes(p.author));
  if (unFeedFilter === "following") posts = posts.filter(p => p.author === "me" || UN.follows.includes(p.author));
  else if (unFeedFilter !== "all") posts = posts.filter(p => p.kind === unFeedFilter);
  posts.sort((a, b) => b.ts - a.ts);
  main.innerHTML = `
    <div class="ucard composer">
      <div class="cmp-top">${unAvatar(UN.me, 42)}<textarea id="cmp-text" rows="2" maxlength="600" placeholder="${UN.me.name ? "Raconte ton dernier pull, montre ta vitrine, cherche une carte…" : "Crée ton profil pour publier"}">${esc(unDraft.text)}</textarea></div>
      <div class="cmp-kinds" id="cmp-kinds">${Object.entries(UN_KINDS).map(([k, l]) => `<button class="kchip ${unDraft.kind === k ? "on" : ""}" data-k="${k}">${l}</button>`).join("")}</div>
      ${unDraft.cards.length || unDraft.photo ? `<div class="cmp-att">${unDraft.cards.map((c, i) => `<span class="att">${unCardImg(c)}<button data-rm="${i}" aria-label="Retirer">${ICON.x}</button></span>`).join("")}${unDraft.photo ? `<span class="att photo"><img src="${unDraft.photo}" alt=""><button data-rmp="1" aria-label="Retirer la photo">${ICON.x}</button></span>` : ""}</div>` : ""}
      <div class="cmp-bar"><button class="tbtn" id="cmp-cards">${UI.cards}<span>Cartes</span></button><label class="tbtn" for="cmp-photo">${UI.image}<span>Photo</span></label><input type="file" id="cmp-photo" accept="image/*" hidden><button class="pill" id="cmp-post">Publier</button></div>
    </div>
    <div class="seg feedf" id="feed-f">${[["all", "Pour toi"], ["following", "Abonnements"], ["pull", "Pulls"], ["wanted", "Recherches"], ["showcase", "Vitrines"]].map(([k, l]) => `<button data-f="${k}" class="${unFeedFilter === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div id="feed-list">${posts.length ? posts.map(unPostHTML).join("") : `<div class="empty-state"><b>Rien ici pour l'instant</b>Suis des dresseurs ou publie ton premier pull.</div>`}</div>`;
  const ta = $("#cmp-text"); ta.oninput = () => { unDraft.text = ta.value; };
  $("#cmp-kinds").onclick = e => { const b = e.target.closest("button"); if (!b) return; unDraft.kind = b.dataset.k; [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b)); };
  $("#cmp-cards").onclick = () => { if (unNeedProfile()) return; unPickCards({ title: "Joindre des cartes" }, cs => { unDraft.cards = [...unDraft.cards, ...cs].slice(0, 6); renderUnion("feed"); }); };
  $("#cmp-photo").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { unDraft.photo = await shrinkPhoto(f); renderUnion("feed"); } catch { toast("Photo illisible"); } };
  main.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { unDraft.cards.splice(+b.dataset.rm, 1); renderUnion("feed"); });
  const rp = main.querySelector("[data-rmp]"); if (rp) rp.onclick = () => { unDraft.photo = null; renderUnion("feed"); };
  $("#cmp-post").onclick = async () => {
    if (unNeedProfile()) return;
    if (!unDraft.text.trim() && !unDraft.cards.length && !unDraft.photo) { toast("Écris quelque chose ou joins une carte"); return; }
    const id = "p" + Date.now().toString(36);
    if (unDraft.photo) await idb.set("uimg:" + id, unDraft.photo);
    UN.posts.unshift({ id, author: "me", ts: Date.now(), kind: unDraft.kind, text: unDraft.text.trim(), cards: unDraft.cards, photo: !!unDraft.photo, likes: [], comments: [] });
    unDraft = { kind: "pull", text: "", cards: [], photo: null }; unSave(); toast("Publié"); renderUnion("feed");
    unSimulate(() => { const p = UN.posts.find(x => x.id === id); const fan = ["mehdi", "lea", "tom", "ines"][Math.floor(Math.random() * 4)]; if (p) { p.likes.push(fan); unSave(); unNotify(`${UN.users[fan].name} aime ta publication`, "#/union/feed"); } }, 4000);
  };
  $("#feed-f").onclick = e => { const b = e.target.closest("button"); if (!b) return; unFeedFilter = b.dataset.f; renderUnion("feed"); };
  unBindPosts(main);
}
export function unPostHTML(p) {
  const u = unUser(p.author); if (!u) return "";
  const liked = p.likes.includes("me");
  return `<article class="ucard post" id="post-${p.id}">
    <header class="phead">${unAvatar(u, 44)}<div class="ph-t"><div>${unName(u)} ${unDemoTag(u)}</div><small>${esc(u.city || "")}${u.city ? " · " : ""}${unAgo(p.ts)}</small></div><span class="kind k-${p.kind}">${UN_KINDS[p.kind] || ""}</span>
    <button class="iconbtn sm" data-menu="${p.id}" aria-label="Options">${UI.dots}</button></header>
    ${p.text ? `<p class="ptext">${esc(p.text)}</p>` : ""}
    ${p.cards.length ? `<div class="pcards n${Math.min(p.cards.length, 3)}">${p.cards.map(c => `<button class="pcard" data-cref="${esc(c.id)}">${unCardImg(c, p.cards.length === 1 ? "high" : "low")}<span class="pc-cap"><b>${esc(c.name)}</b><small>${esc(c.set || "")}${c.p ? " · " + eur(c.p) : ""}</small></span></button>`).join("")}</div>` : ""}
    ${p.photo ? `<div class="pphotowrap" data-pphoto="${p.id}"></div>` : ""}
    <footer class="pact"><button class="act ${liked ? "on" : ""}" data-like="${p.id}">${UI.heart}<span>${p.likes.length}</span></button><button class="act" data-cmt="${p.id}">${UI.chat}<span>${p.comments.length}</span></button>
    ${p.author !== "me" && p.cards.length ? `<button class="act" data-offer="${p.id}">${p.kind === "wanted" ? UI.swap : UI.mail}<span>${p.kind === "wanted" ? "Je l'ai" : "Contacter"}</span></button>` : ""}</footer>
    <div class="pcomments" id="cm-${p.id}" ${p.comments.length ? "" : "hidden"}>${p.comments.map(c => { const cu = unUser(c.author); return `<div class="cmt">${unAvatar(cu, 28)}<div><span class="cmt-b"><b>${esc(cu.id === "me" ? unMeName() : cu.name)}</b> ${esc(c.text)}</span><small>${unAgo(c.ts)}</small></div></div>`; }).join("")}
      <form class="cmt-form" data-cform="${p.id}"><input maxlength="300" placeholder="Écrire un commentaire…" aria-label="Commentaire"><button class="iconbtn sm" aria-label="Envoyer">${UI.send}</button></form></div>
  </article>`;
}
export function unBindPosts(root) {
  root.querySelectorAll("[data-like]").forEach(b => b.onclick = () => { if (unNeedProfile()) return; const p = UN.posts.find(x => x.id === b.dataset.like); p.likes.includes("me") ? p.likes = p.likes.filter(x => x !== "me") : p.likes.push("me"); unSave(); b.classList.toggle("on"); b.querySelector("span").textContent = p.likes.length; });
  root.querySelectorAll("[data-cmt]").forEach(b => b.onclick = () => { const box = $("#cm-" + b.dataset.cmt); box.hidden = false; box.querySelector("input").focus(); });
  root.querySelectorAll("[data-cform]").forEach(f => f.onsubmit = e => {
    e.preventDefault(); if (unNeedProfile()) return; const t = f.querySelector("input").value.trim(); if (!t) return;
    const p = UN.posts.find(x => x.id === f.dataset.cform); p.comments.push({ id: "c" + Date.now(), author: "me", ts: Date.now(), text: t }); unSave();
    const y = scrollY; renderUnion(location.hash.slice(8) || "feed"); scrollTo(0, y); const box = $("#cm-" + p.id); if (box) box.hidden = false;
  });
  root.querySelectorAll("[data-cref]").forEach(b => b.onclick = () => { const c = unFindCardRef(b.dataset.cref); if (c) unCardSheet(c); });
  root.querySelectorAll("[data-offer]").forEach(b => b.onclick = () => { if (unNeedProfile()) return; const p = UN.posts.find(x => x.id === b.dataset.offer); const c = p.cards[0]; unOpenConvo(p.author, p.kind === "wanted" ? `Salut ! J'ai ${c.name} (${c.set}) que tu cherches, ça t'intéresse ?` : `Salut ! Ta ${c.name} m'intéresse, elle est à vendre ou à échanger ?`); });
  root.querySelectorAll("[data-menu]").forEach(b => b.onclick = () => unPostMenu(UN.posts.find(x => x.id === b.dataset.menu)));
  root.querySelectorAll("[data-pphoto]").forEach(async el => { const src = await idb.get("uimg:" + el.dataset.pphoto); el.innerHTML = src ? `<img src="${src}" alt="Photo jointe">` : `<p class="note">Photo enregistrée sur un autre appareil</p>`; });
}
export function unFindCardRef(id) {
  for (const p of UN.posts) for (const c of p.cards) if (c.id === id) return c;
  for (const l of UN.listings) if (l.card?.id === id) return l.card;
  return unCard(id);
}
export function unPostMenu(p) {
  const mine = p.author === "me", u = unUser(p.author);
  unActionSheet(mine ? [["Supprimer la publication", () => { UN.posts = UN.posts.filter(x => x.id !== p.id); unSave(); toast("Publication supprimée"); renderUnion("feed"); }, true]]
    : [[UN.follows.includes(u.id) ? `Ne plus suivre ${u.name}` : `Suivre ${u.name}`, () => { unFollow(u.id); renderUnion("feed"); }], ["Voir le profil", () => location.hash = "#/union/u/" + u.id], ["Signaler la publication", () => unReport("post", p.id)], [`Bloquer ${u.name}`, () => { UN.blocked.push(u.id); unSave(); toast(`${u.name} est bloqué`); renderUnion("feed"); }, true]]);
}
export function unActionSheet(items) {
  const root = $("#modal-root");
  root.innerHTML = `<div class="modal" id="mdl"><div class="sheet actsheet" role="dialog" aria-modal="true">${items.map(([l], i) => `<button class="actitem ${items[i][2] ? "danger" : ""}" data-i="${i}">${esc(l)}</button>`).join("")}<button class="actitem cancel" data-i="-1">Annuler</button></div></div>`;
  document.body.style.overflow = "hidden";
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; };
  $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
  root.querySelectorAll(".actitem").forEach(b => b.onclick = () => { const i = +b.dataset.i; close(); if (i >= 0) items[i][1](); });
}
export function unReport(type, id) {
  const reasons = ["Arnaque ou faux", "Contenu inapproprié", "Spam", "Carte contrefaite", "Autre"];
  unActionSheet(reasons.map(r => [r, () => { UN.reports.push({ type, id, reason: r, ts: Date.now() }); unSave(); toast("Merci, le signalement est enregistré"); }]));
}
export function unCardSheet(c) {
  const root = $("#modal-root");
  const listings = UN.listings.filter(l => l.card?.id === c.id && l.status === "active");
  const wished = UN.wish.some(w => w.id === c.id);
  root.innerHTML = `<div class="modal" id="mdl"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(c.name)}"><button class="iconbtn close" id="m-close" aria-label="Fermer">${ICON.x}</button>
    <div class="big"><div class="holo" id="holo">${unCardImg(c, "high")}<div class="glare"></div></div></div>
    <div class="info"><h2>${esc(c.name)}</h2><div class="line"><span>${esc(c.n || "")}</span>·<span>${esc(c.set || "")}</span></div>
    <dl class="facts">${c.r ? `<dt>Rareté</dt><dd>${symHTML(c.r)} ${esc(isSpecial(c) ? rareName(c) : c.r)}</dd>` : ""}<dt>Prix marché</dt><dd>${c.p ? eur(c.p) : "inconnu"}</dd></dl>
    <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap"><button class="pill ${wished ? "" : "ghost"}" id="cs-wish">${UI.bookmark} ${wished ? "Dans ma liste de recherche" : "Je la cherche"}</button><a class="pill ghost" href="#/set/${encodeURIComponent(unSetOf(c.id))}">Voir l'extension</a></div>
    <div class="h3">En vente dans l'Union Room</div>
    ${listings.length ? listings.map(l => { const s = unUser(l.seller); return `<a class="lrow" href="#/union/listing/${l.id}">${unAvatar(s, 32)}<span>${esc(s.id === "me" ? unMeName() : s.name)} · ${UN_COND_SHORT[l.condition]}</span><b>${eur(l.price)}</b></a>`; }).join("") : `<p class="note">Aucune annonce pour cette carte.</p>`}
    </div></div></div>`;
  document.body.style.overflow = "hidden";
  const close = () => { root.innerHTML = ""; document.body.style.overflow = ""; };
  $("#m-close").onclick = close; $("#mdl").onclick = e => { if (e.target.id === "mdl") close(); };
  root.querySelectorAll("a").forEach(a => a.addEventListener("click", close));
  $("#cs-wish").onclick = () => { unToggleWish(c); unCardSheet(c); };
}
export function unToggleWish(c) {
  if (UN.wish.some(w => w.id === c.id)) { UN.wish = UN.wish.filter(w => w.id !== c.id); toast("Retirée de ta liste de recherche"); }
  else { UN.wish.push({ id: c.id, name: c.name, img: c.img, set: c.set || c.setId || "", n: c.n, r: c.r, p: c.p || 0 }); toast("Ajoutée à ta liste de recherche"); }
  unSave();
}
export function unSimulate(fn, ms) { setTimeout(() => { try { fn(); } catch {} }, ms); }
