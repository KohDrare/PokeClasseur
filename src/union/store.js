import { UN_DEMO_CARDS } from "../data/union-demo-cards.js";
import { $, esc } from "../lib/core.js";
import { LS } from "../lib/storage.js";
import { toast } from "../lib/ui.js";
import { sprite } from "../pages/pokedex.js";
import { S } from "../state/shared.js";

/* ================= UNION ROOM (social + marketplace + trades) =================
   Local-first: everything you post is stored on this device (localStorage + IndexedDB for photos).
   The other trainers are demo profiles so the room is not empty; a server can replace UN_STORE later. */
export const UN_KEY = "pokeclasseur-union-v1";
export const unCard = id => UN_DEMO_CARDS.find(c => c.id === id);
export const UI = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 5 6.3 5c2 0 3.3 1.1 4 2.3h3.4C14.4 6.1 15.7 5 17.7 5 21 5 22.8 8.3 21.2 11.4 19 15.6 12 20 12 20z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/></svg>',
  cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="3" width="12" height="16" rx="2"/><path d="M5 6v13a2 2 0 0 0 2 2h9"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m10 13 11-10"/></svg>',
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>'
};
export const UN_KINDS = { pull: "Mon pull", showcase: "Vitrine", wanted: "Je recherche", talk: "Discussion" };
export const UN_COND = ["Neuve (Mint)", "Quasi neuve (Near Mint)", "Excellente", "Bon état", "Jouée", "Abîmée"];
export const UN_COND_SHORT = ["MT", "NM", "EX", "GD", "LP", "PO"];

export function unSeed() {
  const H = 3600e3, D = 24 * H, now = Date.now();
  const users = {
    lea: { id: "lea", name: "Léa", handle: "lea.evoli", avatar: 133, city: "Liège", bio: "Je complète toutes les évolitions. Échanges en main propre sur Liège.", joined: now - 420 * D, verified: 2, rating: 4.9, reviews: 31, trades: 44, sales: 12, followers: 312,
      have: ["me05-117", "me05-085", "sv07-171", "me04-115"], want: ["me05-008", "me05-004", "sv08.5-155", "me05-031"] },
    mehdi: { id: "mehdi", name: "Mehdi", handle: "mehdi_dracau", avatar: 6, city: "Bruxelles", bio: "Collection Dracaufeu depuis 2002. Je vends mes doubles à prix Cardmarket.", joined: now - 900 * D, verified: 3, rating: 5.0, reviews: 87, trades: 63, sales: 140, followers: 1840,
      have: ["sv04.5-234", "me05-114", "me03-112", "me05-096"], want: ["sv03.5-199", "me05-116", "me05-008"] },
    sofia: { id: "sofia", name: "Sofia", handle: "sofia.gardevoir", avatar: 282, city: "Namur", bio: "Fan d'illustrations rares. Je trade surtout du Méga-Évolution.", joined: now - 210 * D, verified: 1, rating: 4.7, reviews: 12, trades: 19, sales: 4, followers: 158,
      have: ["me01-180", "me05-091", "me05-109"], want: ["me05-085", "me05-117", "me05-004"] },
    tom: { id: "tom", name: "Tom", handle: "tom_lucario", avatar: 448, city: "Charleroi", bio: "J'ouvre une display par semaine en live le vendredi soir.", joined: now - 120 * D, verified: 2, rating: 4.8, reviews: 22, trades: 15, sales: 38, followers: 640,
      have: ["me05-120", "me05-031", "me05-008", "sv10-199"], want: ["me05-109", "me05-114"] },
    ines: { id: "ines", name: "Inès", handle: "ines.mew", avatar: 151, city: "Mons", bio: "Mew, Mew et encore Mew. Toujours partante pour un échange équitable.", joined: now - 600 * D, verified: 2, rating: 4.9, reviews: 40, trades: 71, sales: 9, followers: 905,
      have: ["sv03.5-151", "me02.5-280", "me05-004"], want: ["me05-120", "me05-096", "me05-008"] },
    kenji: { id: "kenji", name: "Kenji", handle: "kenji.pika", avatar: 25, city: "Louvain-la-Neuve", bio: "Étudiant, je collectionne les Pikachu de toutes les langues.", joined: now - 60 * D, verified: 1, rating: 4.6, reviews: 5, trades: 6, sales: 2, followers: 77,
      have: ["sv03.5-025", "me01-005", "me05-008"], want: ["me05-117", "sv03.5-025"] }
  };
  const ref = id => { const c = unCard(id); return c ? { ...c } : null; };
  const posts = [
    { id: "d1", author: "tom", ts: now - 2 * H, kind: "pull", text: "Display Nuit Noire du vendredi : Méga-Darkrai-ex Méga Hyper Rare au 31e booster. Je tremble encore.", cards: [ref("me05-120")], likes: ["lea", "mehdi", "ines", "kenji"], comments: [{ id: "c1", author: "mehdi", ts: now - 1.5 * H, text: "Énorme, félicitations ! Tu la gardes ?" }, { id: "c2", author: "tom", ts: now - 1.2 * H, text: "Je la garde, elle va direct en toploader." }] },
    { id: "d2", author: "lea", ts: now - 5 * H, kind: "wanted", text: "Je cherche Mentali-ex (Évolutions Prismatiques). J'ai Morpeko-ex illustration spéciale et Bria à échanger, Liège ou envoi suivi.", cards: [ref("sv08.5-155")], likes: ["sofia"], comments: [] },
    { id: "d3", author: "mehdi", ts: now - 26 * H, kind: "showcase", text: "Page Dracaufeu complétée dans le classeur. Il me manque juste celle de 151 pour fermer la boucle.", cards: [ref("sv04.5-234"), ref("sv03.5-199")], likes: ["tom", "ines", "lea", "sofia", "kenji"], comments: [{ id: "c3", author: "ines", ts: now - 20 * H, text: "La 151 est magnifique, bonne chance !" }] },
    { id: "d4", author: "sofia", ts: now - 30 * H, kind: "talk", text: "Vous rangez vos Illustration rare avec la série ou dans un classeur à part ? Je n'arrive pas à me décider.", cards: [], likes: ["lea", "kenji"], comments: [{ id: "c4", author: "kenji", ts: now - 28 * H, text: "Classeur à part, c'est plus joli à feuilleter." }] },
    { id: "d5", author: "ines", ts: now - 50 * H, kind: "pull", text: "Premier booster de Héros Transcendants et Mélofée-ex de Lilie direct.", cards: [ref("me02.5-280")], likes: ["mehdi", "tom", "sofia"], comments: [] }
  ];
  const L = (id, seller, card, price, cond, h, extra = {}) => ({ id, seller, ts: now - h * H, card: ref(card), variant: "holo", condition: cond, lang: "FR", price, qty: 1, ship: { post: true, hand: true, cost: 2.5 }, city: users[seller].city, desc: "", status: "active", views: Math.round(20 + h * 3), saves: [], trade: true, ...extra });
  const listings = [
    L("l1", "mehdi", "sv04.5-234", 239, 1, 3, { desc: "Sortie du booster, directement sleevée. Envoi en toploader + enveloppe à bulles, suivi." }),
    L("l2", "tom", "me05-114", 44, 1, 8, { desc: "Pullée en live, centrage correct." }),
    L("l3", "sofia", "me01-180", 45, 0, 20, { desc: "Parfaite, jamais jouée.", trade: false }),
    L("l4", "lea", "me05-117", 49, 1, 28),
    L("l5", "ines", "sv03.5-151", 6, 2, 40, { ship: { post: true, hand: false, cost: 1.5 } }),
    L("l6", "kenji", "sv03.5-025", 0.5, 1, 70, { variant: "normal", desc: "Lot possible avec d'autres Pikachu." }),
    L("l7", "mehdi", "me03-112", 2, 1, 90, { variant: "holo" })
  ];
  return {
    v: 1,
    me: { id: "me", name: "", handle: "", avatar: 25, city: "", bio: "", joined: now, verified: 0 },
    users, posts, listings, trades: [], convos: [], follows: ["mehdi", "tom"], wish: [], blocked: [], reports: [], saved: [],
    notifs: [{ id: "n0", ts: now - H, text: "Bienvenue dans l'Union Room ! Complète ton profil pour que les autres dresseurs te reconnaissent.", link: "#/union/profile", read: false }]
  };
}
export let UN = (() => { const d = LS.get(UN_KEY, null); return d && d.v === 1 ? d : unSeed(); })();
export const unSave = () => { if (!LS.set(UN_KEY, UN)) toast("Mémoire pleine : supprime quelques photos"); };
export const unUser = id => id === "me" ? UN.me : UN.users[id];
export const unMeName = () => UN.me.name || "Toi";
export function unAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "à l'instant"; if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`; if (s < 7 * 86400) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(ts).toLocaleDateString("fr-BE", { day: "numeric", month: "short" });
}
export const unAvatar = (u, size = 44) => `<span class="uav" style="--s:${size}px"><img src="${sprite(u.avatar || 25)}" alt="" loading="lazy"></span>`;
export const unBadge = u => u.verified >= 2 ? `<span class="uvf" title="${u.verified >= 3 ? "Identité vérifiée" : "Téléphone vérifié"}">${UI.shield}</span>` : "";
export const unName = (u, link = true) => link ? `<a class="uname" href="#/union/u/${u.id}">${esc(u.id === "me" ? unMeName() : u.name)}</a>${unBadge(u)}` : `<span class="uname">${esc(u.id === "me" ? unMeName() : u.name)}</span>${unBadge(u)}`;
export const unDemoTag = u => u.id !== "me" ? `<span class="demo" title="Profil d'exemple : les vrais dresseurs arriveront quand le serveur sera branché">exemple</span>` : "";
export function unCardRefFromLocal(c, setName) { return { id: c.id, name: c.name, img: c.img, set: setName || c.setId, n: c.n, r: c.r, p: c.p || 0, dx: c.dx || [] }; }
export const unCardImg = (c, q = "low") => c && c.img ? `<img src="${c.img}/${q}.webp" alt="${esc(c.name)}" loading="lazy" onerror="cardImgErr(this)">` : `<div class="fallback">${esc(c?.name || "?")}</div>`;
export const unSetOf = id => id.slice(0, id.lastIndexOf("-"));
export function unNotify(text, link) { UN.notifs.unshift({ id: "n" + Date.now() + Math.random().toString(36).slice(2, 5), ts: Date.now(), text, link, read: false }); UN.notifs = UN.notifs.slice(0, 60); unSave(); unBellCount(); }
export function unBellCount() { const b = $("#un-bell em"); const n = UN.notifs.filter(x => !x.read).length; if (b) { b.textContent = n; b.hidden = !n; } }
export const unMyDoubles = () => Object.entries(S.COL.cards).filter(([, e]) => Object.values(e.v || {}).reduce((a, b) => a + b, 0) > 1).map(([id]) => id);
