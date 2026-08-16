-- supabase/migrations/0001_schema.sql

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null,
  display_name  text,
  avatar_url    text,
  invite_code   text not null default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  created_at    timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

create unique index profiles_username_key on public.profiles (username);
create unique index profiles_invite_code_key on public.profiles (invite_code);

create table public.classes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  instructor    text,
  room          text,
  days          smallint[] not null,
  start_minute  smallint not null,
  end_minute    smallint not null,
  color         text not null,
  sort_order    smallint not null default 0,
  created_at    timestamptz not null default now(),
  constraint classes_name_not_blank check (length(btrim(name)) > 0),
  constraint classes_time_order check (end_minute > start_minute),
  constraint classes_time_range check (start_minute >= 0 and end_minute <= 1440),
  constraint classes_days_count check (array_length(days, 1) between 1 and 7),
  constraint classes_days_range check (days <@ array[1,2,3,4,5,6,7]::smallint[])
);

create index classes_user_id_idx on public.classes (user_id);

create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  addressee_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- One row per unordered pair, regardless of who asked first.
create unique index friendships_pair_key on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

create table public.extraction_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index extraction_log_user_time_idx on public.extraction_log (user_id, created_at desc);
