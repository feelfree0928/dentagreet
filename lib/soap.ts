/**
 * lib/soap.ts
 *
 * Server-only. Uses the Anthropic Claude API to turn a finished reception
 * session (transcript + intake) into:
 *   1. a structured clinical SOAP note covering the whole meeting, and
 *   2. a consent-language analysis: did Maya respond to / deliver the consent
 *      disclosure in the language the patient first used?
 *
 * NEVER import this from a client component — it reads ANTHROPIC_API_KEY.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Session, SoapNote, ConsentLanguage } from './database.types';

export const SOAP_MODEL = 'claude-opus-4-8';

/** Whether the Anthropic API key is configured (required for SOAP generation). */
export function soapConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// SOAP fields and consent fields WITHOUT the server-stamped generated_at/model.
type SoapCore = Pick<SoapNote, 'subjective' | 'objective' | 'assessment' | 'plan'>;
type ConsentCore = Omit<ConsentLanguage, 'generated_at' | 'model'>;

export interface SoapAnalysis {
  soap: SoapCore;
  consentLanguage: ConsentCore;
}

const INTAKE_FIELDS = [
  'reason_for_visit',
  'symptom_description',
  'symptom_location',
  'pain_level',
  'symptom_duration',
  'symptom_triggers',
  'relevant_history',
  'medications_allergies',
  'additional_notes',
  'urgent_flag',
] as const;

// JSON Schema for structured output. Every object sets additionalProperties:false
// (required by the structured-outputs feature).
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    soap: {
      type: 'object',
      additionalProperties: false,
      properties: {
        subjective: { type: 'string' },
        objective: { type: 'string' },
        assessment: { type: 'string' },
        plan: { type: 'string' },
      },
      required: ['subjective', 'objective', 'assessment', 'plan'],
    },
    consent_language: {
      type: 'object',
      additionalProperties: false,
      properties: {
        patient_language: { type: 'string' },
        consent_delivered_language: { type: 'string' },
        matched: { type: 'boolean' },
        consent_outcome: { type: 'string', enum: ['granted', 'declined', 'unknown'] },
        explanation: { type: 'string' },
        evidence: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              role: { type: 'string', enum: ['replica', 'user'] },
              quote: { type: 'string' },
            },
            required: ['role', 'quote'],
          },
        },
      },
      required: [
        'patient_language',
        'consent_delivered_language',
        'matched',
        'consent_outcome',
        'explanation',
        'evidence',
      ],
    },
  },
  required: ['soap', 'consent_language'],
} as const;

const SYSTEM_PROMPT = `You are a clinical documentation assistant for a dental clinic. You are given the full transcript and captured intake of a PRE-VISIT video reception between "Maya" (an AI virtual receptionist, role "replica") and a patient (role "user"). Maya is NOT a clinician and performs no examination — this is reception/intake only.

Produce two things, grounded STRICTLY in the transcript and intake provided. Never invent symptoms, findings, history, or diagnoses that are not present in the source.

1. A SOAP note covering the whole meeting:
- subjective: the patient's reason for visit and symptoms in their own reported terms (chief complaint, history of present illness as stated).
- objective: factual, observable information only. This was a REMOTE reception with NO physical or clinical examination, so state that explicitly and record the concrete intake data points captured (e.g. pain level rating, duration, location the patient reported) — do NOT fabricate exam findings or vitals.
- assessment: a brief, explicitly NON-DIAGNOSTIC summary of the patient's concerns and any urgency/risk flags (e.g. an urgent_flag or emergency mention). Make clear this is a reception summary for the dental team to review, not a diagnosis.
- plan: concrete next steps — clinical team review, scheduling, and any urgent escalation that was indicated.
If the session was declined or has little content, write brief notes reflecting that rather than inventing detail.

2. A consent-language analysis. Maya is required to deliver the data/consent disclosure in the patient's own language when they don't speak English. Determine:
- patient_language: the language the patient first spoke / used at the start of the conversation (e.g. "English", "Spanish"). If unclear, your best inference from the text, else "Unknown".
- consent_delivered_language: the language Maya actually used to deliver the consent disclosure and handle the consent exchange.
- matched: true if the consent disclosure was delivered/answered in the patient's own language, false if there was a language mismatch.
- consent_outcome: "granted", "declined", or "unknown" based on the transcript.
- explanation: one or two sentences justifying the match verdict.
- evidence: 2 to 4 short verbatim quotes from the transcript (with their role) that show the first consent interaction and the languages used. Quote the actual transcript text.

Return ONLY the structured JSON matching the provided schema.`;

function buildUserMessage(session: Session): string {
  const intakeLines = INTAKE_FIELDS.map((f) => {
    const v = session[f];
    return `- ${f}: ${v ? String(v) : '(not captured)'}`;
  }).join('\n');

  const transcript = Array.isArray(session.transcript) ? session.transcript : [];
  const transcriptText = transcript
    .map((e) => `${e.role === 'replica' ? 'Maya' : 'Patient'} [${e.role}]: ${e.text}`)
    .join('\n');

  const consentLabel =
    session.consent === true ? 'granted' : session.consent === false ? 'declined' : 'not recorded';

  return `Patient name: ${session.patient_name}
Recorded consent flag: ${consentLabel}

Captured intake fields:
${intakeLines}

Full transcript (chronological):
${transcriptText || '(no transcript captured)'}`;
}

/**
 * Run the Claude analysis. Throws on API or parse failure — callers should
 * surface a clear error to the admin.
 */
export async function generateSoapAnalysis(session: Session): Promise<SoapAnalysis> {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY

  const response = await client.messages.create({
    model: SOAP_MODEL,
    max_tokens: 4000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(session) }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content for SOAP analysis');
  }

  const parsed = JSON.parse(textBlock.text) as {
    soap: SoapCore;
    consent_language: ConsentCore;
  };

  return { soap: parsed.soap, consentLanguage: parsed.consent_language };
}
