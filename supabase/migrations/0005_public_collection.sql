-- PokéClasseur — phase 5 : voir la collection des autres dresseurs.
-- Quand un dresseur active « Collection visible par les autres » (profiles.show_collection),
-- les autres comptes connectés peuvent LIRE ses cartes (jamais les modifier).
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run. Peut être relancé sans risque.

drop policy if exists "collection_select_public" on public.collection_items;
create policy "collection_select_public" on public.collection_items
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = collection_items.user_id and p.show_collection));

notify pgrst, 'reload schema';
