/* global __BUILD__ */
/* Scanner page: point the camera at a card, the app reads its set code and number and adds it to the collection. */
import { openViewer } from "../components/viewer.js";
import { PCX } from "../data/pokecardex-map.js";
import { UPCOMING, scanBase, upcomingVariants } from "../data/set-patches.js";
import { priceHint } from "../data/price-hints.js";
import { compact, getJSON, img, loadSeries, loadSet, peekSet } from "../data/tcgdex.js";
import { LS } from "../lib/storage.js";
import { codeScore } from "../scan/match.js";
import { VARIANT_LABEL, eur, priceOf } from "../features/variants.js";
import { $, API, esc } from "../lib/core.js";
import { setNav, toast } from "../lib/ui.js";
import { SETMETA } from "../pages/home.js";
import { guessCards, makeVoter, parseScan, sameNumber } from "../scan/match.js";
import { qtyOf, setQty } from "../state/collection.js";
import { S } from "../state/shared.js";
import { symHTML } from "../features/rarity.js";

let stream = null, timer = null, busy = false, paused = false, added = 0, itimer = null;
const ocrSets = new Map();   // extensions the text reader has seen (code read on the card) → when
const DEBUG = (() => { try { return localStorage.getItem("pc-scandebug") === "1"; } catch { return false; } })();

/* called by the router on every page change */
export function stopScanner() {
  clearTimeout(timer); timer = null; clearTimeout(itimer); itimer = null; paused = true;
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
}

const BOLT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>';

/* sets the scanner can recognise: official count from the series list, printed code = Pokécardex code */
function scanSets() {
  return (S.SERIES || []).flatMap(s => s.sets).map(t => ({ id: t.id, code: PCX[t.id] || SETMETA[t.id]?.a || "", official: t.official || 0, total: t.total || 0,
    date: SETMETA[t.id]?.d || (/^(sv|me|30th)/.test(t.id) ? "2023-03-31" : "") }));   // sets not opened yet: era from the id
}

/* finds the card a guess points to (one set listing + one card request, or the data already on this device) */
async function findCard(g) {
  if (g.id) {   // found by its picture: we already know the exact card
    const s = await loadSet(g.setId).catch(() => null);
    const c = s?.cards.find(x => x.id === g.id);
    if (c) return { ...c, v: c.v?.length ? c.v : ["normal"], img: c.img || scanBase(g.setId, c.n) };
  }
  const local = UPCOMING[g.setId] ? { cards: UPCOMING[g.setId].cards.map(c => ({ ...c, id: `${g.setId}-${c.n}`, setId: g.setId, v: upcomingVariants(c), p: priceHint(g.setId, c.n), ok: 1 })) } : await peekSet(g.setId);
  const known = local?.cards?.find(c => !c.linked && !c.grp && sameNumber(c.src || c.n, g.num));
  if (known?.ok && known.v?.length) return { ...known, img: known.img || scanBase(g.setId, known.n) };
  const s = await getJSON(`${API}/sets/${encodeURIComponent(g.setId)}`);
  const hit = s?.cards?.find(c => sameNumber(c.localId, g.num));
  if (!hit) return known ? { ...known, v: known.v?.length ? known.v : ["normal", "reverse"], img: known.img || scanBase(g.setId, known.n) } : null;
  const d = await getJSON(`${API}/cards/${encodeURIComponent(hit.id)}`);
  const c = d ? compact(d, g.setId) : { id: hit.id, setId: g.setId, n: hit.localId, name: hit.name, img: hit.image || "", r: "", v: ["normal"], ok: 0 };
  if (!c.v.length) c.v = ["normal"];
  if (!c.img) c.img = scanBase(g.setId, c.n);
  return c;
}
const setName = id => (S.SERIES || []).flatMap(s => s.sets).find(t => t.id === id)?.name || id;

export async function renderScan() {
  stopScanner(); paused = false; added = 0;
  setNav("scan");
  const app = $("#app");
  app.innerHTML = `<div class="wrap scanpage">
    <div class="scanhead"><h1>Scanner une carte</h1><p class="note">Place la carte dans le cadre : l'app la reconnaît à son image, ou à son code et son numéro (par ex. « DLR 084/103 »). L'extension est trouvée toute seule.</p></div>
    <div class="scanbox" id="scanbox">
      <video id="scanvid" playsinline muted autoplay></video>
      <div class="scanframe" id="scanframe"><span class="zone"></span></div>
      <div class="scanstate" id="scanstate">Démarrage de la caméra…</div>
      <button class="iconbtn torch" id="scantorch" hidden aria-label="Lampe">${BOLT}</button>
    </div>
    <div class="scanbar">
      <form class="manual" id="scanmanual"><input id="scanq" placeholder="Ou tape le code et le numéro : DLR 084" autocomplete="off" autocapitalize="characters"><button class="pill">Chercher</button></form>
      <span class="note" id="scancount"></span>
    </div>
    <div class="scaninfo" id="scaninfo"></div>
    <div id="scanresult"></div>
    <p class="note scanver">Version du ${new Date(__BUILD__).toLocaleString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
  </div>`;
  $("#scanmanual").onsubmit = e => { e.preventDefault(); const t = $("#scanq").value.trim(); if (t) lookup(t, true); };

  import("../scan/ocr.js").then(m => m.getReaders()).catch(() => {});   // start the readers now, while the camera opens
  if (!S.SERIES?.length) { try { S.SERIES = await loadSeries(); } catch { /* the manual search will say so */ } }
  if (!navigator.mediaDevices?.getUserMedia) { state("Caméra indisponible ici. Tu peux taper le code et le numéro ci-dessous.", "bad"); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } }, audio: false });
  } catch (e) {
    state(e.name === "NotAllowedError" ? "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, ou tape le code ci-dessous." : "Impossible d'ouvrir la caméra. Tu peux taper le code et le numéro ci-dessous.", "bad");
    return;
  }
  if (!location.hash.startsWith("#/scan")) { stopScanner(); return; }   // left the page meanwhile
  const video = $("#scanvid"); video.srcObject = stream; await video.play().catch(() => {});
  const track = stream.getVideoTracks()[0], caps = track.getCapabilities?.() || {};
  if (caps.focusMode?.includes("continuous")) track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
  if (caps.torch) { const b = $("#scantorch"); b.hidden = false; let on = false; b.onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}); b.classList.toggle("on", on); }; }
  state("Chargement de la lecture…");
  prepare(candidateSets());
  startLoop();
  startPictureLoop();
}

/* which extensions the picture matcher compares with, found by itself: the last one scanned, the newest one,
   the ones you added cards from lately, and any whose code the text reader saw on the card */
function recentOwnedSets() {
  const out = [];
  for (const e of Object.values(S.COL.cards || {}).filter(e => e.t).sort((a, b) => b.t - a.t)) { if (!out.includes(e.s)) out.push(e.s); if (out.length >= 2) break; }
  return out;
}
function newestSet() {
  const all = (S.SERIES || []).flatMap(se => se.sets).filter(t => (SETMETA[t.id]?.d || "") <= new Date().toISOString().slice(0, 10));
  return all.sort((a, b) => (SETMETA[b.id]?.d || "").localeCompare(SETMETA[a.id]?.d || ""))[0]?.id;
}
function candidateSets() {
  // a set whose code was just read on the card comes first
  const seen = [...ocrSets.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0]);
  const ids = [...seen.slice(0, 2), LS.get("pc-scanlast", ""), newestSet(), ...recentOwnedSets(), ...seen.slice(2)];
  return [...new Set(ids.filter(Boolean))].slice(0, 5);
}
const ready = new Map();   // setId → prints
const progress = new Map();   // setId → % while preparing, or "err"
function showPictureState() {
  const el = $("#scaninfo"); if (!el) return;
  const ids = candidateSets();
  el.innerHTML = ids.length ? `<b>Reconnaissance par l'image</b> ${ids.map(id => {
    const p = ready.has(id) ? (ready.get(id).length ? "✓" : "indisponible") : progress.get(id) === "err" ? "indisponible" : `${progress.get(id) || 0} %`;
    return `<span class="${ready.get(id)?.length ? "ok" : ""}">${esc(setName(id))} ${p}</span>`;
  }).join("")}` : `<b>Reconnaissance par l'image</b> <span>recherche de l'extension…</span>`;
}
function prepare(ids) {
  // every extension at the same time: the one you need is never stuck behind another
  return Promise.all(ids.map(async id => {
    if (ready.has(id) || progress.has(id)) return;
    progress.set(id, 0); showPictureState();
    try {
      const { setPrints } = await import("../scan/imgmatch.js");
      const pr = await setPrints(id, (k, n) => { const v = Math.round(k / n * 100); if (v !== progress.get(id)) { progress.set(id, v); if (v % 5 === 0) showPictureState(); } });
      ready.set(id, pr); progress.delete(id);
    } catch { progress.set(id, "err"); }
    showPictureState();
  }));
}
/* picture loop: several times a second, much faster than reading the text */
function startPictureLoop() {
  const video = $("#scanvid");
  let last = null, streak = 0, lastIds = "", warned = false;
  const tick = async () => {
    if (paused || !stream) return;
    try {
      const ids = candidateSets();
      if (ids.join() !== lastIds) { lastIds = ids.join(); showPictureState(); }
      prepare(ids);
      const sets = ids.filter(id => ready.has(id)).map(id => ({ setId: id, prints: ready.get(id) }));
      if (sets.length && video?.videoWidth) {
        const { matchFrame } = await import("../scan/imgmatch.js");
        const { frameInVideo } = await import("../scan/ocr.js");
        const m = matchFrame(video, frameInVideo(video, $("#scanframe")), sets);
        if (DEBUG && m) console.log("[scan] picture:", m.id, m.d.toFixed(3), "gap", m.gap.toFixed(3));
        // reflections of a shiny card are left out of the comparison (imgmatch), so a slightly looser rule is safe
        // (a reverse is often recognised by its artwork only: closer scores, so a second rule for those)
        const good = m && ((m.d < 0.5 && m.gap > 0.12) || (m.d < 0.42 && m.gap > 0.06));
        const shine = m && m.glare > 0.2 && !good;
        if (shine) state("Reflet sur la carte : incline-la un peu pour éviter la lumière", "warn");
        else if (warned) state("Cherche la carte…");
        warned = shine;
        streak = good && last === m.id ? streak + 1 : good ? 1 : 0;
        last = good ? m.id : null;
        if (streak >= 2 && !paused) {   // the same card on two frames in a row
          const num = +(String(m.n).match(/(\d+)$/)?.[1] || 0);
          await show([], { setId: m.setId, id: m.id, num });
          return;
        }
      }
    } catch (e) { if (DEBUG) console.warn("[scan] picture", e); }
    if (!paused) itimer = setTimeout(tick, 120);
  };
  tick();
}

function state(txt, cls = "") { const s = $("#scanstate"); if (s) { s.textContent = txt; s.className = "scanstate " + cls; } }

/* manual search: "DLR 084", "dlr84", "084/103", "MEP 088" */
async function lookup(text, manual) {
  const t = text.toUpperCase().replace(/([A-Z])(\d)/g, "$1 $2").replace(/(\d) ?\/ ?(\d)/g, "$1/$2");
  const guesses = guessCards(parseScan(t + " " + t.replace(/\b(\d{1,2})\b/g, m => m.padStart(3, "0"))), scanSets());
  if (!guesses.length) { toast(manual ? "Rien trouvé : essaie « DLR 084 » ou « 084/103 »" : "Carte non reconnue"); return; }
  paused = true; clearTimeout(timer);
  await show(guesses.slice(1, 5), guesses[0]);
}

async function show(others, g) {
  paused = true; clearTimeout(timer); clearTimeout(itimer);
  LS.set("pc-scanlast", g.setId);
  state("Carte trouvée !", "good");
  const box = $("#scanresult");
  box.innerHTML = `<div class="scancard loading">Recherche de la carte…</div>`;
  // the camera view makes room for the card: it shows at the top of the page, nothing to scroll
  document.querySelector(".scanpage")?.classList.add("found");
  scrollTo({ top: 0 });
  let c;
  try { c = await findCard(g); } catch { c = null; }
  if (!c) { box.innerHTML = `<div class="scancard"><p class="note">Je n'ai pas trouvé la carte n° ${g.num} dans ${esc(setName(g.setId))}.</p><div class="acts"><button class="pill" id="sc-next">Scanner une autre carte</button></div></div>`; $("#sc-next").onclick = resume; return; }
  const draw = () => {
    box.innerHTML = `<div class="scancard">
      <div class="scimg">${c.img ? `<img src="${img(c.img, "high")}" alt="${esc(c.name)}" onerror="cardImgErr(this)">` : `<div class="fallback">${esc(c.name)}</div>`}</div>
      <div class="scinfo">
        <div class="note">${esc(setName(c.setId))} · n° ${esc(c.n)}</div>
        <h2>${esc(c.name)}</h2>
        <div class="note">${c.r ? `${symHTML(c.r)} ${esc(c.r)}` : ""}${priceOf(c, c.v[0]) ? ` · ${eur(priceOf(c, c.v[0]))}` : ""}</div>
        <div class="scvars">${c.v.map(v => `<div class="scvar"><span>${esc(VARIANT_LABEL[v] || v)}</span><button class="iconbtn" data-v="${v}" data-d="-1" aria-label="Retirer">−</button><b>${qtyOf(c.id, v)}</b><button class="pill sm" data-v="${v}" data-d="1">+ Ajouter</button></div>`).join("")}</div>
        <div class="acts"><button class="pill" id="sc-next">Scanner la suivante</button><a class="pill ghost" href="#/set/${encodeURIComponent(c.setId)}">Voir l'extension</a></div>
        ${others.length ? `<details class="others"><summary>Ce n'est pas la bonne carte ?</summary>${others.map((o, i) => `<button class="linkbtn" data-o="${i}">${esc(setName(o.setId))} · n° ${o.num}</button>`).join("")}</details>` : ""}
      </div></div>`;
    box.querySelectorAll("[data-d]").forEach(b => b.onclick = () => {
      const v = b.dataset.v, d = +b.dataset.d, q = qtyOf(c.id, v);
      if (d < 0 && !q) return;
      setQty(c, v, q + d); added += d;
      if (d > 0) toast(`${c.name} ajoutée (${(VARIANT_LABEL[v] || v).toLowerCase()})`);
      $("#scancount").textContent = added > 0 ? `${added} carte${added > 1 ? "s" : ""} ajoutée${added > 1 ? "s" : ""} pendant ce scan` : "";
      draw();
    });
    const im = box.querySelector(".scimg img"); if (im) im.onclick = () => openViewer(c);
    box.querySelectorAll("[data-o]").forEach(b => b.onclick = () => show(others.filter((_, i) => i !== +b.dataset.o), others[+b.dataset.o]));
    $("#sc-next").onclick = resume;
  };
  draw();
}

function resume() {
  $("#scanresult").innerHTML = "";
  document.querySelector(".scanpage")?.classList.remove("found");
  if (!stream) { state("Caméra arrêtée : recharge la page pour la relancer.", "bad"); return; }
  paused = false; state("Cherche la carte…");
  scrollTo({ top: 0 });
  startLoop();
  startPictureLoop();
}
/* reading loop: one frame at a time, a card is shown once the reading is sure */
function startLoop() {
  const video = $("#scanvid");
  if (!video) return;
  const voter = makeVoter();
  const tick = async () => {
    if (paused || !stream) return;
    if (!busy && video.videoWidth) {
      busy = true;
      try {
        const { readFrame, frameInVideo } = await import("../scan/ocr.js");
        const t0 = performance.now();
        const texts = await readFrame(video, frameInVideo(video, $("#scanframe")));
        const sets = scanSets();
        // each clean-up is one reading; a card is sure when two readings agree (the same frame read two ways, or two frames)
        let sure = null, guesses = [];
        for (const text of texts) {
          const parsed = parseScan(text);
          for (const st of sets) if (st.code?.length >= 3 && parsed.words.some(w => codeScore(w, st.code) >= 2)) ocrSets.set(st.id, Date.now());
          const g = guessCards(parsed, sets);
          if (!guesses.length) guesses = g;
          sure = sure || voter.add(g);
        }
        if (!guesses.length) guesses = guessCards(parseScan(texts.join("\n")), sets);
        if (DEBUG) console.log("[scan] read:", JSON.stringify(texts.join(" | ")), "→", guesses.slice(0, 3).map(x => x.setId + " " + x.num).join(", "), Math.round(performance.now() - t0) + " ms");
        if (sure && !paused) { voter.reset(); busy = false; await show(guesses.filter(x => x.setId !== sure.setId || x.num !== sure.num).slice(0, 4), sure); return; }
        if (!paused) state(guesses.length ? "Je crois voir une carte, garde-la immobile…" : "Cherche la carte…");
      } catch (e) {
        console.warn("[scan]", e);
        state("La lecture n'a pas pu démarrer. Vérifie ta connexion puis recharge la page.", "bad");
        busy = false; paused = true; return;
      }
      busy = false;
    }
    if (!paused) timer = setTimeout(tick, 40);
  };
  tick();
}
