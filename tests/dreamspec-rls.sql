\set ON_ERROR_STOP on
begin;
create role authenticated nologin;
create role anon nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,anon;
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(bucket_id text,name text primary key);
alter table storage.objects enable row level security;
create function storage.foldername(path text) returns text[] language sql immutable as $$select pieces[1:array_length(pieces,1)-1] from (select string_to_array(path,'/') pieces) s$$;
grant usage on schema storage to authenticated;
grant select,insert,update,delete on storage.objects to authenticated;
\ir ../supabase/migrations/20261020170000_dream_spec_private_garage.sql

insert into auth.users values('11111111-1111-4111-8111-111111111111'),('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.owned_vehicles(id,catalog_vehicle_id,year,make,model) values
 ('22222222-2222-4222-8222-222222222222','same-car',2007,'Chevrolet','Corvette'),
 ('33333333-3333-4333-8333-333333333333','same-car',2007,'Chevrolet','Corvette');
do $$
begin
 if (select count(*) from public.owned_vehicles)<>2 then raise exception 'identical applications need separate owned identities';end if;
 begin
  insert into public.owned_vehicles(owner_id,catalog_vehicle_id,year,make,model) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','car',2000,'Other','Car');
  raise exception 'RLS allowed a foreign owner insert';
 exception when insufficient_privilege then null;end;
 begin
  update public.owned_vehicles set owner_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  raise exception 'owner transfer was permitted';
 exception when insufficient_privilege then null;end;
end $$;
insert into storage.objects values('vehicle-photos','11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/photo.jpg');

select public.begin_diagnostic_run('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','Rough idle on cold start','["P0171"]'::jsonb);
do $$
declare run uuid;r jsonb;
begin
 select id into run from public.diagnostic_runs limit 1;
 r=public.begin_diagnostic_run('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','Rough idle on cold start','["P0171"]'::jsonb);
 if r->>'reused'<>'true' then raise exception 'repeat request was not marked reused';end if;
 perform public.finish_diagnostic_run(run,'{"summary":"Check for intake leaks"}');
 perform public.finish_diagnostic_run(run,'{"summary":"Second result must not duplicate history"}');
 if (select count(*) from public.vehicle_events)<>1 then raise exception 'history duplicated';end if;
 if (select status from public.vehicle_events)<>'unconfirmed' then raise exception 'diagnostic session was marked repaired';end if;
end $$;

select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$
declare n integer;
begin
 if (select count(*) from public.owned_vehicles)<>0 then raise exception 'account B can read account A';end if;
 if (select count(*) from public.vehicle_events)<>0 then raise exception 'account B can read diagnostic history';end if;
 if (select count(*) from storage.objects)<>0 then raise exception 'account B can read private photos';end if;
 update public.owned_vehicles set nickname='Stolen' where id='22222222-2222-4222-8222-222222222222';
 get diagnostics n=row_count;if n<>0 then raise exception 'foreign profile update succeeded';end if;
 begin
  insert into public.vehicle_events(vehicle_id,title) values('22222222-2222-4222-8222-222222222222','Foreign event');
  raise exception 'foreign vehicle history insert succeeded';
 exception when insufficient_privilege then null;end;
 begin
  insert into storage.objects values('vehicle-photos','11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/foreign.jpg');
  raise exception 'foreign photo write succeeded';
 exception when insufficient_privilege then null;end;
end $$;
insert into public.owned_vehicles(id,catalog_vehicle_id,year,make,model)
 values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','same-car',2007,'Chevrolet','Corvette');
do $$
begin
 begin
  insert into public.vehicle_events(vehicle_id,diagnostic_run_id,title)
  select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',id,'Foreign diagnostic run' from public.diagnostic_runs;
  -- RLS hides every foreign diagnostic run, so no row can be attached.
  if exists(select 1 from public.vehicle_events) then raise exception 'foreign diagnostic attachment succeeded';end if;
 exception when foreign_key_violation then null;end;
end $$;
set local role anon;
do $$
begin
 begin perform 1 from public.owned_vehicles;raise exception 'anonymous garage read succeeded';exception when insufficient_privilege then null;end;
 begin perform 1 from public.vehicle_events;raise exception 'anonymous history read succeeded';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
\echo PASS: two identical owned vehicles, RLS owner isolation, write protection, private photos, unconfirmed history and idempotent logging.
