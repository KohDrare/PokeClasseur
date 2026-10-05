/* ---------- storage ---------- */
export const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } }
};
/* IndexedDB cache with a memory fallback: on some iPhones (Safari, private mode, home-screen apps)
   IndexedDB never answers, so every call is raced against a timeout and the app keeps working without it */
export const idb = (() => {
  const mem = new Map();
  let dbp = null, broken = !("indexedDB" in window);
  const withTimeout = (pr, ms) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error("idb timeout")), ms))]);
  const open = () => dbp || (dbp = withTimeout(new Promise((res, rej) => {
    let r; try { r = indexedDB.open("pokeclasseur", 1); } catch (e) { rej(e); return; }
    r.onupgradeneeded = () => { try { r.result.createObjectStore("kv"); } catch {} };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error("blocked"));
  }), 2500).catch(e => { broken = true; throw e; }));
  const tx = async (mode, fn) => {
    if (broken) throw new Error("idb off");
    const db = await open();
    return withTimeout(new Promise((res, rej) => { const t = db.transaction("kv", mode); const q = fn(t.objectStore("kv")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }), 3000);
  };
  return {
    get: async k => { if (mem.has(k)) return mem.get(k); try { const v = await tx("readonly", s => s.get(k)); if (v !== undefined) mem.set(k, v); return v; } catch { return undefined; } },
    set: async (k, v) => { mem.set(k, v); try { await tx("readwrite", s => s.put(v, k)); } catch {} }
  };
})();

/* collection: { cards: { cardId: { s: setId, v: { normal: 1, reverse: 2 } } }, updated } */
