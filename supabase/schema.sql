-- Hasta Pronto: run once in the Supabase SQL editor (replace NL_EMAIL and MX_EMAIL).
create table if not exists public.members (email text primary key, side text not null check (side in ('nl','mx')));
create table if not exists public.docs (path text primary key, col text not null, id text not null, data jsonb not null, updated_at timestamptz not null default now());
create index if not exists docs_col_idx on public.docs (col);
alter table public.members enable row level security;
alter table public.docs enable row level security;
create or replace function public.is_member() returns boolean language sql stable security definer set search_path = public as 'select exists (select 1 from public.members m where lower(m.email) = lower(auth.jwt() ->> ''email''))';
drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (public.is_member());
drop policy if exists docs_all on public.docs;
create policy docs_all on public.docs for all to authenticated using (public.is_member()) with check (public.is_member());
alter table public.docs replica identity full;
do 'begin alter publication supabase_realtime add table public.docs; exception when duplicate_object then null; end';
insert into public.members (email, side) values ('NL_EMAIL', 'nl'), ('MX_EMAIL', 'mx') on conflict (email) do update set side = excluded.side;
