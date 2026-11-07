/* 3D card: the card leans toward the mouse or the finger, and on a phone it stays "upright in space":
   tilt the phone and the card leans the other way, as if only the phone moved.
   Sets transform + --mx/--my (foil) + --gx/--gy (glare) on the element. */

const MAX = 18;   // degrees
let motionAsked = false, motionOK = null;   // iPhone asks once per visit, from a tap

/* iPhone / iPad: motion needs a permission asked during a tap. Call it straight from the click handler. */
export function askMotion() {
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) { motionOK = false; return; }
  if (typeof DOE.requestPermission !== "function") { motionOK = true; return; }   // Android, others: nothing to ask
  if (motionAsked) return;
  motionAsked = true;
  DOE.requestPermission().then(r => {
    motionOK = r === "granted";
    try { localStorage.setItem("pc-motion", motionOK ? "1" : "0"); } catch { /* private mode */ }
  }).catch(() => { motionAsked = false; });   // not from a tap: try again at the next one
}

/* iPhone forgets the motion permission every time the site is reopened, and it can only be asked during a tap.
   Once you have said yes, it is asked again silently at your very first tap anywhere in the app
   (iOS answers straight away when it still remembers, or shows its short prompt once). */
try {
  if (localStorage.getItem("pc-motion") === "1" && typeof window.DeviceOrientationEvent?.requestPermission === "function") {
    const first = () => { removeEventListener("touchend", first, true); removeEventListener("click", first, true); askMotion(); };
    addEventListener("touchend", first, true);
    addEventListener("click", first, true);
  }
} catch { /* no storage */ }

export function attachTilt(el, { gyro = true } = {}) {
  let tx = 0, ty = 0, rx = 0, ry = 0, raf = 0, base = null, lastPointer = 0, alive = true;
  const paint = () => {
    raf = 0;
    rx += (tx - rx) * 0.18; ry += (ty - ry) * 0.18;   // smooth
    el.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    const mx = 50 + ry / MAX * 45, my = 50 - rx / MAX * 45;   // light follows the tilt
    el.style.setProperty("--mx", mx.toFixed(1) + "%"); el.style.setProperty("--my", my.toFixed(1) + "%");
    el.style.setProperty("--gx", mx.toFixed(1) + "%"); el.style.setProperty("--gy", my.toFixed(1) + "%");
    if (Math.abs(tx - rx) > 0.05 || Math.abs(ty - ry) > 0.05) raf = requestAnimationFrame(paint);
  };
  const aim = (x, y) => { tx = Math.max(-MAX, Math.min(MAX, x)); ty = Math.max(-MAX, Math.min(MAX, y)); if (!raf) raf = requestAnimationFrame(paint); };

  // mouse / finger on the card
  const move = e => {
    if (el.dataset.notilt) return;
    const b = el.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width - 0.5, py = (e.clientY - b.top) / b.height - 0.5;
    lastPointer = Date.now();
    el.classList.add("touching");
    aim(-py * 2 * MAX, px * 2 * MAX);
  };
  const leave = () => { el.classList.remove("touching"); aim(0, 0); };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerleave", leave);
  el.addEventListener("pointerup", e => { if (e.pointerType !== "mouse") leave(); });
  el.addEventListener("pointercancel", leave);

  // phone motion: the card counter-rotates (relative to how the phone was held when it opened)
  const orient = e => {
    if (!alive || el.dataset.notilt || e.beta == null || Date.now() - lastPointer < 800) return;
    if (!base) base = { b: e.beta, g: e.gamma };
    let db = e.beta - base.b, dg = e.gamma - base.g;
    // slowly re-centre so a new holding angle becomes the rest position
    base.b += db * 0.01; base.g += dg * 0.01;
    el.classList.add("touching");
    aim(db * 0.9, -dg * 0.9);
  };
  if (gyro && window.DeviceOrientationEvent && motionOK !== false) addEventListener("deviceorientation", orient);

  return () => { alive = false; cancelAnimationFrame(raf); removeEventListener("deviceorientation", orient); };
}
