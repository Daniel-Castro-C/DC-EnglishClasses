-- A singleton public configuration, editable only by the authenticated admin.
begin;
create table public.landing_enrollment_settings (
  id smallint primary key check (id = 1),
  mode text not null check (mode in ('interest','open')),
  interest_message text not null check (char_length(btrim(interest_message)) between 1 and 2000)
);
insert into public.landing_enrollment_settings (id,mode,interest_message) values
  (1,'interest','Novas opções de horários estarão disponíveis a partir de janeiro de 2027. Indique sua disponibilidade e entraremos em contato para apresentar as possibilidades de aulas. O preenchimento é sem compromisso.');
alter table public.landing_enrollment_settings enable row level security;
revoke all on public.landing_enrollment_settings from public, anon, authenticated;
grant select on public.landing_enrollment_settings to anon, authenticated;
grant update(mode,interest_message) on public.landing_enrollment_settings to authenticated;
create policy landing_enrollment_public_read on public.landing_enrollment_settings
  for select to anon, authenticated using (true);
create policy landing_enrollment_admin_update on public.landing_enrollment_settings
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
  with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));
commit;
