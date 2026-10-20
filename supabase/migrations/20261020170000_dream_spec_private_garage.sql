-- Additive migration. Public catalog/ingestion tables are unchanged.
create extension if not exists pgcrypto;
create table public.owned_vehicles (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 catalog_vehicle_id text not null,
 nickname text not null default '',
 year integer not null check (year between 1886 and 2100),
 make text not null, model text not null, engine text not null default '', variant text not null default '',
 profile jsonb not null default '{"photos":[],"maintenance":[],"codes":[],"receipts":[]}'::jsonb,
 build jsonb not null default '{}'::jsonb,
 legacy_import_key text,
 version bigint not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique (id,owner_id), unique (owner_id,legacy_import_key),
 check(jsonb_typeof(profile)='object' and octet_length(profile::text)<=2000000),
 check(jsonb_typeof(build)='object' and octet_length(build::text)<=300000)
);
create table public.diagnostic_runs (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 vehicle_id uuid not null,
 request_id uuid not null,
 symptoms text not null check(length(symptoms) between 8 and 4000),
 codes jsonb not null default '[]'::jsonb check(jsonb_typeof(codes)='array' and jsonb_array_length(codes)<=15),
 status text not null default 'pending' check(status in ('pending','completed','failed')),
 result jsonb, event_id uuid,
 created_at timestamptz not null default now(),
 unique(owner_id,request_id), unique(id,owner_id),
 foreign key(vehicle_id,owner_id) references public.owned_vehicles(id,owner_id) on delete cascade
);
create table public.vehicle_events (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 vehicle_id uuid not null,
 diagnostic_run_id uuid unique,
 kind text not null default 'diagnostic' check(kind in ('diagnostic','service','repair')),
 title text not null,
 payload jsonb not null default '{}'::jsonb check(octet_length(payload::text)<=500000),
 status text not null default 'unconfirmed' check(status in ('unconfirmed','resolved')),
 resolution text not null default '' check(length(resolution)<=2000),
 created_at timestamptz not null default now(),
 foreign key(vehicle_id,owner_id) references public.owned_vehicles(id,owner_id) on delete cascade,
 foreign key(diagnostic_run_id,owner_id) references public.diagnostic_runs(id,owner_id) on delete cascade
);
create index owned_vehicles_owner on public.owned_vehicles(owner_id);
create index vehicle_events_vehicle on public.vehicle_events(owner_id,vehicle_id,created_at desc);
create index diagnostic_runs_vehicle on public.diagnostic_runs(vehicle_id,owner_id);
create index diagnostic_runs_owner_time on public.diagnostic_runs(owner_id,created_at desc);

create function public.dreamspec_touch_vehicle() returns trigger language plpgsql set search_path='' as $$
begin
 new.updated_at=now();new.version=old.version+1;return new;
end;
$$;
create trigger dreamspec_vehicle_version before update on public.owned_vehicles for each row execute function public.dreamspec_touch_vehicle();

alter table public.owned_vehicles enable row level security;
alter table public.diagnostic_runs enable row level security;
alter table public.vehicle_events enable row level security;
create policy owned_vehicles_private on public.owned_vehicles for all to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy diagnostic_runs_private on public.diagnostic_runs for all to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and exists(select 1 from public.owned_vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())));
create policy vehicle_events_private on public.vehicle_events for all to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and exists(select 1 from public.owned_vehicles v where v.id=vehicle_id and v.owner_id=(select auth.uid())));
revoke all on public.owned_vehicles,public.diagnostic_runs,public.vehicle_events from anon,authenticated;
grant select,insert on public.owned_vehicles to authenticated;
grant update(profile,build,nickname) on public.owned_vehicles to authenticated;
grant select,insert,update on public.diagnostic_runs to authenticated;
grant select,insert on public.vehicle_events to authenticated;
grant update(status,resolution) on public.vehicle_events to authenticated;

-- Reserve before inference to prevent duplicate billing and concurrent repeat requests.
create function public.begin_diagnostic_run(p_vehicle_id uuid,p_request_id uuid,p_symptoms text,p_codes jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.diagnostic_runs;
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,17));
 select * into r from public.diagnostic_runs where owner_id=auth.uid() and request_id=p_request_id;
 if found then
  if r.vehicle_id<>p_vehicle_id or r.symptoms<>p_symptoms or r.codes<>p_codes then raise exception 'request_id_reused';end if;
  return to_jsonb(r)||jsonb_build_object('reused',true);
 end if;
 if not exists(select 1 from public.owned_vehicles where id=p_vehicle_id and owner_id=auth.uid()) then raise exception 'vehicle_not_found' using errcode='42501';end if;
 if (select count(*) from public.diagnostic_runs where owner_id=auth.uid() and created_at>now()-interval '1 minute')>=5
 or (select count(*) from public.diagnostic_runs where owner_id=auth.uid() and created_at>now()-interval '1 day')>=50 then
  raise exception 'diagnostic_rate_limit' using errcode='P0001';
 end if;
 insert into public.diagnostic_runs(vehicle_id,request_id,symptoms,codes)
 values(p_vehicle_id,p_request_id,p_symptoms,p_codes) returning * into r;
 return to_jsonb(r)||jsonb_build_object('reused',false);
end;
$$;
create function public.finish_diagnostic_run(p_run_id uuid,p_result jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.diagnostic_runs;e uuid;
begin
 select * into r from public.diagnostic_runs where id=p_run_id and owner_id=auth.uid() for update;
 if not found then raise exception 'run_not_found' using errcode='42501';end if;
 if r.status='completed' then return jsonb_build_object('event_id',r.event_id,'result',r.result);end if;
 if r.status<>'pending' then raise exception 'run_not_pending';end if;
 if jsonb_typeof(p_result)<>'object' or octet_length(p_result::text)>300000 then raise exception 'invalid_result';end if;
 insert into public.vehicle_events(vehicle_id,diagnostic_run_id,title,payload)
 values(r.vehicle_id,r.id,'Diagnosis: '||left(coalesce(p_result->>'summary','Diagnostic session'),120),
 jsonb_build_object('symptoms',r.symptoms,'codes',r.codes,'result',p_result)) returning id into e;
 update public.diagnostic_runs set status='completed',result=p_result,event_id=e where id=r.id;
 return jsonb_build_object('event_id',e,'result',p_result);
end;
$$;
revoke all on function public.begin_diagnostic_run(uuid,uuid,text,jsonb),public.finish_diagnostic_run(uuid,jsonb) from public,anon;
grant execute on function public.begin_diagnostic_run(uuid,uuid,text,jsonb),public.finish_diagnostic_run(uuid,jsonb) to authenticated;

-- Photos are private and scoped to owner/owned-vehicle, including two identical applications.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('vehicle-photos','vehicle-photos',false,700000,array['image/jpeg']);
create policy dreamspec_private_photos on storage.objects for all to authenticated
 using(bucket_id='vehicle-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.owned_vehicles v where v.id::text=(storage.foldername(name))[2] and v.owner_id=(select auth.uid())))
 with check(bucket_id='vehicle-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
 and exists(select 1 from public.owned_vehicles v where v.id::text=(storage.foldername(name))[2] and v.owner_id=(select auth.uid())));
