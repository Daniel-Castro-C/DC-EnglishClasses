begin;
-- No raw error text, personal data from forms or URLs. Actor ID is internal rate-limiting only.
create table if not exists public.portal_diagnostics (
 actor uuid not null,
 hour_bucket timestamptz not null,
 surface text not null,
 kind text not null,
 primary key(actor,hour_bucket,surface,kind)
);
alter table public.portal_diagnostics enable row level security;
revoke all on public.portal_diagnostics from public,anon,authenticated;
create or replace function public.portal_record_diagnostic(p_surface text,p_kind text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Access denied'; end if;
 if p_surface not in ('landing-admin','portal:admin.html','portal:home.html','portal:aluno.html','portal:perfil.html','portal:recursos.html','portal:guias-gramatica.html','portal:pergunte-ao-daniel.html','portal:enviar-material.html','portal:index.html','portal:atualizar-senha.html','portal:esqueci-senha.html')
 or p_kind not in ('runtime','script_load','promise') or p_surface is null or p_kind is null then raise exception 'Invalid signal'; end if;
 delete from public.portal_diagnostics where hour_bucket < now()-interval '30 days';
 insert into public.portal_diagnostics values (auth.uid(),date_trunc('hour',now()),p_surface,p_kind) on conflict do nothing;
end $$;
create or replace function public.portal_diagnostic_summary()
returns table(surface text,kind text,affected_hours bigint,last_seen timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Access denied'; end if;
 return query select d.surface,d.kind,count(*),max(d.hour_bucket)
 from public.portal_diagnostics d where d.hour_bucket>=now()-interval '7 days' group by d.surface,d.kind order by max(d.hour_bucket) desc;
end $$;
revoke all on function public.portal_record_diagnostic(text,text) from public,anon;
grant execute on function public.portal_record_diagnostic(text,text) to authenticated;
revoke all on function public.portal_diagnostic_summary() from public,anon;
grant execute on function public.portal_diagnostic_summary() to authenticated;
commit;
