/**
 * lib/tavus-events.ts
 *
 * SINGLE SOURCE OF TRUTH for all Tavus CVI event name constants.
 * If Tavus changes event names in their API, update ONLY this file.
 *
 * Verified against Tavus docs: https://docs.tavus.io
 * Last checked: 2026-06
 *
 * Tavus broadcasts events as Daily.co app-messages.
 * The raw app-message shape is: { event_type: string, conversation_id: string, ...payload }
 */

// ─── Conversation lifecycle events ───────────────────────────────────────────
export const TAVUS_EVENTS = {
  /** Fired when the replica starts speaking an utterance */
  REPLICA_STARTED_SPEAKING: 'conversation.replica_started_speaking',
  /** Fired when the replica finishes speaking */
  REPLICA_STOPPED_SPEAKING: 'conversation.replica_stopped_speaking',
  /** Fired when a full utterance (replica or user) is transcribed */
  UTTERANCE: 'conversation.utterance',
  /** Fired when the LLM layer invokes a tool/function */
  TOOL_CALL: 'conversation.tool_call',
  /** Fired when the conversation ends (from Tavus side) */
  CONVERSATION_ENDED: 'conversation.ended',
  /** Fired when the replica joins the room */
  REPLICA_JOINED: 'conversation.replica_joined',
  /**
   * Fired (message_type "system") when the room shuts down — reasons include
   * the replica ending the conversation, max_call_duration, or a left timeout.
   * Carries `properties.shutdown_reason`. Authoritative end-of-call signal.
   */
  SHUTDOWN: 'system.shutdown',
} as const;

export type TavusEventType = (typeof TAVUS_EVENTS)[keyof typeof TAVUS_EVENTS];

// ─── Tool names (must match persona definition in scripts/create-persona.ts) ─
export const TAVUS_TOOLS = {
  RECORD_CONSENT: 'record_consent',
  RECORD_PATIENT_INFO: 'record_patient_info',
  END_SESSION: 'end_session',
} as const;

export type TavusTool = (typeof TAVUS_TOOLS)[keyof typeof TAVUS_TOOLS];

// ─── Consent status values (record_consent.status) ───────────────────────────
export const CONSENT_STATUSES = ['granted', 'declined'] as const;
export type ConsentStatus = (typeof CONSENT_STATUSES)[number];

// ─── End reasons (end_session.reason) ─────────────────────────────────────────
export const END_REASONS = [
  'completed',
  'consent_declined',
  'emergency_escalation',
  'minor_no_guardian',
  'terminated_by_assistant',
] as const;
export type EndReason = (typeof END_REASONS)[number];

// ─── Intake field names (record_patient_info.field) ───────────────────────────
export const INTAKE_FIELDS = [
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

export type IntakeField = (typeof INTAKE_FIELDS)[number];

// ─── Normalized event payloads ────────────────────────────────────────────────

export interface TavusUtteranceEvent {
  type: 'utterance';
  role: 'replica' | 'user';
  text: string;
  ts: string; // ISO timestamp
}

export interface TavusToolCallEvent {
  type: 'tool_call';
  tool: TavusTool;
  args: Record<string, unknown>;
}

export type NormalizedTavusEvent = TavusUtteranceEvent | TavusToolCallEvent;

/**
 * Normalize a raw Daily app-message payload into a typed event.
 * Returns null if the message is not a recognized Tavus event.
 */
export function normalizeTavusAppMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
): NormalizedTavusEvent | null {
  if (!data || typeof data !== 'object') return null;

  const eventType: string = data.event_type ?? data.message_type ?? data.type ?? '';

  // Tavus nests the payload under `properties`; older/other shapes are flat.
  // Read from properties first, then fall back to the top level.
  const p: Record<string, unknown> =
    data.properties && typeof data.properties === 'object' ? data.properties : data;

  // ── Utterance ──────────────────────────────────────────────────────────────
  if (eventType === TAVUS_EVENTS.UTTERANCE) {
    const rawRole = p.role ?? data.role;
    const role = rawRole === 'replica' || rawRole === 'assistant' ? 'replica' : 'user';
    const text: string = String(p.speech ?? p.text ?? data.text ?? data.utterance ?? '');
    if (!text.trim()) return null;
    return {
      type: 'utterance',
      role,
      text: text.trim(),
      ts: (data.timestamp as string) ?? new Date().toISOString(),
    };
  }

  // ── Tool call ──────────────────────────────────────────────────────────────
  if (eventType === TAVUS_EVENTS.TOOL_CALL) {
    // Tool name/args may live under properties, top level, or a function object.
    const fn = (p.function ?? data.function) as { name?: string; arguments?: unknown } | undefined;
    const toolName: string = String(
      p.name ?? data.tool_name ?? data.name ?? fn?.name ?? ''
    );
    const rawArgs =
      p.arguments ?? data.tool_arguments ?? data.arguments ?? fn?.arguments ?? {};

    // Parse args if they arrive as a JSON string
    const parsedArgs: Record<string, unknown> =
      typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs as Record<string, unknown>);

    if (!toolName) return null;
    return {
      type: 'tool_call',
      tool: toolName as TavusTool,
      args: parsedArgs,
    };
  }

  return null;
}
