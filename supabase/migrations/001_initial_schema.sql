-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- artists table
-- ============================================================
create table artists (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Identity
  artist_name     text not null,
  genre_lane      text check (genre_lane in ('Indie Electronic', 'Underground Rap', 'Other')),
  location        text,
  tiktok_url      text,
  spotify_url     text,
  instagram_url   text,
  source          text check (source in ('TikTok FYP', 'Referral', 'Instagram', 'Other')),
  date_added      date,

  -- TikTok
  tiktok_followers        integer,
  tiktok_followers_prev   integer,
  tiktok_avg_views        integer,
  tiktok_ugc_count        integer,

  -- Spotify
  spotify_monthly_listeners   integer,
  spotify_mls_prev            integer,
  spotify_top_track_streams   integer,
  spotify_playlist_presence   text check (spotify_playlist_presence in ('None', 'Algorithmic', 'Editorial', 'Both')),

  -- Instagram
  instagram_followers integer,

  -- Pipeline
  stage           text check (stage in ('Radar', 'Contacted', 'In Conversation', 'Passed to Ben', 'Passed', 'Signed')),
  ben_sendable    boolean default false,
  last_contact    date,
  next_action     text,
  next_action_date date,
  manager_team    text,
  notes           text
);

-- Auto-update updated_at on any row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger artists_updated_at
  before update on artists
  for each row execute function update_updated_at();

-- ============================================================
-- onboarding table
-- ============================================================
create table onboarding (
  id                      uuid primary key default gen_random_uuid(),
  artist_id               uuid not null references artists(id) on delete cascade,
  spotify_discovered_on   boolean not null default false,
  spotify_similar_artists boolean not null default false,
  spotify_radio           boolean not null default false,
  tiktok_follow           boolean not null default false,
  interact_3_posts        boolean not null default false,
  soundcloud_radio        boolean not null default false,
  unique (artist_id)
);

-- Auto-create onboarding row when an artist is inserted
create or replace function create_onboarding_row()
returns trigger language plpgsql as $$
begin
  insert into onboarding (artist_id) values (new.id);
  return new;
end;
$$;

create trigger artists_after_insert
  after insert on artists
  for each row execute function create_onboarding_row();

-- ============================================================
-- RLS policies (permissive for anon key during development)
-- ============================================================
alter table artists  enable row level security;
alter table onboarding enable row level security;

create policy "allow all artists"   on artists   for all using (true) with check (true);
create policy "allow all onboarding" on onboarding for all using (true) with check (true);
