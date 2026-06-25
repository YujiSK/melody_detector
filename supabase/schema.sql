-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Churches
create table churches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

-- Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  church_id uuid references churches(id) on delete cascade,
  role text not null check (role in ('admin', 'member')) default 'member',
  display_name text not null,
  created_at timestamptz default now()
);

-- Songs
create table songs (
  id uuid primary key default uuid_generate_v4(),
  church_id uuid not null references churches(id) on delete cascade,
  title text not null,
  title_ja text,
  artist text,
  acr_id text,
  status text not null check (status in ('pending', 'ready')) default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index songs_church_id_idx on songs(church_id);
create index songs_acr_id_idx on songs(acr_id);

-- Kana (カナルビ資料)
create table kana (
  id uuid primary key default uuid_generate_v4(),
  song_id uuid not null references songs(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  sections jsonb not null default '[]',
  raw_korean text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index kana_song_id_idx on kana(song_id);
create index kana_church_id_idx on kana(church_id);

-- Favorites
create table favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id uuid not null references songs(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, song_id)
);

create index favorites_user_id_idx on favorites(user_id);

-- Row Level Security
alter table churches enable row level security;
alter table profiles enable row level security;
alter table songs enable row level security;
alter table kana enable row level security;
alter table favorites enable row level security;

-- Helper function: get current user's church_id
create or replace function get_my_church_id()
returns uuid language sql security definer stable as $$
  select church_id from profiles where id = auth.uid()
$$;

-- Helper function: get current user's role
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

-- RLS Policies

-- Churches: members can see their own church
create policy "members can view own church"
  on churches for select
  using (id = get_my_church_id());

-- Profiles: users can see their own profile and church members
create policy "users can view own profile"
  on profiles for select
  using (id = auth.uid() or church_id = get_my_church_id());

create policy "users can update own profile"
  on profiles for update
  using (id = auth.uid());

create policy "admin can insert profiles"
  on profiles for insert
  with check (church_id = get_my_church_id() and get_my_role() = 'admin');

create policy "admin can delete profiles"
  on profiles for delete
  using (church_id = get_my_church_id() and get_my_role() = 'admin');

-- Songs: members can view, admin can CRUD
create policy "members can view church songs"
  on songs for select
  using (church_id = get_my_church_id());

create policy "admin can insert songs"
  on songs for insert
  with check (church_id = get_my_church_id() and get_my_role() = 'admin');

create policy "admin can update songs"
  on songs for update
  using (church_id = get_my_church_id() and get_my_role() = 'admin');

create policy "admin can delete songs"
  on songs for delete
  using (church_id = get_my_church_id() and get_my_role() = 'admin');

-- Kana: members can view, admin can CRUD
create policy "members can view church kana"
  on kana for select
  using (church_id = get_my_church_id());

create policy "admin can insert kana"
  on kana for insert
  with check (church_id = get_my_church_id() and get_my_role() = 'admin');

create policy "admin can update kana"
  on kana for update
  using (church_id = get_my_church_id() and get_my_role() = 'admin');

create policy "admin can delete kana"
  on kana for delete
  using (church_id = get_my_church_id() and get_my_role() = 'admin');

-- Favorites: users manage their own
create policy "users can view own favorites"
  on favorites for select
  using (user_id = auth.uid());

create policy "users can insert own favorites"
  on favorites for insert
  with check (user_id = auth.uid());

create policy "users can delete own favorites"
  on favorites for delete
  using (user_id = auth.uid());

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger songs_updated_at before update on songs
  for each row execute function update_updated_at();

create trigger kana_updated_at before update on kana
  for each row execute function update_updated_at();

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, church_id, role, display_name)
  values (
    new.id,
    (new.raw_user_meta_data->>'church_id')::uuid,
    coalesce(new.raw_user_meta_data->>'role', 'member'),
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
