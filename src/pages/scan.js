/* Scanner page: point the camera at a card, the app reads its set code and number and adds it to the collection. */
import { PCX } from "../data/pokecardex-map.js";
import { UPCOMING, scanBase, upcomingVariants } from "../data/set-patches.js";
import { compact, getJSON, img, loadSeries, peekSet } from "../data/tcgdex.js";
import { VARIANT_LABEL, eur, priceOf } from "../features/variants.js";
import { $, API, esc } from "../lib/core.js";
import { setNav, toast } from "../lib/ui.js";
import { SETMETA } from "../pages/home.js";
import { guessCards, makeVoter, parseScan, sameNumber } from "../scan/match.js";
import { qtyOf, setQty } from "../state/collection.js";
import { S } from "../state/shared.js";
import { symHTML } from "../features/rarity.js";

let stream = null, timer = null, busy = false, paused = false, added = 0;
const DEBUG = (() => { try { return localStorage.getItem("pc-scandebug") === "1"; } catch { return false; } })();

/* called by the router on every page change */
export function stopScanner() {
  clearTimeout(timer); timer = null; paused = true;
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
  const local = UPCOMING[g.setId] ? { cards: UPCOMING[g.setId].cards.map(c => ({ ...c, id: `${g.setId}-${c.n}`, setId: g.setId, v: upcomingVariants(c), ok: 1 })) } : await peekSet(g.setId);
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
    <div class="scanhead"><h1>Scanner une carte</h1><p class="note">Place la carte dans le cadre, bien à plat et nette en bas : l'app lit le code de l'extension et le numéro (par ex. « DLR 084/103 »).</p></div>
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
    <div id="scanresult"></div>
  </div>`;
  $("#scanmanual").onsubmit = e => { e.preventDefault(); const t = $("#scanq").value.trim(); if (t) lookup(t, true); };

  if (!S.SERIES?.length) { try { S.SERIES = await loadSeries(); } catch { /* the manual search will say so */ } }
  if (!navigator.mediaDevices?.getUserMedia) { state("Caméra indisponible ici. Tu peux taper le code et le numéro ci-dessous.", "bad"); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  } catch (e) {
    state(e.name === "NotAllowedError" ? "Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, ou tape le code ci-dessous." : "Impossible d'ouvrir la caméra. Tu peux taper le code et le numéro ci-dessous.", "bad");
    return;
  }
  if (!location.hash.startsWith("#/scan")) { stopScanner(); return; }   // left the page meanwhile
  const video = $("#scanvid"); video.srcObject = stream; await video.play().catch(() => {});
  const track = stream.getVideoTracks()[0], caps = track.getCapabilities?.() || {};
  if (caps.torch) { const b = $("#scantorch"); b.hidden = false; let on = false; b.onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }).catch(() => {}); b.classList.toggle("on", on); }; }
  state("Chargement de la lecture…");
  startLoop();
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
  paused = true; clearTimeout(timer);
  state("Carte trouvée !", "good");
  const box = $("#scanresult");
  box.innerHTML = `<div class="scancard loading">Recherche de la carte…</div>`;
  box.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
    box.querySelectorAll("[data-o]").forEach(b => b.onclick = () => show(others.filter((_, i) => i !== +b.dataset.o), others[+b.dataset.o]));
    $("#sc-next").onclick = resume;
  };
  draw();
}

function resume() {
  $("#scanresult").innerHTML = "";
  if (!stream) { state("Caméra arrêtée : recharge la page pour la relancer.", "bad"); return; }
  paused = false; state("Cherche le bas de la carte…");
  scrollTo({ top: 0, behavior: "smooth" });
  startLoop();
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
        const text = await readFrame(video, frameInVideo(video, $("#scanframe")));
        const guesses = guessCards(parseScan(text), scanSets());
        if (DEBUG) console.log("[scan] read:", JSON.stringify(text), "→", guesses.slice(0, 3).map(x => x.setId + " " + x.num).join(", "));
        const sure = voter.add(guesses);
        if (sure && !paused) { voter.reset(); busy = false; await show(guesses.filter(x => x !== sure).slice(0, 4), sure); return; }
        state(guesses.length ? "Je crois voir une carte, garde-la immobile…" : "Cherche le bas de la carte…");
      } catch (e) {
        console.warn("[scan]", e);
        state("La lecture n'a pas pu démarrer. Vérifie ta connexion puis recharge la page.", "bad");
        busy = false; paused = true; return;
      }
      busy = false;
    }
    if (!paused) timer = setTimeout(tick, 250);
  };
  tick();
}
