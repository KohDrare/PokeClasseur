-- PokéClasseur — phase 6 : les classeurs visibles sur le profil public.
-- Les classeurs que tu choisis de partager sont copiés dans ton profil (profiles.binders) et
-- s'affichent dans l'onglet « Classeurs » de ta page publique.
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run. Peut être relancé sans risque.

alter table public.profiles add column if not exists binders jsonb not null default '[]'::jsonb;

create or replace function public.profile_card(p_handle text)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'handle', p.handle, 'name', p.name, 'avatar', p.avatar, 'city', p.city, 'bio', p.bio,
    'joined', p.created_at, 'showcase', p.showcase, 'show_collection', p.show_collection, 'binders', p.binders,
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

notify pgrst, 'reload schema';
