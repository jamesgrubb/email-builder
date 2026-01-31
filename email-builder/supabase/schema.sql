-- 1. Rename 'themes' to 'brands' if 'themes' exists
do $$
begin
  if exists (select from pg_tables where schemaname = 'public' and tablename = 'themes') then
    alter table public.themes rename to brands;
  end if;
end
$$;

-- 2. Create 'brands' if it doesn't exist
create table if not exists public.brands (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  font_family text not null,
  text_color text not null,
  background_color text not null,
  accent_color text not null
);

-- 3. Create 'templates' if it doesn't exist
create table if not exists public.templates (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  mjml_code text not null,
  brand_id uuid references public.brands(id),
  thumbnail_url text
);

-- 4. Ensure 'templates' has 'brand_id' (in case table existed safely but without column)
do $$
begin
  if not exists (select from information_schema.columns where table_schema = 'public' and table_name = 'templates' and column_name = 'brand_id') then
    alter table public.templates add column brand_id uuid references public.brands(id);
  end if;
end
$$;

-- 5. Enable RLS (idempotent)
alter table public.brands enable row level security;
alter table public.templates enable row level security;

-- 6. Re-create Policies (drop first to avoid errors)
drop policy if exists "Enable read access for all users" on public.brands;
drop policy if exists "Enable insert access for all users" on public.brands;
drop policy if exists "Enable update access for all users" on public.brands;
drop policy if exists "Enable delete access for all users" on public.brands;
create policy "Enable read access for all users" on public.brands for select to public using (true);
create policy "Enable insert access for all users" on public.brands for insert to public with check (true);
create policy "Enable update access for all users" on public.brands for update to public using (true);
create policy "Enable delete access for all users" on public.brands for delete to public using (true);

drop policy if exists "Enable read access for all users" on public.templates;
drop policy if exists "Enable insert access for all users" on public.templates;
drop policy if exists "Enable update access for all users" on public.templates;
drop policy if exists "Enable delete access for all users" on public.templates;
create policy "Enable read access for all users" on public.templates for select to public using (true);
create policy "Enable insert access for all users" on public.templates for insert to public with check (true);
create policy "Enable update access for all users" on public.templates for update to public using (true);
create policy "Enable delete access for all users" on public.templates for delete to public using (true);
