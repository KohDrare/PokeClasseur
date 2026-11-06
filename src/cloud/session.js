/* Shared cloud state, tiny on purpose so any page can read it without loading Supabase.
   account.js fills it in; pages listen for "cloud:changed" to redraw. */
import { cloudEnabled } from "./config.js";

export const cloud = {
  enabled: cloudEnabled,
  ready: false,        // true once we know whether someone is signed in
  supabase: null,      // Supabase client, once loaded
  user: null,          // signed-in user, or null
  profile: null        // that user's row in "profiles", or null while loading
};

export function setCloud(patch) {
  Object.assign(cloud, patch);
  dispatchEvent(new CustomEvent("cloud:changed"));
}

/* resolves once the sign-in state is known (immediately when the cloud is off) */
export function cloudReady() {
  if (!cloud.enabled || cloud.ready) return Promise.resolve(cloud);
  return new Promise(res => addEventListener("cloud:changed", function h() { if (cloud.ready) { removeEventListener("cloud:changed", h); res(cloud); } }));
}

/* a "real" profile: signed in and a pseudo chosen */
export const hasProfile = () => !!(cloud.user && cloud.profile && cloud.profile.handle);
