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
