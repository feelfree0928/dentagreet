-- DentaGreet: Initial schema migration
-- Run via Supabase dashboard SQL editor or CLI: supabase db push

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  tavus_conversation_id text,
  tavus_conversation_url text,
  status text not null default 'created',         -- created | in_progress | completed | declined | error
  consent boolean,                                 -- null until answered
  reason_for_visit text,
  symptoms text,
  symptom_duration text,
  pain_level text,
  additional_notes text,
  intake jsonb not null default '{}'::jsonb,       -- raw field map captured live
  transcript jsonb not null default '[]'::jsonb,   -- [{role, text, ts}]
  recording_path text,                             -- Supabase Storage object path
  started_at timestamptz default now(),
  ended_at timestamptz
);

-- Enable Row Level Security (no public policies — all access via service-role key)
alter table sessions enable row level security;

-- Storage bucket for recordings (run this in Supabase dashboard → Storage)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', false);
-- Note: Create the 'recordings' bucket manually in Supabase dashboard → Storage → New bucket
-- Set it to PRIVATE (not public)
