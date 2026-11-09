/* Other trainers, from the "Profil" tab: search by pseudo, a trainer's public page (#/dresseur/<pseudo>),
   follow, invite to share an extension, followers / following lists. The data side is cloud/profiles.js
   (tables profiles and follows, function profile_card: supabase/migrations/0002). */
import { getProfileCard, listFollows, profileError, searchProfiles, setFollow } from "../cloud/profiles.js";
import { cloud, cloudReady, hasProfile } from "../cloud/session.js";
import { SH, shareSet } from "../cloud/shared.js";
import { img } from "../data/tcgdex.js";
import { $, ICON, esc } from "../lib/core.js";
import { setNav, toast } from "../lib/ui.js";
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

/* ---------- a trainer's page ---------- */
export async function renderTrainer(handle) {
  setNav("profil");
  const app = $("#app");
  app.innerHTML = `<section class="profile-page"><a class="crumb" href="#/profil">${ICON.back} Profil</a><div id="tr-page">${wait()}</div></section>`;
  await cloudReady();
  const page = $("#tr-page"); if (!page) return;
  if (!cloud.supabase) { page.innerHTML = `<div class="empty-state"><b>Connexion au serveur…</b>Réessaie dans un instant.</div>`; return; }
  let card;
  try { card = await getProfileCard(handle); }
  catch (e) { page.innerHTML = `<div class="empty-state"><b>Profil indisponible</b>${esc(profileError(e))}</div>`; return; }
  if (!card) { page.innerHTML = `<div class="empty-state"><b>Dresseur introuvable</b>Aucun profil @${esc(handle)}.</div>`; return; }
  if (!page.isConnected) return;
  const me = card.id === cloud.user?.id;
  const st = card.stats, show = Array.isArray(card.showcase) ? card.showcase : [];
  const box = (n, l) => `<div><b>${n}</b><small>${l}</small></div>`;
  page.innerHTML = `<div class="pf-card tr-head">
      <div class="pf-hero">${av(card, 84)}<div class="pf-id"><h1>${esc(card.name || card.handle)}</h1>
        <div class="note">@${esc(card.handle)}${card.city ? ` · ${esc(card.city)}` : ""}${card.joined ? ` · inscrit en ${since(card.joined)}` : ""}</div>${card.bio ? `<p class="tr-bio">${esc(card.bio)}</p>` : ""}</div></div>
      <div class="pf-stats tr-stats">
        ${st ? box(st.cards, "cartes") + box(st.sets, "extensions") + box(`${st.dex}/1025`, "Pokédex") : `<div class="tr-private"><b>🔒</b><small>Collection privée</small></div>`}
        <button data-t="followers"><b id="tr-nf">${card.followers}</b><small>abonné${card.followers > 1 ? "s" : ""}</small></button>
        <button data-t="following"><b>${card.following}</b><small>abonnement${card.following > 1 ? "s" : ""}</small></button>
      </div>
      ${me ? `<div class="acts"><a class="pill ghost" href="#/profil">Modifier mon profil</a></div>`
        : `<div class="acts"><button class="pill ${card.i_follow ? "ghost" : ""}" id="tr-follow">${card.i_follow ? "Abonné ✓" : "Suivre"}</button><button class="pill ghost" id="tr-share">Partager une extension</button><button class="pill ghost" id="tr-link">Copier le lien</button></div>`}
    </div>
    <div class="seg prtabs" id="tr-tabs"><button data-t="show" class="on">Vitrine <em>${show.length}</em></button><button data-t="followers">Abonnés</button><button data-t="following">Abonnements</button></div>
    <div id="tr-body"></div>`;
  const body = $("#tr-body");
  const tabs = {
    show: () => {
      body.innerHTML = show.length ? `<div class="grid smallgrid">${show.map(c => `<div class="tile owned stile"><span class="cardimg">${c.img ? `<img src="${img(c.img, "low")}" alt="${esc(c.name)}" loading="lazy">` : ""}</span><span class="cap"><span class="nm">${esc(c.name)}</span><span class="pr">${esc(c.set || "")}</span></span></div>`).join("")}</div>`
        : `<div class="empty-state"><b>Vitrine vide</b>${me ? "Choisis tes plus belles cartes depuis ta page Profil." : `@${esc(card.handle)} n'a pas encore choisi de cartes à montrer.`}</div>`;
    },
    followers: () => people("followers"), following: () => people("following")
  };
  const people = async dir => {
    body.innerHTML = wait();
    try { const l = await listFollows(card.id, dir); body.innerHTML = l.length ? `<div class="pf-card">${l.map(personRow).join("")}</div>` : `<div class="empty-state"><b>${dir === "followers" ? "Aucun abonné pour l'instant" : "Aucun abonnement pour l'instant"}</b></div>`; }
    catch (e) { body.innerHTML = `<div class="empty-state"><b>Liste indisponible</b>${esc(profileError(e))}</div>`; }
  };
  const select = t => { [...$("#tr-tabs").children].forEach(x => x.classList.toggle("on", x.dataset.t === t)); tabs[t](); };
  select("show");
  $("#tr-tabs").onclick = e => { const b = e.target.closest("button"); if (b) select(b.dataset.t); };
  page.querySelectorAll(".tr-stats [data-t]").forEach(b => b.onclick = () => select(b.dataset.t));
  if (me) return;
  const f = $("#tr-follow");
  f.onclick = async () => {
    if (!hasProfile()) { toast(cloud.user ? "Choisis d'abord ton pseudo dans le Profil" : "Connecte-toi pour suivre des dresseurs"); location.hash = "#/profil"; return; }
    const on = !card.i_follow; f.disabled = true;
    try { await setFollow(card.id, on); card.i_follow = on; card.followers += on ? 1 : -1; f.textContent = on ? "Abonné ✓" : "Suivre"; f.classList.toggle("ghost", on); $("#tr-nf").textContent = card.followers; if (on) toast(`Tu suis @${card.handle}`); }
    catch (e) { toast(profileError(e)); }
    f.disabled = false;
  };
  $("#tr-link").onclick = async () => {
    const url = location.origin + location.pathname + trainerLink(card.handle);
    try { if (navigator.share) await navigator.share({ title: `@${card.handle} sur PokéClasseur`, url }); else { await navigator.clipboard.writeText(url); toast("Lien du profil copié"); } } catch { /* cancelled */ }
  };
  $("#tr-share").onclick = () => pickSetToShare(card);
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
