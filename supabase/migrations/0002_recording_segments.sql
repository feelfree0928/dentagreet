-- DentaGreet: store recordings as ordered 10-second segments
-- Run via Supabase dashboard SQL editor or CLI: supabase db push

alter table sessions
  add column if not exists recording_segments jsonb not null default '[]'::jsonb;

-- recording_segments is an ordered list of Supabase Storage object paths, one
-- per ~10s segment, uploaded live during the call:
--   ["recordings/<id>/0000.webm", "recordings/<id>/0001.webm", ...]
-- Concatenating the segments in order reproduces the full playable recording.
-- Legacy single-file recordings remain in recording_path for backward compat.
