-- Add primary_color and secondary_color to brands
alter table public.brands
  add column if not exists primary_color text default '#007bff',
  add column if not exists secondary_color text default '#f8f9fa';
