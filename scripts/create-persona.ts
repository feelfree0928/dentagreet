/**
 * scripts/create-persona.ts
 *
 * One-time script to create the "Maya" dental reception persona via Tavus API.
 * Run with: npx ts-node --project tsconfig.scripts.json scripts/create-persona.ts
 *
 * After running, copy the printed persona_id into your .env as TAVUS_PERSONA_ID.
 *
 * SINGLE SOURCE OF TRUTH for the persona:
 *   - System prompt:  scripts/maya-system-prompt.md
 *   - LLM tools:      scripts/persona-tools.json
 * These same files are used to patch the live persona, so the two never drift.
 * The tool names/args here MUST match lib/tavus-events.ts (TAVUS_TOOLS, INTAKE_FIELDS).
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env (project uses .env, not .env.local)
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn('⚠️  .env not found — TAVUS_API_KEY will be empty');
}

const TAVUS_API_KEY = process.env.TAVUS_API_KEY;

if (!TAVUS_API_KEY) {
  console.error('❌ TAVUS_API_KEY is not set in .env');
  process.exit(1);
}

const SYSTEM_PROMPT = fs.readFileSync(
  path.resolve(__dirname, 'maya-system-prompt.md'),
  'utf8'
);
const TOOLS = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'persona-tools.json'), 'utf8')
);

const personaPayload = {
  persona_name: 'Maya — Dental Reception Assistant',
  pipeline_mode: 'full',
  system_prompt: SYSTEM_PROMPT,
  context:
    'You are operating as a reception assistant at a dental clinic. You are speaking with a patient who has arrived for their appointment or is checking in remotely.',
  layers: {
    llm: {
      // Strong tool-calling model. The starter model `tavus-gpt-oss` does not
      // reliably emit conversation.tool_call events for this multi-step intake,
      // so Maya never invokes record_patient_info / record_consent / end_session
      // (symptom: blank live intake panel while the transcript still works).
      // Alternatives: tavus-gpt-4.1, tavus-gpt-4o-mini, tavus-gpt-5.2,
      // tavus-claude-haiku-4.5.
      model: 'tavus-gpt-4o',
      tools: TOOLS,
    },
    tts: {
      tts_engine: 'cartesia',
    },
  },
};

async function createPersona() {
  console.log('🚀 Creating Tavus persona: Maya — Dental Reception Assistant...\n');

  try {
    const response = await fetch('https://tavusapi.com/v2/personas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TAVUS_API_KEY!,
      },
      body: JSON.stringify(personaPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Tavus API error:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('✅ Persona created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`TAVUS_PERSONA_ID=${data.persona_id}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('👉 Add the above line to your .env file\n');
    console.log('Full response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Network error:', error);
    process.exit(1);
  }
}

createPersona();
