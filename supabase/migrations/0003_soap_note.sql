-- DentaGreet: cached SOAP note + consent-language analysis for the admin panel
-- Run via Supabase dashboard SQL editor or CLI: supabase db push

alter table sessions
  add column if not exists soap_note jsonb,
  add column if not exists consent_language jsonb;

-- soap_note: LLM-generated clinical SOAP note covering the whole reception, e.g.
--   { "subjective": "...", "objective": "...", "assessment": "...", "plan": "...",
--     "generated_at": "<iso>", "model": "claude-opus-4-8" }
-- consent_language: verification of whether the patient's first consent was
-- handled in their own language, e.g.
--   { "patient_language": "Spanish", "consent_delivered_language": "Spanish",
--     "matched": true, "consent_outcome": "granted", "explanation": "...",
--     "evidence": [{ "role": "user", "quote": "..." }],
--     "generated_at": "<iso>", "model": "claude-opus-4-8" }
-- Both are generated on demand when an admin opens the session and cached here.
