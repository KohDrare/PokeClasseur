/* Other trainers, from the "Profil" tab: search by pseudo, a trainer's public page (#/dresseur/<pseudo>),
   follow, invite to share an extension, followers / following lists. The data side is cloud/profiles.js
   (tables profiles and follows, function profile_card: supabase/migrations/0002). */
import { getProfileCard, listFollows, profileError, searchProfiles, setFollow } from "../cloud/profiles.js";
import { cloud, cloudReady, hasProfile } from "../cloud/session.js";
import { SH, shareSet } from "../cloud/shared.js";
import { img, loadSeries, loadSet, peekSet, pool } from "../data/tcgdex.js";
import { openViewer } from "../components/viewer.js";
import { eur, foilOf, fxHTML, priceOf } from "../features/variants.js";
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
  el.innerHTML = `<h2>Dresseurs</h2>
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
  app.innerHTML = `<section class="profile-page">${opts.own ? "" : `<a class="crumb" href="#/profil">${ICON.back} Profil</a>`}<div id="tr-page">${wait()}</div></section>`;
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
  const st = card.stats, show = Array.isArray(card.showcase) ? card.showcase : [];
  const canSee = me || !!st;
  const box = (n, l, t) => t ? `<button data-t="${t}"><b>${n}</b><small>${l}</small></button>` : `<div><b>${n}</b><small>${l}</small></div>`;
  page.innerHTML = `<div class="pf-card tr-head">
      <div class="pf-hero">${av(card, 84)}<div class="pf-id"><h1>${esc(card.name || card.handle)}</h1>
        <div class="note">@${esc(card.handle)}${card.city ? ` · ${esc(card.city)}` : ""}${card.joined ? ` · inscrit en ${since(card.joined)}` : ""}${me && cloud.user?.email ? ` · ${esc(cloud.user.email)}` : ""}</div>${card.bio ? `<p class="tr-bio">${esc(card.bio)}</p>` : ""}</div></div>
      <div class="pf-stats tr-stats">
        ${st ? box(st.cards, "cartes", "col") + box(st.sets, "extensions", "col") + box(`${st.dex}/1025`, "Pokédex") : `<div class="tr-private"><b>🔒</b><small>Collection privée</small></div>`}
        ${box(`<span id="tr-nf">${card.followers}</span>`, `abonné${card.followers > 1 ? "s" : ""}`, "followers")}
        ${box(card.following, `abonnement${card.following > 1 ? "s" : ""}`, "following")}
      </div>
      ${me ? `<div class="acts">${opts.own ? `<button class="pill ghost" id="tr-sett">Paramètres</button>` : `<a class="pill ghost" href="#/profil">Modifier mon profil</a>`}<button class="pill ghost" id="tr-link">Copier le lien de mon profil</button></div>`
        : `<div class="acts"><button class="pill ${card.i_follow ? "ghost" : ""}" id="tr-follow">${card.i_follow ? "Abonné ✓" : "Suivre"}</button><button class="pill ghost" id="tr-share">Partager une extension</button><button class="pill ghost" id="tr-link">Copier le lien</button></div>`}
    </div>
    <div class="seg prtabs" id="tr-tabs"><button data-t="show">Vitrine <em>${show.length}</em></button>${canSee ? `<button data-t="col">Collection</button>` : ""}<button data-t="followers">Abonnés</button><button data-t="following">Abonnements</button></div>
    <div id="tr-body"></div>
    ${opts.after ? `<h2 class="pf-sett-h" id="pf-sett">Paramètres</h2>${opts.after}` : ""}`;
  const body = $("#tr-body");
  const tabs = {
    show: () => {
      body.innerHTML = show.length ? `<div class="grid smallgrid">${show.map(c => `<div class="tile owned stile"><span class="cardimg">${c.img ? `<img src="${img(c.img, "low")}" alt="${esc(c.name)}" loading="lazy">` : ""}</span><span class="cap"><span class="nm">${esc(c.name)}</span><span class="pr">${esc(c.set || "")}</span></span></div>`).join("")}</div>`
        : `<div class="empty-state"><b>Vitrine vide</b>${me ? "Choisis tes plus belles cartes avec « Choisir ma vitrine » dans les paramètres." : `@${esc(card.handle)} n'a pas encore choisi de cartes à montrer.`}</div>`;
    },
    col: () => showCollection(body, card, me),
    followers: () => people("followers"), following: () => people("following")
  };
  const people = async dir => {
    body.innerHTML = wait();
    try { const l = await listFollows(card.id, dir); body.innerHTML = l.length ? `<div class="pf-card">${l.map(personRow).join("")}</div>` : `<div class="empty-state"><b>${dir === "followers" ? "Aucun abonné pour l'instant" : "Aucun abonnement pour l'instant"}</b></div>`; }
    catch (e) { body.innerHTML = `<div class="empty-state"><b>Liste indisponible</b>${esc(profileError(e))}</div>`; }
  };
  const select = t => { [...$("#tr-tabs").children].forEach(x => x.classList.toggle("on", x.dataset.t === t)); tabs[t](); };
  select(opts.tab && tabs[opts.tab] ? opts.tab : "show");
  $("#tr-tabs").onclick = e => { const b = e.target.closest("button"); if (b) select(b.dataset.t); };
  page.querySelectorAll(".tr-stats [data-t]").forEach(b => b.onclick = () => { select(b.dataset.t); $("#tr-tabs").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#tr-link").onclick = async () => {
    const url = location.origin + location.pathname + trainerLink(card.handle);
    try { if (navigator.share) await navigator.share({ title: `@${card.handle} sur PokéClasseur`, url }); else { await navigator.clipboard.writeText(url); toast("Lien du profil copié"); } } catch { /* cancelled */ }
  };
  const se = $("#tr-sett"); if (se) se.onclick = () => $("#pf-sett")?.scrollIntoView({ behavior: "smooth", block: "start" });
  if (me) return true;
  const f = $("#tr-follow");
  f.onclick = async () => {
    if (!hasProfile()) { toast(cloud.user ? "Choisis d'abord ton pseudo dans le Profil" : "Connecte-toi pour suivre des dresseurs"); location.hash = "#/profil"; return; }
    const on = !card.i_follow; f.disabled = true;
    try { await setFollow(card.id, on); card.i_follow = on; card.followers += on ? 1 : -1; f.textContent = on ? "Abonné ✓" : "Suivre"; f.classList.toggle("ghost", on); $("#tr-nf").textContent = card.followers; if (on) toast(`Tu suis @${card.handle}`); }
    catch (e) { toast(profileError(e)); }
    f.disabled = false;
  };
  $("#tr-share").onclick = () => pickSetToShare(card);
  return true;
}

/* ---------- a trainer's collection (read only): value, best cards, every card ---------- */
const colCache = new Map();   // user id → rows (this visit)
let colSort = "price";
async function showCollection(body, card, me) {
  body.innerHTML = wait("Chargement de la collection…");
  let rows;
  if (me) rows = Object.entries(S.COL.cards).flatMap(([id, e]) => Object.entries(e.v || {}).filter(([, n]) => n > 0).map(([v, n]) => ({ card_id: id, set_id: e.s, variant: v, qty: n, cond: e.c || null })));
  else if (colCache.has(card.id)) rows = colCache.get(card.id);
  else {
    const get = async cols => { const out = []; for (let from = 0; ; from += 1000) { const { data, error } = await cloud.supabase.from("collection_items").select(cols).eq("user_id", card.id).range(from, from + 999); if (error) throw error; out.push(...data); if (data.length < 1000) return out; } };
    try { rows = await get("card_id,variant,set_id,qty,cond").catch(e => (/cond/.test(e.message || "") ? get("card_id,variant,set_id,qty") : Promise.reject(e))); }
    catch (e) { body.innerHTML = `<div class="empty-state"><b>Collection indisponible</b>${esc(profileError(e))}</div>`; return; }
    if (!rows.length && card.stats?.cards) { body.innerHTML = `<div class="empty-state"><b>Collection pas encore lisible</b>Pour voir les cartes des autres, lance le fichier <b>0005_public_collection.sql</b> dans Supabase (SQL Editor → Run).</div>`; return; }
    colCache.set(card.id, rows);
  }
  if (!rows.length) { body.innerHTML = `<div class="empty-state"><b>Aucune carte pour l'instant</b></div>`; return; }
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
  const sorted = () => colSort === "price" ? [...items].sort((a, b) => b.unit - a.unit)
    : [...items].sort((a, b) => (b.info.date || "").localeCompare(a.info.date || "") || (parseInt(a.c.n) || 0) - (parseInt(b.c.n) || 0));
  const draw = () => {
    body.innerHTML = `<div class="tr-colhead">
        <div class="valcard"><div class="vc-lbl">${me ? "Ma collection" : `Collection de ${esc(card.name || "@" + card.handle)}`}</div><div class="vc-val">${eur(total).replace("–", "0 €")}</div>
          <div class="vc-foot"><span class="note"><b>${items.length}</b> cartes · <b>${copies}</b> exemplaires · <b>${sets.size}</b> extensions</span></div></div>
        <div class="colpeek"><div class="cp-hd2"><h2>Ses plus belles cartes</h2></div><div class="peekgrid">${top.map((x, i) => `<button class="peek" data-top="${i}" aria-label="${esc(x.c.name)}">${imgTag(x.c, "low")}${fxHTML(foilOf(x.c))}${x.unit ? `<span class="pchip">${eur(x.unit)}</span>` : ""}</button>`).join("")}</div></div>
      </div>
      <div class="seg tr-sort" id="tr-sort"><button data-s="price" class="${colSort === "price" ? "on" : ""}">Par prix</button><button data-s="set" class="${colSort === "set" ? "on" : ""}">Par extension</button></div>
      <div class="grid" id="tr-grid">${sorted().map((x, i) => `<div class="tile owned"><button class="cardimg" data-i="${i}" aria-label="${esc(x.c.name)}">${imgTag(x.c, "low")}${fxHTML(foilOf(x.c))}</button>${x.q > 1 ? `<span class="qty">×${x.q}</span>` : ""}<div class="cap"><span class="n">${esc(x.info.abbr || "")} ${esc(x.c.n || "")}</span><span class="nm">${esc(x.c.name)}</span><span class="pr">${x.unit ? eur(x.unit) : ""}</span></div></div>`).join("")}</div>`;
    const list = sorted();
    body.querySelector("#tr-grid").onclick = e => { const b = e.target.closest("[data-i]"); if (b) openViewer(list[+b.dataset.i].c); };
    body.querySelector(".peekgrid").onclick = e => { const b = e.target.closest("[data-top]"); if (b) openViewer(top[+b.dataset.top].c); };
    body.querySelector("#tr-sort").onclick = e => { const b = e.target.closest("[data-s]"); if (b) { colSort = b.dataset.s; draw(); } };
  };
  draw();
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
