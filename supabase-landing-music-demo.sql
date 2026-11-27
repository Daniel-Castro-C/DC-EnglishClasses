-- Allow the new single-class demonstration upload slots.
-- Keep the legacy assets and their allowed keys intact; they are not displayed.
begin;
alter table public.landing_demo_assets
  drop constraint landing_demo_assets_asset_key_check,
  drop constraint landing_demo_assets_file_path_check,
  add constraint landing_demo_assets_asset_key_check
    check (asset_key in ('feedback_slides','productivity_slides','feedback_report','productivity_report','teamwork_correction','music_slides','music_report')),
  add constraint landing_demo_assets_file_path_check
    check (file_path ~ '^(feedback_slides|productivity_slides|feedback_report|productivity_report|teamwork_correction|music_slides|music_report)/[a-f0-9]{32}[.]pdf$');
alter policy landing_demo_materials_insert on storage.objects
  with check (
    bucket_id = 'landing-demo-materials'
    and name ~ '^(feedback_slides|productivity_slides|feedback_report|productivity_report|teamwork_correction|music_slides|music_report)/[a-f0-9]{32}[.]pdf$'
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  );
commit;
