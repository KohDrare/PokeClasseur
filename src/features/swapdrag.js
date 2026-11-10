/* Hold a card (long press on a touch screen, or drag with the mouse) and drop it on another one: they swap places.
   box: the grid; items are its children with data-i; onSwap(i, j). Returns a function that removes the listeners. */
export function swapDrag(box, onSwap) {
  let p0 = null, drag = null, timer = 0, auto = 0, iv = 0;
  const cell = i => box.querySelector(`[data-i="${i}"]`);
  const start = (i, x, y) => {
    const n = cell(i); if (!n) return;
    const r = n.getBoundingClientRect(), g = n.cloneNode(true);
    g.classList.add("sw-ghost"); g.removeAttribute("data-i");
    Object.assign(g.style, { width: r.width + "px", height: r.height + "px", left: r.left + "px", top: r.top + "px" });
    document.body.append(g);
    drag = { i, g, dx: x - r.left, dy: y - r.top, over: null };
    n.classList.add("sw-hole"); navigator.vibrate?.(15);
    iv = setInterval(() => { if (auto) scrollBy(0, auto); }, 16);
  };
  const move = (x, y) => {
    drag.g.style.left = x - drag.dx + "px"; drag.g.style.top = y - drag.dy + "px";
    const t = document.elementFromPoint(x, y)?.closest("[data-i]");
    const j = t && box.contains(t) && +t.dataset.i !== drag.i ? +t.dataset.i : null;
    if (j !== drag.over) { box.querySelector(".sw-target")?.classList.remove("sw-target"); drag.over = j; if (j != null) cell(j)?.classList.add("sw-target"); }
    auto = y < 80 ? -10 : y > innerHeight - 110 ? 10 : 0;
  };
  const end = () => {
    clearTimeout(timer); p0 = null;
    if (!drag) return;
    const { i, over, g } = drag; drag = null; auto = 0; clearInterval(iv);
    g.remove(); cell(i)?.classList.remove("sw-hole"); box.querySelector(".sw-target")?.classList.remove("sw-target");
    box.dataset.dragged = "1"; setTimeout(() => delete box.dataset.dragged, 60);
    if (over != null) { navigator.vibrate?.(10); onSwap(i, over); }
  };
  const down = e => {
    const s = e.target.closest("[data-i]"); if (!s || !box.contains(s)) return;
    p0 = { x: e.clientX, y: e.clientY, i: +s.dataset.i };
    if (e.pointerType === "mouse") { e.preventDefault(); return; }
    clearTimeout(timer); timer = setTimeout(() => { if (p0) start(p0.i, p0.x, p0.y); }, 280);
  };
  const mv = e => {
    if (drag) { move(e.clientX, e.clientY); return; }
    if (!p0) return;
    const d = Math.hypot(e.clientX - p0.x, e.clientY - p0.y);
    if (e.pointerType === "mouse" && d > 4) { start(p0.i, p0.x, p0.y); if (drag) move(e.clientX, e.clientY); }
    else if (e.pointerType !== "mouse" && d > 10) { clearTimeout(timer); p0 = null; }   // a scroll
  };
  const tm = e => { if (drag) e.preventDefault(); };
  const cm = e => e.preventDefault();
  box.addEventListener("pointerdown", down);
  box.addEventListener("touchmove", tm, { passive: false });
  box.addEventListener("contextmenu", cm);
  addEventListener("pointermove", mv); addEventListener("pointerup", end); addEventListener("pointercancel", end);
  return () => {
    end();
    box.removeEventListener("pointerdown", down); box.removeEventListener("touchmove", tm); box.removeEventListener("contextmenu", cm);
    removeEventListener("pointermove", mv); removeEventListener("pointerup", end); removeEventListener("pointercancel", end);
  };
}
