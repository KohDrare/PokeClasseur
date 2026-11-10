/* Other trainers, from the "Profil" tab: search by pseudo, a trainer's public page (#/dresseur/<pseudo>),
   follow, invite to share an extension, followers / following lists. The data side is cloud/profiles.js
   (tables profiles and follows, function profile_card: supabase/migrations/0002). */
import { getProfileCard, listFollows, profileError, saveMyProfile, searchProfiles, setFollow } from "../cloud/profiles.js";
import { myBinders, openBinderEditor, publicBinders, setBinderPublic } from "../features/mybinders.js";
import { swapDrag } from "../features/swapdrag.js";
import { collectionItems } from "./collection.js";
import { openBinderView } from "../features/binderview.js";
import { SORTS, sortItems } from "../features/colsort.js";
import { cloud, cloudReady, hasProfile } from "../cloud/session.js";
import { SH, shareSet } from "../cloud/shared.js";
import { img, loadSeries, loadSet, logoImg, peekSet, pool } from "../data/tcgdex.js";
import { LS } from "../lib/storage.js";
import { openViewer } from "../components/viewer.js";
import { openCard } from "../components/card-modal.js";
import { eur, foilOf, fxHTML, mainVariant, priceOf } from "../features/variants.js";
import { $, ICON, esc } from "../lib/core.js";
import { imgTag, setNav, toast } from "../lib/ui.js";
import { ownedBySet } from "../state/collection.js";
import { S } from "../state/shared.js";
import { sprite } from "./pokedex.js";

export const trainerLink = handle => `#/dresseur/${encodeURIComponent(handle)}`;
const av = (p, size) => `<span class="uav" style="--s:${size}px"><img src="${sprite(p?.avatar || 25)}" alt="" loading="lazy"></span>`;
const since = d => d ? new Date(d).toLocaleDateString("fr-BE", { month: "long", year: "numeric" }) : "";
const wait = (t = "Chargement…") => `<div class="empty-state"><b>${t}</b></div>`;
export const personRow = p => `<a class="urow person tr-row" href="${trainerLink(p.handle)}">${av(p, 40)}<div class="urow-t"><div class="ell"><b>${esc(p.name || p.handle)}</b></div><small>@${esc(p.handle)}${p.city ? ` · ${esc(p.city)}` : ""}</small></div>${ICON.next}</a>`;
const setName = id => (S.SERIES || []).flatMap(x => x.sets).find(t => t.id === id)?.name || id;

/* ---------- search box (in the Profil tab) ---------- */
export function drawTrainerSearch(el) {
  if (!el) return;
  if (!cloud.enabled || !cloud.user) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<h2>Rechercher un dresseur</h2>
    <label class="search" for="tr-q">${ICON.search}<input id="tr-q" placeholder="Rechercher un pseudo ou un nom" autocomplete="off" autocapitalize="none"></label>
    <div id="tr-list" class="tr-list">${wait()}</div>
    <div class="acts"><button class="pill ghost" data-f="following">Mes abonnements</button><button class="pill ghost" data-f="followers">Mes abonnés</button></div>`;
  const list = el.querySelector("#tr-list"); let t = null, seq = 0;
  const run = async q => {
    const my = ++seq;
    try {
      const r = await searchProfiles(q, q ? 15 : 5);
      if (my !== seq || !list.isConnected) return;
      list.innerHTML = r.length ? `${q ? "" : `<small class="note">Derniers inscrits</small>`}${r.map(personRow).join("")}`
        : `<p class="note">${q ? "Aucun dresseur trouvé." : "Personne d'autre pour l'instant : invite tes amis collectionneurs !"}</p>`;
    } catch (e) { if (my === seq) list.innerHTML = `<p class="note err">${esc(profileError(e))}</p>`; }
  };
  el.querySelector("#tr-q").oninput = e => { clearTimeout(t); const q = e.target.value.replace(/^@/, ""); t = setTimeout(() => run(q), 300); };
  el.querySelector(".acts").onclick = async e => {
    const b = e.target.closest("[data-f]"); if (!b || !cloud.user) return;
    list.innerHTML = wait();
    try { const r = await listFollows(cloud.user.id, b.dataset.f); list.innerHTML = r.length ? r.map(personRow).join("") : `<p class="note">${b.dataset.f === "following" ? "Tu ne suis personne pour l'instant." : "Personne ne te suit pour l'instant."}</p>`; }
    catch (x) { list.innerHTML = `<p class="note err">${esc(profileError(x))}</p>`; }
  };
  if (cloud.supabase) run(""); else list.innerHTML = `<p class="note">Connexion au serveur…</p>`;
}

/* ---------- a trainer's page (also my own "Profil" tab: opts.own, with my settings below) ---------- */
export async function renderTrainer(handle, opts = {}) {
  setNav("profil");
  const app = $("#app");
  app.innerHTML = `<section class="profile-page"><div id="tr-page">${wait()}</div></section>`;
  await cloudReady();
  const page = $("#tr-page"); if (!page) return false;
  if (!cloud.supabase) { page.innerHTML = `<div class="empty-state"><b>Connexion au serveur…</b>Réessaie dans un instant.</div>`; return false; }
  let card;
  try { card = await getProfileCard(handle); }
  catch (e) { if (opts.own) return false; page.innerHTML = `<div class="empty-state"><b>Profil indisponible</b>${esc(profileError(e))}</div>`; return false; }
  if (!card) { if (opts.own) return false; page.innerHTML = `<div class="empty-state"><b>Dresseur introuvable</b>Aucun profil @${esc(handle)}.</div>`; return false; }
  if (!page.isConnected) return false;
  if (!S.SERIES) { try { S.SERIES = await loadSeries(); } catch { /* offline */ } }
  const me = card.id === cloud.user?.id;
  let show = Array.isArray(card.showcase) ? card.showcase : [];
  const st = card.stats, binders = Array.isArray(card.binders) ? card.binders : [];
  const canSee = me || !!st;
  const nb = me ? myBinders().length : binders.length;
  const stat = (n, l, t) => `<button class="ig-stat" data-go="${t}"><b>${n}</b><small>${l}</small></button>`;
  const chip = (icon, t) => `<span class="ig-chip">${icon}${t}</span>`;
  page.innerHTML = `<div class="ig">
    <div class="ig-top">
      ${opts.own ? "" : `<a class="ig-ic" href="#/profil" aria-label="Retour">${ICON.back}</a>`}
      <h1 class="ig-handle">${st ? "" : `<i class="ig-lock">${IG.lock}</i>`}${esc(card.handle)}</h1>
      ${me ? `<button class="ig-ic" id="ig-menu" aria-label="Paramètres">${IG.menu}</button>` : `<button class="ig-ic" id="ig-share2" aria-label="Partager le profil">${IG.send}</button>`}
    </div>
    <div class="ig-head">
      <div class="ig-av">${av(card, 92)}</div>
      <div class="ig-side">
        <div class="ig-name">${esc(card.name || card.handle)}</div>
        <div class="ig-stats">
          ${stat(st ? st.cards : "🔒", "cartes", "col")}
          ${stat(`<span id="tr-nf">${card.followers}</span>`, `abonné${card.followers > 1 ? "s" : ""}`, "followers")}
          ${stat(card.following, `abonnement${card.following > 1 ? "s" : ""}`, "following")}
        </div>
      </div>
    </div>
    <div class="ig-bio">
      ${card.bio ? `<p>${esc(card.bio)}</p>` : ""}
      <div class="ig-chips">${st ? chip(IG.sets, `${st.sets} extension${st.sets > 1 ? "s" : ""}`) + chip(IG.dex, `${st.dex}/1025 Pokédex`) : chip(IG.lock, "Collection privée")}${card.city ? chip(IG.pin, esc(card.city)) : ""}${card.joined ? chip(IG.cal, `Depuis ${since(card.joined)}`) : ""}</div>
    </div>
    <div class="ig-acts">
      ${me ? `<button class="ig-btn" id="ig-edit">Modifier le profil</button><button class="ig-btn" id="tr-link">Partager le profil</button><button class="ig-btn ig-sq" id="ig-find" aria-label="Rechercher un dresseur">${IG.addp}</button>`
        : `<button class="ig-btn ${card.i_follow ? "" : "blue"}" id="tr-follow">${card.i_follow ? "Abonné ✓" : "Suivre"}</button><button class="ig-btn" id="tr-share">Partager une extension</button><button class="ig-btn ig-sq" id="tr-link" aria-label="Copier le lien">${IG.link}</button>`}
    </div>
    ${opts.own ? `<div class="ig-find" id="tr-find" hidden></div><div class="ig-disc" id="ig-disc" hidden></div>` : ""}
    ${canSee ? `<div class="ig-hl" id="ig-hl"></div>` : ""}
    <div class="ig-tabs" id="tr-tabs">
      <button data-t="show" aria-label="Vitrine" title="Vitrine">${IG.grid}<span>Vitrine</span></button>
      ${canSee ? `<button data-t="col" aria-label="Collection" title="Collection">${IG.cards}<span>Collection</span></button>` : ""}
      <button data-t="bind" aria-label="Classeurs" title="Classeurs">${IG.book}<span>Classeurs${nb ? ` · ${nb}` : ""}</span></button>
    </div>
    <div class="ig-sub" id="ig-sub" hidden><button class="ig-ic" id="ig-back" aria-label="Retour">${ICON.back}</button><b id="ig-subt"></b></div>
    <div id="tr-body" class="ig-body"></div>
    ${opts.after ? `<div id="tr-settings" hidden>${opts.after}</div>` : ""}
  </div>`;
  const body = $("#tr-body");
  const empty = (icon, t, sub, btn) => `<div class="ig-empty"><span class="ig-ring">${icon}</span><b>${t}</b><small>${sub}</small>${btn || ""}</div>`;
  const tabs = {
    show: () => {
      offSwap(); offSwap = () => {};
      if (me && scDraft) return showEdit();
      body.innerHTML = show.length ? `${me ? `<div class="ig-shead"><button class="ig-link" id="ig-pick">Modifier la vitrine</button></div>` : ""}<div class="ig-grid">${show.map((c, i) => `<button class="ig-cell" data-sc="${i}" aria-label="${esc(c.name)}">${c.img ? `<img src="${img(c.img, "low")}" alt="" loading="lazy">` : ""}</button>`).join("")}</div>`
        : empty(IG.grid, me ? "Montre tes plus belles cartes" : "Vitrine vide", me ? "Choisis jusqu'à 12 cartes à afficher en haut de ton profil." : `@${esc(card.handle)} n'a pas encore choisi de cartes à montrer.`, me ? `<button class="ig-link" id="ig-pick">Choisir ma vitrine</button>` : "");
      body.onclick = e => {
        const b = e.target.closest("[data-sc]"); if (b) { openFull(show, +b.dataset.sc); return; }
        if (e.target.closest("#ig-pick")) editShowcase();
      };
    },
    col: () => { body.onclick = null; showCollection(body, card, me); },
    bind: () => { body.onclick = null; showBinders(body, card, me, binders); },
    sett: () => { body.innerHTML = ""; },
    followers: () => people("followers"), following: () => people("following")
  };
  /* my showcase, edited in place: hold a card and drop it on another one to swap them, ✕ to take one out,
     "+" for the same card picker as the binders (search, sort, rarity); saved with "Terminé" */
  let offSwap = () => {};
  const editShowcase = () => { scDraft = show.map(c => ({ ...c })); tabs.show(); };
  const showEdit = () => {
    offSwap();
    body.innerHTML = `<div class="ig-shead ed"><span class="note">Maintiens une carte et lâche-la sur une autre pour les échanger.</span>
        <div class="ig-edb"><button class="ig-btn" id="sc-cancel">Annuler</button><button class="ig-btn blue" id="sc-done">Terminé</button></div></div>
      <div class="ig-grid edit" id="sc-grid">${scDraft.map((c, i) => `<div class="ig-cell" data-i="${i}">${c.img ? `<img src="${img(c.img, "low")}" alt="" draggable="false">` : ""}<button class="sc-x" data-x="${i}" aria-label="Retirer ${esc(c.name)}">${ICON.x}</button></div>`).join("")}${scDraft.length < SC_MAX ? `<button class="ig-cell ig-add" id="sc-add"><i>+</i><span>Ajouter</span></button>` : ""}</div>
      <p class="note sc-cnt">${scDraft.length}/${SC_MAX} cartes</p>`;
    const g = $("#sc-grid");
    offSwap = swapDrag(g, (i, j) => { [scDraft[i], scDraft[j]] = [scDraft[j], scDraft[i]]; showEdit(); });
    body.onclick = async e => {
      if (g.dataset.dragged) return;
      const x = e.target.closest("[data-x]"); if (x) { scDraft.splice(+x.dataset.x, 1); showEdit(); return; }
      if (e.target.closest("#sc-add")) {
        const b = $("#sc-add"); b.disabled = true; b.querySelector("span").textContent = "Chargement…";
        const items = await collectionItems();
        if (!scDraft) return;
        openBinderEditor(null, items, null, "pick", {
          title: "Ma vitrine", max: SC_MAX, cards: scDraft.map(c => ({ ...c, setId: c.setId || c.id.slice(0, c.id.lastIndexOf("-")) })),
          save: chosen => { scDraft = chosen.map(x => (x.c ? toShow(x.c, x.info) : x.old)); showEdit(); },
          back: () => showEdit()
        });
        return;
      }
      if (e.target.closest("#sc-cancel")) { scDraft = null; tabs.show(); return; }
      if (e.target.closest("#sc-done")) {
        const b = $("#sc-done"); b.disabled = true;
        try { const next = scDraft; await saveMyProfile({ showcase: next }); show = next; scDraft = null; toast("Vitrine enregistrée"); if (body.isConnected) tabs.show(); }
        catch (er) { toast(profileError(er)); b.disabled = false; }
      }
    };
  };
  if (me) {
    const onEdit = () => { if (!body.isConnected) return removeEventListener("showcase:edit", onEdit); select("show"); editShowcase(); toTabs(); };
    addEventListener("showcase:edit", onEdit);
  }
  const people = async dir => {
    body.onclick = null; body.innerHTML = wait();
    try { const l = await listFollows(card.id, dir); body.innerHTML = l.length ? `<div class="ig-people">${l.map(personRow).join("")}</div>` : empty(IG.addp, dir === "followers" ? "Aucun abonné pour l'instant" : "Aucun abonnement pour l'instant", ""); }
    catch (e) { body.innerHTML = `<div class="empty-state"><b>Liste indisponible</b>${esc(profileError(e))}</div>`; }
  };
  const SUB = { followers: "Abonnés", following: "Abonnements", sett: "Paramètres" };
  let lastTab = "show";
  const select = t => {
    if (!tabs[t] || (t === "col" && !canSee) || (t === "sett" && !opts.after)) t = "show";
    const sub = SUB[t];
    $("#tr-tabs").hidden = !!sub; $("#ig-sub").hidden = !sub;
    if (sub) $("#ig-subt").textContent = sub; else lastTab = t;
    [...$("#tr-tabs").children].forEach(x => x.classList.toggle("on", x.dataset.t === t));
    const se = $("#tr-settings"); if (se) se.hidden = t !== "sett";
    body.hidden = t === "sett";
    if (me) ownTab = t;
    tabs[t]();
  };
  const toTabs = () => { const r = $("#ig-sub").hidden ? $("#tr-tabs") : $("#ig-sub"); r.scrollIntoView({ behavior: "smooth", block: "start" }); };
  /* the settings (with my profile card on top); a button of it can be pressed for me (edit, showcase) */
  const settings = click => { select("sett"); toTabs(); if (click) setTimeout(() => { document.querySelector(click)?.click(); $("#pf-me")?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60); };
  select(opts.tab || (opts.own ? ownTab : "show"));
  $("#tr-tabs").onclick = e => { const b = e.target.closest("button"); if (b) select(b.dataset.t); };
  $("#ig-back").onclick = () => select(lastTab);
  page.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { if (b.dataset.go === "col" && !canSee) return; select(b.dataset.go); toTabs(); });
  const share = async () => {
    const url = location.origin + location.pathname + trainerLink(card.handle);
    try { if (navigator.share) await navigator.share({ title: `@${card.handle} sur PokéClasseur`, url }); else { await navigator.clipboard.writeText(url); toast("Lien du profil copié"); } } catch { /* cancelled */ }
  };
  $("#tr-link").onclick = share;
  const s2 = $("#ig-share2"); if (s2) s2.onclick = share;
  if (selFor !== card.id) { selFor = card.id; selSet = null; }
  if (canSee) highlights(card, me, set => { selSet = selSet === set.id ? null : set.id; paintHl(); select("col"); });
  if (me) {
    const mn = $("#ig-menu"); if (mn) mn.onclick = () => (ownTab === "sett" ? select(lastTab) : settings());
    $("#ig-edit").onclick = () => (opts.after ? settings("#pf-edit") : (location.hash = "#/profil"));
    const fb = $("#ig-find");
    if (fb) fb.onclick = () => {
      const f = $("#tr-find"); if (!f) { location.hash = "#/profil"; return; }
      f.hidden = !f.hidden; fb.classList.toggle("on", !f.hidden);
      if (!f.hidden) { drawTrainerSearch(f); f.querySelector("input")?.focus(); }
    };
    if (opts.own) discover($("#ig-disc"), () => fb?.click());
    return true;
  }
  const f = $("#tr-follow");
  f.onclick = async () => {
    if (!hasProfile()) { toast(cloud.user ? "Choisis d'abord ton pseudo dans le Profil" : "Connecte-toi pour suivre des dresseurs"); location.hash = "#/profil"; return; }
    const on = !card.i_follow; f.disabled = true;
    try { await setFollow(card.id, on); card.i_follow = on; card.followers += on ? 1 : -1; f.textContent = on ? "Abonné ✓" : "Suivre"; f.classList.toggle("blue", !on); $("#tr-nf").textContent = card.followers; if (on) toast(`Tu suis @${card.handle}`); }
    catch (e) { toast(profileError(e)); }
    f.disabled = false;
  };
  $("#tr-share").onclick = () => pickSetToShare(card);
  return true;
}

/* the line of extensions under the bio (like Instagram's highlights): most cards first; a tap shows them */
async function highlights(card, me, open) {
  const el = $("#ig-hl"); if (!el) return;
  let rows; try { rows = await rowsOf(card, me); } catch { el.remove(); return; }
  if (!el.isConnected) return;
  const n = new Map(); for (const r of rows) n.set(r.set_id, (n.get(r.set_id) || 0) + r.qty);
  const all = new Map((S.SERIES || []).flatMap(x => x.sets).map(t => [t.id, t]));
  const sets = [...n.keys()].map(id => all.get(id)).filter(Boolean).sort((a, b) => n.get(b.id) - n.get(a.id));
  if (!sets.length) { el.remove(); return; }
  el.innerHTML = sets.map((t, i) => `<button class="ig-hlb" data-h="${i}" data-sid="${esc(t.id)}" aria-pressed="false"><span class="ig-hlc">${logoImg(t.id, t.logo, t.name, t.serie, true)}</span><small>${esc(t.name)}</small></button>`).join("");
  el.onclick = e => { const b = e.target.closest("[data-h]"); if (b) open(sets[+b.dataset.h]); };
  paintHl();
}
/* the showcase being edited (kept while the page redraws) */
const SC_MAX = 12;
let scDraft = null;
const toShow = (c, info) => ({ id: c.id, name: c.name, img: c.img || "", set: info?.name || "", n: c.n || "", r: c.r || "", p: priceOf(c, mainVariant(c)) || 0 });
/* the extension picked in the circles (null = everything): the collection tab shows only its cards */
let selSet = null, selFor = null;
function paintHl() {
  document.querySelectorAll("#ig-hl [data-sid]").forEach(b => { const on = b.dataset.sid === selSet; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); });
}
/* a card's full page from a saved snapshot (showcase, binder): its extension is opened on this device first */
async function fullCards(snaps) {
  const out = await Promise.all(snaps.map(async x => {
    const sid = x.setId || x.id.slice(0, x.id.lastIndexOf("-"));
    const s = (await peekSet(sid).catch(() => null)) || (await loadSet(sid).catch(() => null));
    const c = s?.cards.find(y => y.id === x.id);
    return c ? Object.assign(c, { _info: s.info }) : null;
  }));
  return out;
}
async function openFull(snaps, i) {
  const full = await fullCards(snaps), ok = full.filter(Boolean);
  if (full[i]) openCard(full[i], ok); else if (snaps[i]?.img) openViewer(snaps[i]);
}

/* "Découvrir des dresseurs" on my page: the newest trainers I don't follow yet */
const DISMISS = "pc-disc-x";
async function discover(el, more) {
  if (!el || !cloud.user) return;
  let list;
  try {
    const [r, mine] = await Promise.all([searchProfiles("", 20), listFollows(cloud.user.id, "following")]);
    const x = new Set([...LS.get(DISMISS, []), ...mine.map(p => p.id)]);
    list = r.filter(p => !x.has(p.id)).slice(0, 10);
  } catch { return; }
  if (!el.isConnected) return;
  const draw = () => {
    el.hidden = !list.length;
    el.innerHTML = `<div class="ig-dh"><b>Découvrir des dresseurs</b><button class="ig-link" id="ig-more">Voir plus</button></div>
      <div class="ig-drow">${list.map((p, i) => `<div class="ig-dc">
        <button class="ig-dx" data-x="${i}" aria-label="Masquer">${ICON.x}</button>
        <a href="${trainerLink(p.handle)}">${av(p, 76)}<b class="ell">${esc(p.name || p.handle)}</b><small class="ell">@${esc(p.handle)}${p.city ? ` · ${esc(p.city)}` : ""}</small></a>
        <button class="ig-btn ${p.f ? "" : "blue"}" data-f="${i}">${p.f ? "Abonné ✓" : "Suivre"}</button></div>`).join("")}</div>`;
    el.querySelector("#ig-more").onclick = more;
  };
  el.onclick = async e => {
    const x = e.target.closest("[data-x]");
    if (x) { const p = list[+x.dataset.x]; LS.set(DISMISS, [...LS.get(DISMISS, []), p.id].slice(-200)); list.splice(+x.dataset.x, 1); draw(); return; }
    const f = e.target.closest("[data-f]"); if (!f) return;
    if (!hasProfile()) { toast("Choisis d'abord ton pseudo"); return; }
    const p = list[+f.dataset.f]; f.disabled = true;
    try { await setFollow(p.id, !p.f); p.f = !p.f; if (p.f) toast(`Tu suis @${p.handle}`); } catch (er) { toast(profileError(er)); }
    draw();
  };
  draw();
}

const svgI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IG = {
  lock: svgI('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  menu: svgI('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  send: svgI('<path d="M22 3 9.5 14.5M22 3l-7 18-3.5-6.5L5 11z"/>'),
  link: svgI('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  addp: svgI('<circle cx="10" cy="8" r="4"/><path d="M2 21c0-4 4-6 8-6s8 2 8 6M19 8v6M16 11h6"/>'),
  grid: svgI('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  cards: svgI('<rect x="7" y="3" width="12" height="16" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h9"/>'),
  book: svgI('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>'),
  sets: svgI('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  dex: svgI('<circle cx="12" cy="12" r="9"/><path d="M3 12h6M15 12h6"/><circle cx="12" cy="12" r="3"/>'),
  pin: svgI('<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>'),
  cal: svgI('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>')
};

let ownTab = "show";   // the tab of my own profile, kept when the page redraws

/* ---------- binders: mine (with "visible on my profile") or the ones a trainer shows ---------- */
function showBinders(body, card, me, theirs) {
  const list = me ? myBinders() : theirs;
  if (!list.length) { body.innerHTML = `<div class="empty-state"><b>Aucun classeur${me ? "" : " visible"}</b>${me ? "Crée tes classeurs dans « Ma collection », puis choisis ici ceux à montrer sur ton profil." : `@${esc(card.handle)} ne montre pas encore de classeur.`}</div>`; return; }
  body.innerHTML = `<div class="pf-card"><div class="shelf trshelf">${list.map((b, i) => `<div class="trb"><button class="btile" data-b="${i}" style="--bc:${b.color}">
      <span class="bcover">${b.cards[0] ? `<span class="bmain">${imgTag(b.cards[0], "low")}</span>` : ""}<span class="bmini">${b.cards.slice(1, 4).map(c => `<span>${imgTag(c, "low")}</span>`).join("")}</span></span>
      <b>${esc(b.name)}</b><small>${b.cards.length} carte${b.cards.length > 1 ? "s" : ""}</small></button>
      ${me ? `<button class="trpub ${b.pub ? "on" : ""}" data-pub="${esc(b.id)}" role="switch" aria-checked="${!!b.pub}"><i></i>${b.pub ? "Sur mon profil" : "Privé"}</button>` : ""}</div>`).join("")}</div>
      ${me ? `<p class="note">« Sur mon profil » : le classeur est visible par les autres dresseurs dans cet onglet.</p>` : ""}</div>`;
  body.onclick = e => {
    const pb = e.target.closest("[data-pub]");
    if (pb) { const b = myBinders().find(x => x.id === pb.dataset.pub); setBinderPublic(pb.dataset.pub, !b?.pub); showBinders(body, card, me, theirs); toast(b?.pub ? "Classeur privé" : "Classeur visible sur ton profil"); return; }
    const t = e.target.closest("[data-b]"); if (!t) return;
    const b = list[+t.dataset.b];
    openBinderView({ title: b.name, color: b.color, mode: b.mode || "pages", slots: b.cards.map(c => ({ c, owned: true })), onOpen: sl => openFull(b.cards, b.cards.findIndex(c => c.id === sl.c.id)) });
  };
}
/* my binders shown on my profile follow every change of them */
let pubTimer = null;
addEventListener("binders:changed", () => {
  clearTimeout(pubTimer);
  pubTimer = setTimeout(async () => {
    if (!cloud.user || !cloud.profile?.handle) return;
    const next = publicBinders();
    if (JSON.stringify(next) === JSON.stringify(cloud.profile.binders || [])) return;
    try { await saveMyProfile({ binders: next }); }
    catch (e) { toast(/binders/.test(e.message || "") ? "Pour montrer tes classeurs, lance 0006_profile_binders.sql dans Supabase" : profileError(e)); }
  }, 800);
});

/* ---------- a trainer's collection (read only): value, best cards, every card ---------- */
const colCache = new Map();   // user id → rows (this visit)
/* a trainer's collection rows: mine from this device, the others' from the database (once per visit) */
async function rowsOf(card, me) {
  if (me) return Object.entries(S.COL.cards).flatMap(([id, e]) => Object.entries(e.v || {}).filter(([, n]) => n > 0).map(([v, n]) => ({ card_id: id, set_id: e.s, variant: v, qty: n, cond: e.c || null })));
  if (colCache.has(card.id)) return colCache.get(card.id);
  const p = (async () => {
    const get = async cols => { const out = []; for (let from = 0; ; from += 1000) { const { data, error } = await cloud.supabase.from("collection_items").select(cols).eq("user_id", card.id).range(from, from + 999); if (error) throw error; out.push(...data); if (data.length < 1000) return out; } };
    return get("card_id,variant,set_id,qty,cond").catch(e => (/cond/.test(e.message || "") ? get("card_id,variant,set_id,qty") : Promise.reject(e)));
  })();
  colCache.set(card.id, p);
  p.catch(() => colCache.delete(card.id));
  return p;
}
let colSort = { k: "price", d: -1 }, colQ = "";
async function showCollection(body, card, me) {
  body.innerHTML = wait("Chargement de la collection…");
  let rows;
  try { rows = await rowsOf(card, me); }
  catch (e) { body.innerHTML = `<div class="empty-state"><b>Collection indisponible</b>${esc(profileError(e))}</div>`; return; }
  if (!body.isConnected) return;
  if (!me && !rows.length && card.stats?.cards) { body.innerHTML = `<div class="empty-state"><b>Collection pas encore lisible</b>Pour voir les cartes des autres, lance le fichier <b>0005_public_collection.sql</b> dans Supabase (SQL Editor → Run).</div>`; return; }
  if (!rows.length) { body.innerHTML = `<div class="empty-state"><b>Aucune carte pour l'instant</b></div>`; return; }
  const sel = selFor === card.id ? selSet : null;
  if (sel) rows = rows.filter(r => r.set_id === sel);
  // the extensions' cards (from this device when already seen, else downloaded once)
  const ids = [...new Set(rows.map(r => r.set_id))], sets = new Map();
  let done = 0;
  const step = () => { const w = body.querySelector("[data-prog]"); if (w) w.textContent = `Chargement des extensions ${done}/${ids.length}…`; };
  body.innerHTML = `<div class="empty-state"><b data-prog>Chargement des extensions 0/${ids.length}…</b></div>`;
  await pool(ids, 3, async id => { let s = await peekSet(id).catch(() => null); if (!s) s = await loadSet(id).catch(() => null); if (s) sets.set(id, s); done++; step(); });
  if (!body.isConnected) return;
  const COND = { NM: 1, EX: 0.85, GD: 0.7, LP: 0.55, PL: 0.4, PO: 0.25 };
  const byCard = new Map();
  for (const r of rows) {
    const s = sets.get(r.set_id), c = s?.cards.find(x => x.id === r.card_id); if (!c) continue;
    const it = byCard.get(c.id) || { c: Object.assign(c, { _info: s.info }), info: s.info, q: 0, val: 0, unit: 0, vs: [] };
    const p = priceOf(c, r.variant) * (COND[r.cond] || 1);
    it.q += r.qty; it.val += p * r.qty; it.unit = Math.max(it.unit, p); it.vs.push(r.variant);
    byCard.set(c.id, it);
  }
  const items = [...byCard.values()];
  const total = items.reduce((a, x) => a + x.val, 0), copies = items.reduce((a, x) => a + x.q, 0);
  const top = [...items].sort((a, b) => b.unit - a.unit).slice(0, 6);
  for (const x of items) { x.no = parseInt((x.c.src || x.c.n || "").replace(/\D+/g, "")) || 0; x.date = x.info.date || ""; }
  // search and sort like "Ma collection" (favourites only make sense on my own page)
  const sorts = SORTS.filter(x => me || x.k !== "fav");
  const sorted = () => {
    const t = colQ.trim().toLowerCase();
    const l = t ? items.filter(x => x.c.name.toLowerCase().includes(t) || (x.info.name || "").toLowerCase().includes(t) || (x.c.n || "").replace(/^0+/, "") === t.replace(/^0+/, "")) : items;
    return sortItems(l, colSort.k, colSort.d);
  };
  const grid = () => {
    const list = sorted(), g = body.querySelector("#tr-grid");
    g.innerHTML = list.length ? list.map((x, i) => `<div class="tile owned"><button class="cardimg" data-i="${i}" aria-label="${esc(x.c.name)}">${imgTag(x.c, "low")}${fxHTML(foilOf(x.c))}</button>${x.q > 1 ? `<span class="qty">×${x.q}</span>` : ""}<div class="cap"><span class="n">${esc(x.info.abbr || "")} ${esc(x.c.n || "")}</span><span class="nm">${esc(x.c.name)}</span><span class="pr">${x.unit ? eur(x.unit) : ""}</span></div></div>`).join("")
      : `<div class="empty-state" style="grid-column:1/-1"><b>Aucune carte trouvée</b></div>`;
    g.onclick = e => { const b = e.target.closest("[data-i]"); if (b) openCard(list[+b.dataset.i].c, list.map(x => x.c)); };
    const s = sorts.find(x => x.k === colSort.k);
    body.querySelector("#tr-sortl").textContent = (s?.l || "").replace(/^Par /, "").replace(/^./, m => m.toUpperCase()) + (colSort.d > 0 ? " ↑" : " ↓");
  };
  body.innerHTML = `<div class="tr-colhead">
      <div class="valcard"><div class="vc-lbl">${sel ? esc(setName(sel)) : me ? "Ma collection" : `Collection de ${esc(card.name || "@" + card.handle)}`}</div><div class="vc-val">${eur(total).replace("–", "0 €")}</div>
        <div class="vc-foot"><span class="note"><b>${items.length}</b> cartes · <b>${copies}</b> exemplaires · <b>${sets.size}</b> extension${sets.size > 1 ? "s" : ""}</span>${sel ? `<button class="ig-link" id="tr-all">Toute la collection</button>` : ""}</div></div>
      <div class="colpeek"><div class="cp-hd2"><h2>${me ? "Mes plus belles cartes" : "Ses plus belles cartes"}${sel ? ` · ${esc(setName(sel))}` : ""}</h2></div><div class="peekgrid">${top.map((x, i) => `<button class="peek" data-top="${i}" aria-label="${esc(x.c.name)}">${imgTag(x.c, "low")}${fxHTML(foilOf(x.c))}${x.unit ? `<span class="pchip">${eur(x.unit)}</span>` : ""}</button>`).join("")}</div></div>
    </div>
    <div class="toolbar coltools"><label class="search" for="tr-q">${ICON.search}<input id="tr-q" placeholder="Rechercher une carte ou une extension" value="${esc(colQ)}" autocomplete="off"></label><button class="toggle" id="tr-sortb"><span id="tr-sortl"></span></button></div>
    <div class="grid" id="tr-grid"></div>`;
  body.querySelector(".peekgrid").onclick = e => { const b = e.target.closest("[data-top]"); if (b) openCard(top[+b.dataset.top].c, top.map(x => x.c)); };
  body.querySelector("#tr-q").oninput = e => { colQ = e.target.value; grid(); };
  const all = body.querySelector("#tr-all"); if (all) all.onclick = () => { selSet = null; paintHl(); showCollection(body, card, me); };
  body.querySelector("#tr-sortb").onclick = () => {
    const el = document.createElement("div"); el.className = "modal"; el.id = "trsort";
    const drawSheet = () => {
      el.innerHTML = `<div class="sheet sortsheet" role="dialog" aria-modal="true" aria-label="Trier"><h2>Trier</h2>
        <div class="sortlist">${sorts.map(x => `<button class="sortopt ${colSort.k === x.k ? "on" : ""}" data-k="${x.k}"><span>${x.l}</span>${colSort.k === x.k ? `<i class="sdir">${colSort.d > 0 ? "↑" : "↓"}</i>` : ""}</button>`).join("")}</div>
        <p class="note">Touche encore le tri choisi pour inverser l'ordre.</p><button class="cp-close sortclose" id="ts-x" aria-label="Fermer">${ICON.x}</button></div>`;
    };
    drawSheet(); document.body.append(el);
    el.onclick = e => {
      if (e.target === el || e.target.closest("#ts-x")) return el.remove();
      const b = e.target.closest("[data-k]"); if (!b) return;
      const x = sorts.find(y => y.k === b.dataset.k);
      colSort = colSort.k === x.k ? { k: x.k, d: -colSort.d } : { k: x.k, d: x.d };
      grid(); drawSheet();
    };
  };
  grid();
}

/* "Partager une extension" from a trainer's page: one of my extensions → invitation */
function pickSetToShare(card) {
  if (!hasProfile()) { toast("Choisis d'abord ton pseudo dans le Profil"); return; }
  if (SH.error === "missing") { toast("Lance d'abord le fichier 0004_shared.sql dans Supabase"); return; }
  const ids = Object.keys(ownedBySet()).filter(id => !SH.bySet[id]?.members?.some(m => m.user_id === card.id));
  const el = document.createElement("div"); el.className = "modal"; el.id = "trshare";
  el.innerHTML = `<div class="sheet shsheet" role="dialog" aria-modal="true"><button class="iconbtn close" id="ts-close" aria-label="Fermer">${ICON.x}</button>
    <h2>Partager une extension avec ${esc(card.name || "@" + card.handle)}</h2>
    <p class="note">Vous aurez une seule liste de cartes pour cette extension ; tes cartes actuelles deviennent la liste commune, à vous deux par défaut.</p>
    ${ids.length ? `<div class="pf-rows">${ids.map(id => `<button class="pf-row" data-s="${esc(id)}"><b>${esc(setName(id))}</b><small>${SH.bySet[id] ? "Déjà partagée : il sera ajouté" : "Tes cartes de cette extension"}</small></button>`).join("")}</div>` : `<p class="note">Coche d'abord des cartes dans une extension.</p>`}
  </div>`;
  document.body.append(el);
  const close = () => el.remove();
  el.onclick = async e => {
    if (e.target === el || e.target.closest("#ts-close")) return close();
    const b = e.target.closest("[data-s]"); if (!b) return;
    b.disabled = true;
    try { await shareSet(b.dataset.s, card.handle); toast(`Invitation envoyée à ${card.name || "@" + card.handle}`); close(); }
    catch (x) { toast(x.message || "Partage impossible"); b.disabled = false; }
  };
}
