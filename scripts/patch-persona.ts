/**
 * scripts/patch-persona.ts
 *
 * Patches the EXISTING "Maya" persona (TAVUS_PERSONA_ID) so it matches the
 * repo's single source of truth:
 *   - System prompt:  scripts/maya-system-prompt.md
 *   - LLM tools:      scripts/persona-tools.json
 *
 * Why this exists:
 * The persona referenced by TAVUS_PERSONA_ID was created without an `llm`
 * layer, so NONE of the function tools (record_consent, record_patient_info,
 * end_session) were registered. The system prompt instructs Maya to call
 * `end_session` when the conversation finishes, but with no tool registered she
 * physically cannot — so the call never tears down and the patient is left on a
 * dead session until they press "End Session" manually.
 *
 * Tavus persona updates use JSON Patch (RFC 6902): the body is an ARRAY of
 * operations, sent as application/json to PATCH /v2/personas/{id}.
 *
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/patch-persona.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn('⚠️  .env not found — TAVUS_API_KEY will be empty');
}

const TAVUS_API_KEY = process.env.TAVUS_API_KEY;
const TAVUS_PERSONA_ID = process.env.TAVUS_PERSONA_ID;

if (!TAVUS_API_KEY) {
  console.error('❌ TAVUS_API_KEY is not set in .env');
  process.exit(1);
}
if (!TAVUS_PERSONA_ID) {
  console.error('❌ TAVUS_PERSONA_ID is not set in .env');
  process.exit(1);
}

const SYSTEM_PROMPT = fs.readFileSync(
  path.resolve(__dirname, 'maya-system-prompt.md'),
  'utf8'
);
const TOOLS = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'persona-tools.json'), 'utf8')
);

// JSON Patch (RFC 6902). `add` on an object member that doesn't exist creates
// it; on one that does, it replaces the value — so this is idempotent.
// `LLM_MODEL` must be a strong tool-calling model. Tavus's default starter model
// (`tavus-gpt-oss`, an open-weights model) does not reliably emit
// conversation.tool_call events during this multi-step intake, so Maya talks but
// never invokes record_patient_info / record_consent / end_session — the symptom
// being a blank live intake panel even though the (independent) transcript works.
// A frontier hosted model calls tools reliably. Alternatives: tavus-gpt-4.1,
// tavus-gpt-4o-mini, tavus-gpt-5.2, tavus-claude-haiku-4.5.
const LLM_MODEL = 'tavus-gpt-4o';

// `speculative_inference: false` — with it ON (the Tavus default) the model infers
// on partial speech and inference IDs churn, which interferes with reliable
// tool-call emission in the real-time pipeline. OFF = the model waits for the full
// utterance, giving deterministic record_patient_info / record_consent calls.
const patchOps = [
  { op: 'replace', path: '/system_prompt', value: SYSTEM_PROMPT },
  {
    op: 'add',
    path: '/layers/llm',
    value: { model: LLM_MODEL, tools: TOOLS, speculative_inference: false },
  },
];

async function getPersona() {
  const res = await fetch(`https://tavusapi.com/v2/personas/${TAVUS_PERSONA_ID}`, {
    headers: { 'x-api-key': TAVUS_API_KEY! },
  });
  return res.json();
}

function toolNames(persona: unknown): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = (persona as any)?.layers?.llm?.tools ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return tools.map((t: any) => t?.function?.name).filter(Boolean);
}

function llmModel(persona: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (persona as any)?.layers?.llm?.model ?? '(default — NOT tool-capable)';
}

function specInference(persona: unknown): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return String((persona as any)?.layers?.llm?.speculative_inference);
}

async function patchPersona() {
  console.log(`🔧 Patching persona ${TAVUS_PERSONA_ID} …\n`);

  const before = await getPersona();
  console.log('Before — LLM model:', llmModel(before), '· speculative_inference:', specInference(before));
  console.log('Before — registered tools:', toolNames(before).join(', ') || '(none)');

  const res = await fetch(`https://tavusapi.com/v2/personas/${TAVUS_PERSONA_ID}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': TAVUS_API_KEY!,
    },
    body: JSON.stringify(patchOps),
  });

  // PATCH may return 200 with the persona, or 204 No Content.
  const text = await res.text();
  if (!res.ok) {
    console.error(`❌ Tavus PATCH error (${res.status}):`, text);
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const after: any = await getPersona();
  const names = toolNames(after);
  console.log('After  — LLM model:', llmModel(after), '· speculative_inference:', specInference(after));
  console.log('After  — registered tools:', names.join(', ') || '(none)');

  const expected = ['record_patient_info', 'record_consent', 'end_session'];
  const missing = expected.filter((n) => !names.includes(n));
  if (missing.length > 0) {
    console.error('\n❌ Tools still missing after patch:', missing.join(', '));
    console.error('Raw layers:', JSON.stringify(after.layers, null, 2));
    process.exit(1);
  }

  console.log(`\n✅ Persona patched — model "${llmModel(after)}", all 3 tools registered. Maya can now call her tools.`);
}

patchPersona();
