-- PokéClasseur : base complète (0001 + 0002 + 0003 + 0004) en une fois. Supabase → SQL Editor → coller → Run.
-- Peut être relancé sans risque : ne supprime aucune donnée.

-- ===== 0001_init.sql =====
-- PokéClasseur — schéma initial (phase 1 : comptes + collection dans le cloud)
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run.
-- Peut être relancé sans risque : il ne supprime aucune donnée.

-- ---------------------------------------------------------------------------
-- Profils : un par compte, créé automatiquement à l'inscription
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      text unique check (handle ~ '^[a-z0-9._]{3,24}$'),
  name        text check (char_length(name) <= 40),
  avatar      int  default 25,
  city        text check (char_length(city) <= 60),
  bio         text check (char_length(bio) <= 280),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- tout utilisateur connecté peut voir les profils (Union Room) ; chacun ne modifie que le sien
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Collection : une ligne par carte et par version (normale, reverse, holo…)
-- ---------------------------------------------------------------------------
create table if not exists public.collection_items (
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  card_id     text not null,                -- id TCGdex, ex. "me05-001"
  variant     text not null check (variant in ('normal','holo','reverse','firstEdition','wPromo')),
  set_id      text not null,                -- ex. "me05"
  qty         int  not null check (qty between 1 and 999),
  dex_ids     int[] not null default '{}',  -- numéros de Pokédex (pour le Pokédex)
  updated_at  timestamptz not null default now(),
  primary key (user_id, card_id, variant)
);
create index if not exists collection_items_user_set on public.collection_items (user_id, set_id);

alter table public.collection_items enable row level security;
drop policy if exists "collection_own_all" on public.collection_items;
create policy "collection_own_all" on public.collection_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Achats de produits scellés (boosters, displays, coffrets…)
-- ---------------------------------------------------------------------------
create table if not exists public.purchases (
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  id          text not null,                -- id généré par l'app
  set_id      text not null,
  type        text not null,
  name        text not null check (char_length(name) <= 90),
  qty         int  not null check (qty between 1 and 999),
  opened      int  not null default 0 check (opened >= 0 and opened <= qty),
  bpp         int  not null default 0 check (bpp between 0 and 99),   -- boosters par unité
  price       numeric(10,2) not null default 0 check (price >= 0),    -- prix payé par unité
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists purchases_user_set on public.purchases (user_id, set_id);

alter table public.purchases enable row level security;
drop policy if exists "purchases_own_all" on public.purchases;
create policy "purchases_own_all" on public.purchases
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists collection_touch on public.collection_items;
create trigger collection_touch before update on public.collection_items for each row execute function public.touch_updated_at();
drop trigger if exists purchases_touch on public.purchases;
create trigger purchases_touch before update on public.purchases for each row execute function public.touch_updated_at();

-- ===== 0002_profiles_social.sql =====
-- PokéClasseur — profils publics et abonnements (phase 2 : la Union Room devient un vrai réseau)
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run.
-- Peut être relancé sans risque : il ne supprime aucune donnée.

-- ---------------------------------------------------------------------------
-- Profils : vitrine choisie, collection visible ou non, lecture publique
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists showcase jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists show_collection boolean not null default true;

alter table public.profiles drop constraint if exists profiles_showcase_check;
alter table public.profiles add constraint profiles_showcase_check
  check (jsonb_typeof(showcase) = 'array' and jsonb_array_length(showcase) <= 12);

-- un profil se partage par lien : lisible même sans compte
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Abonnements (« suivre » un dresseur)
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  followee    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
create index if not exists follows_followee on public.follows (followee);

alter table public.follows enable row level security;
drop policy if exists "follows_select_all" on public.follows;
create policy "follows_select_all" on public.follows
  for select to anon, authenticated using (true);
drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows
  for insert to authenticated with check (follower = auth.uid());
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows
  for delete to authenticated using (follower = auth.uid());

-- ---------------------------------------------------------------------------
-- Fiche de profil : infos + compteurs + résumé de collection.
-- La collection elle-même reste privée (règles d'accès de collection_items) :
-- cette fonction n'en donne que des totaux, et seulement si le dresseur l'accepte.
-- ---------------------------------------------------------------------------
create or replace function public.profile_card(p_handle text)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'handle', p.handle, 'name', p.name, 'avatar', p.avatar, 'city', p.city, 'bio', p.bio,
    'joined', p.created_at, 'showcase', p.showcase, 'show_collection', p.show_collection,
    'followers', (select count(*) from follows f where f.followee = p.id),
    'following', (select count(*) from follows f where f.follower = p.id),
    'i_follow', exists (select 1 from follows f where f.follower = auth.uid() and f.followee = p.id),
    'stats', case when p.show_collection or p.id = auth.uid() then jsonb_build_object(
      'cards', (select count(distinct c.card_id) from collection_items c where c.user_id = p.id),
      'copies', (select coalesce(sum(c.qty), 0) from collection_items c where c.user_id = p.id),
      'sets', (select count(distinct c.set_id) from collection_items c where c.user_id = p.id),
      'dex', (select count(distinct d) from collection_items c, unnest(c.dex_ids) d where c.user_id = p.id)
    ) end
  )
  from profiles p
  where p.handle = lower(p_handle);
$$;

revoke all on function public.profile_card(text) from public;
grant execute on function public.profile_card(text) to anon, authenticated;

-- ===== 0003_card_details.sql =====
-- PokéClasseur — phase 3 : l'état, la langue, le favori et la date d'ajout de chaque carte
-- sont synchronisés entre les appareils (avant, ils restaient sur l'appareil où on les avait choisis).
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run. Peut être relancé sans risque.

alter table public.collection_items add column if not exists cond     text check (cond in ('NM','EX','GD','LP','PL','PO'));
alter table public.collection_items add column if not exists lang     text check (lang in ('FR','EN','JP'));
alter table public.collection_items add column if not exists fav      boolean not null default false;
alter table public.collection_items add column if not exists added_at bigint;   -- date d'ajout (millisecondes)

-- l'API relit le schéma pour voir les nouvelles colonnes tout de suite
notify pgrst, 'reload schema';

-- ===== 0004_shared.sql =====
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
