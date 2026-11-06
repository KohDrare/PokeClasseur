/* Card scanner, matching part (no camera, no DOM: unit-tested).
   The bottom-left of a recent card reads like "J DLR FR 084/103": regulation mark, set code, language,
   number / official count. Text recognition is imperfect, so:
   - the "number / count" pair is the main key (a count only fits a few sets);
   - the set code, read approximately, decides between those sets;
   - promos have no count ("MEP FR 088"): they need the code. */

// characters the reader confuses on these small fonts
const LOOK = { I: "1", L: "1", "|": "1", T: "1", O: "0", Q: "0", D: "0", S: "5", B: "8", Z: "2", G: "6" };
const fold = s => s.toUpperCase().split("").map(ch => LOOK[ch] || ch).join("");

/* all "number/count" pairs, set-code-like words and bare numbers found in the read text */
export function parseScan(text) {
  const t = (text || "").toUpperCase().replace(/[\\|]/g, "/");
  const pairs = [], seen = new Set();
  for (const m of t.matchAll(/(?<![0-9])([0-9]{1,3}) ?\/ ?([0-9]{2,3})(?![0-9])/g)) {
    const num = +m[1], den = +m[2], k = num + "/" + den;
    if (num > 0 && den >= 10 && !seen.has(k)) { seen.add(k); pairs.push({ num, den, short: m[1].length < m[2].length }); }
  }
  const words = [...new Set((t.match(/\b[A-Z0-9]{2,4}\b/g) || []).filter(w => /[A-Z]/.test(w)))];
  // 3-digit numbers that are not part of a "number/count" pair (promos print "MEP FR 088")
  const bare = [...new Set((t.replace(/[0-9]{1,3} ?\/ ?[0-9]{2,3}/g, " ").match(/(?<![0-9])[0-9]{3}(?![0-9])/g) || []).map(Number))].filter(n => n > 0);
  return { pairs, words, bare };
}

/* how well a word read on the card matches a set code: 3 exact, 2 after folding look-alike characters, 1 one letter off */
export function codeScore(word, code) {
  if (!word || !code) return 0;
  const w = word.toUpperCase(), c = code.toUpperCase();
  if (w === c) return 3;
  if (fold(w) === fold(c)) return 2;
  if (w.length === c.length && [...w].filter((ch, i) => fold(ch) !== fold(c[i])).length === 1) return 1;
  return 0;
}

/* sets: [{ id, code, official, total, date }] ; returns guesses, best first: [{ setId, num, score, why }] */
export function guessCards(parsed, sets) {
  const out = [];
  const bestCode = set => Math.max(0, ...parsed.words.map(w => codeScore(w, set.code)));
  for (const { num, den, short } of parsed.pairs) {
    for (const s of sets) {
      if (!s.official || s.official !== den) continue;
      // since Écarlate et Violet (2023) numbers are always printed with 3 digits: "08/084" is a misread of 088
      if (short && s.date >= "2023") continue;
      if (num > (s.total || s.official) + 5) continue;   // a number past the end of the set is a misread
      const c = bestCode(s);
      out.push({ setId: s.id, num, score: 10 + c * 4 + (s.date ? Date.parse(s.date) / 1e12 : 0), why: c ? "code+numéro" : "numéro" });
    }
  }
  // promos and cards without a count: only with a set code read clearly
  if (!out.length) {
    for (const s of sets) {
      const c = bestCode(s);
      if (c < 2 || (s.code || "").length < 3) continue;   // 2-letter codes are too easy to "see" in random text
      for (const num of parsed.bare) if (num <= (s.total || 999)) out.push({ setId: s.id, num, score: 5 + c, why: "code" });
    }
  }
  const uniq = new Map();
  for (const g of out.sort((a, b) => b.score - a.score)) { const k = g.setId + "#" + g.num; if (!uniq.has(k)) uniq.set(k, g); }
  return [...uniq.values()];
}

/* the live scanner reads several frames: a guess is trusted only when the same card comes back
   (one misread digit, like 088 read as 008, rarely happens twice the same way) */
export function makeVoter(need = 2, keep = 6) {
  let recent = [];
  return {
    add(guesses) {
      const top = guesses[0];
      recent.push(top ? top.setId + "#" + top.num : "");
      if (recent.length > keep) recent.shift();
      if (!top) return null;
      const k = top.setId + "#" + top.num;
      return recent.filter(x => x === k).length >= need ? top : null;
    },
    reset() { recent = []; }
  };
}

/* "084" / "84" / "SWSH074": the card's number as written in TCGdex ids, from a number read on the card */
export const sameNumber = (localId, num) => { const m = /(\d+)$/.exec(localId || ""); return !!m && +m[1] === num; };
