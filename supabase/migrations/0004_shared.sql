-- PokéClasseur — phase 4 : extensions partagées entre plusieurs comptes.
-- Une extension partagée a une seule liste de cartes pour tous ses membres ; chaque carte (par version)
-- a ses propriétaires (tous les membres par défaut). Les autres extensions restent privées.
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run. Peut être relancé sans risque.

create table if not exists public.shared_sets (
  id          uuid primary key default gen_random_uuid(),
  set_id      text not null,
  owner       uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.shared_members (
  shared_id   uuid not null references public.shared_sets (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'invited' check (status in ('invited', 'active')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (shared_id, user_id)
);
create index if not exists shared_members_user on public.shared_members (user_id);

create table if not exists public.shared_items (
  shared_id   uuid not null references public.shared_sets (id) on delete cascade,
  card_id     text not null,
  variant     text not null,
  qty         int  not null check (qty between 1 and 99),
  owners      uuid[],                       -- null = tous les membres
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (shared_id, card_id, variant)
);

-- membre actif d'un partage (security definer : utilisable dans les règles sans boucle)
create or replace function public.is_shared_member(sid uuid, active_only boolean default true)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shared_members m where m.shared_id = sid and m.user_id = auth.uid()
                 and (not active_only or m.status = 'active'))
$$;
revoke all on function public.is_shared_member(uuid, boolean) from public;
grant execute on function public.is_shared_member(uuid, boolean) to authenticated;

alter table public.shared_sets    enable row level security;
alter table public.shared_members enable row level security;
alter table public.shared_items   enable row level security;

-- partages : visibles par leurs membres (et invités) ; créés par soi ; supprimés par leur créateur
drop policy if exists "shared_sets_select" on public.shared_sets;
create policy "shared_sets_select" on public.shared_sets for select to authenticated
  using (owner = auth.uid() or public.is_shared_member(id, false));
drop policy if exists "shared_sets_insert" on public.shared_sets;
create policy "shared_sets_insert" on public.shared_sets for insert to authenticated with check (owner = auth.uid());
drop policy if exists "shared_sets_delete" on public.shared_sets;
create policy "shared_sets_delete" on public.shared_sets for delete to authenticated using (owner = auth.uid());

-- membres : visibles par les membres ; un membre actif invite ; le créateur s'ajoute ;
-- chacun accepte son invitation ou quitte (supprime sa ligne)
drop policy if exists "shared_members_select" on public.shared_members;
create policy "shared_members_select" on public.shared_members for select to authenticated
  using (user_id = auth.uid() or public.is_shared_member(shared_id, false));
drop policy if exists "shared_members_insert" on public.shared_members;
create policy "shared_members_insert" on public.shared_members for insert to authenticated with check (
  public.is_shared_member(shared_id)
  or (user_id = auth.uid() and status = 'active' and exists (select 1 from shared_sets s where s.id = shared_id and s.owner = auth.uid()))
);
drop policy if exists "shared_members_update" on public.shared_members;
create policy "shared_members_update" on public.shared_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "shared_members_delete" on public.shared_members;
create policy "shared_members_delete" on public.shared_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from shared_sets s where s.id = shared_id and s.owner = auth.uid()));

-- cartes : lues et modifiées par les membres actifs
drop policy if exists "shared_items_all" on public.shared_items;
create policy "shared_items_all" on public.shared_items for all to authenticated
  using (public.is_shared_member(shared_id)) with check (public.is_shared_member(shared_id));

notify pgrst, 'reload schema';
