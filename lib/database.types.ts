/**
 * lib/database.types.ts
 *
 * TypeScript types for the Supabase database schema.
 * Matches supabase/migrations/0001_init.sql exactly.
 */

export type SessionStatus = 'created' | 'in_progress' | 'completed' | 'declined' | 'error';

export interface TranscriptEntry {
  role: 'replica' | 'user';
  text: string;
  ts: string; // ISO timestamp
}

export interface IntakeData {
  reason_for_visit?: string;
  symptom_description?: string;
  symptom_location?: string;
  pain_level?: string;
  symptom_duration?: string;
  symptom_triggers?: string;
  relevant_history?: string;
  medications_allergies?: string;
  additional_notes?: string;
  urgent_flag?: string;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  generated_at: string; // ISO timestamp, stamped by the server
  model: string; // Claude model id used
}

export interface ConsentLanguageEvidence {
  role: 'replica' | 'user';
  quote: string;
}

export interface ConsentLanguage {
  patient_language: string; // language the patient first spoke
  consent_delivered_language: string; // language Maya used for the consent disclosure
  matched: boolean; // was consent delivered in the patient's language?
  consent_outcome: 'granted' | 'declined' | 'unknown';
  explanation: string;
  evidence: ConsentLanguageEvidence[];
  generated_at: string; // ISO timestamp, stamped by the server
  model: string;
}

export interface Session {
  id: string;
  patient_name: string;
  tavus_conversation_id: string | null;
  tavus_conversation_url: string | null;
  status: SessionStatus;
  consent: boolean | null;
  reason_for_visit: string | null;
  symptom_description: string | null;
  symptom_location: string | null;
  pain_level: string | null;
  symptom_duration: string | null;
  symptom_triggers: string | null;
  relevant_history: string | null;
  medications_allergies: string | null;
  additional_notes: string | null;
  urgent_flag: string | null;
  intake: IntakeData;
  transcript: TranscriptEntry[];
  recording_path: string | null;
  recording_segments: string[];
  soap_note: SoapNote | null;
  consent_language: ConsentLanguage | null;
  started_at: string;
  ended_at: string | null;
}

// Row type for Supabase insert (id and started_at are optional — DB provides defaults)
export type SessionInsert = Omit<Session, 'id' | 'started_at'> & {
  id?: string;
  started_at?: string;
};

// Row type for Supabase update (all fields optional except id)
export type SessionUpdate = Partial<Omit<Session, 'id'>>;

/**
 * Database interface matching @supabase/supabase-js generic shape.
 * The Row/Insert/Update types must be explicit objects (not `never`).
 */
export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: Session;
        Insert: SessionInsert;
        Update: SessionUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
