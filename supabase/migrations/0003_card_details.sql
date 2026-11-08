-- PokéClasseur — phase 3 : l'état, la langue, le favori et la date d'ajout de chaque carte
-- sont synchronisés entre les appareils (avant, ils restaient sur l'appareil où on les avait choisis).
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run. Peut être relancé sans risque.

alter table public.collection_items add column if not exists cond     text check (cond in ('NM','EX','GD','LP','PL','PO'));
alter table public.collection_items add column if not exists lang     text check (lang in ('FR','EN','JP'));
alter table public.collection_items add column if not exists fav      boolean not null default false;
alter table public.collection_items add column if not exists added_at bigint;   -- date d'ajout (millisecondes)

-- l'API relit le schéma pour voir les nouvelles colonnes tout de suite
notify pgrst, 'reload schema';
