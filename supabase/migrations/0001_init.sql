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
