-- DentaGreet: Align intake columns with the Maya persona spec (10 fields)
-- Run via Supabase dashboard SQL editor or CLI: supabase db push
--
-- Renames the legacy `symptoms` column to `symptom_description` (preserves data)
-- and adds the remaining spec fields. All are nullable text, captured live via
-- the record_patient_info tool.

-- Rename legacy column → spec name (no-op if already renamed)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'sessions' and column_name = 'symptoms'
  ) then
    alter table sessions rename column symptoms to symptom_description;
  end if;
end $$;

-- Add the new spec fields
alter table sessions add column if not exists symptom_description   text;
alter table sessions add column if not exists symptom_location      text;
alter table sessions add column if not exists symptom_triggers      text;
alter table sessions add column if not exists relevant_history      text;
alter table sessions add column if not exists medications_allergies text;
alter table sessions add column if not exists urgent_flag           text;
