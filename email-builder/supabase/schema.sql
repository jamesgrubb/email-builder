-- Create the themes table
create table public.themes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  font_family text not null,
  text_color text not null,
  background_color text not null,
  accent_color text not null
);

-- Set up Row Level Security (RLS)
-- For now, we'll allow public access for simplicity, but you should lock this down in production
alter table public.themes enable row level security;

create policy "Enable read access for all users"
on public.themes for select
to public
using (true);

create policy "Enable insert access for all users"
on public.themes for insert
to public
with check (true);
