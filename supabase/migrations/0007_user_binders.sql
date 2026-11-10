-- PokéClasseur — phase 7 : tes classeurs synchronisés entre tes appareils.
-- Une ligne par compte avec tous tes classeurs (privée : seul toi peux la lire et la modifier).
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run. Peut être relancé sans risque.

create table if not exists public.user_binders (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_binders enable row level security;
drop policy if exists user_binders_own on public.user_binders;
create policy user_binders_own on public.user_binders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.user_binders to authenticated;

notify pgrst, 'reload schema';
