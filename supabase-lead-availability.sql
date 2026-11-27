-- Keep the existing landing waitlist compatible; structured standalone availability.
alter table public.landing_leads
  add column if not exists source text not null default 'landing',
  add column if not exists frequency smallint,
  add column if not exists availability_slots text[] not null default '{}',
  add column if not exists admin_notes text not null default '';

alter table public.landing_leads
  add constraint landing_leads_source_check check (source in ('landing','availability')),
  add constraint landing_leads_frequency_check check (frequency in (0,1,2)),
  add constraint landing_leads_slots_check check (
    cardinality(availability_slots) <= 75 and array_position(availability_slots,null) is null
    and availability_slots <@ array['0|07:00', '0|08:00', '0|09:00', '0|10:00', '0|11:00', '0|12:00', '0|13:00', '0|14:00', '0|15:00', '0|16:00', '0|17:00', '0|18:00', '0|19:00', '0|20:00', '0|21:00', '1|07:00', '1|08:00', '1|09:00', '1|10:00', '1|11:00', '1|12:00', '1|13:00', '1|14:00', '1|15:00', '1|16:00', '1|17:00', '1|18:00', '1|19:00', '1|20:00', '1|21:00', '2|07:00', '2|08:00', '2|09:00', '2|10:00', '2|11:00', '2|12:00', '2|13:00', '2|14:00', '2|15:00', '2|16:00', '2|17:00', '2|18:00', '2|19:00', '2|20:00', '2|21:00', '3|07:00', '3|08:00', '3|09:00', '3|10:00', '3|11:00', '3|12:00', '3|13:00', '3|14:00', '3|15:00', '3|16:00', '3|17:00', '3|18:00', '3|19:00', '3|20:00', '3|21:00', '4|07:00', '4|08:00', '4|09:00', '4|10:00', '4|11:00', '4|12:00', '4|13:00', '4|14:00', '4|15:00', '4|16:00', '4|17:00', '4|18:00', '4|19:00', '4|20:00', '4|21:00']::text[]
    and (source <> 'availability' or (cardinality(availability_slots) >= 1 and frequency is not null))
  ),
  add constraint landing_leads_admin_notes_check check (char_length(admin_notes) <= 4000);

-- Preserve admin-only reads and updates; prevent the public from setting private notes.
alter policy landing_lead_public_insert on public.landing_leads
  with check (status = 'novo' and consent = true and admin_notes = '');
