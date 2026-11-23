import { env } from './env';
import { ServiceError, fetchWithTimeout } from './http';

/**
 * Gemini through the Interactions API (stateless: store=false). The model's
 * steps, thought signatures included, are sent back untouched within one
 * exchange, which is what function calling on Gemini 3 needs.
 */
export type Step = Record<string, unknown> & { type: string };

export type ToolDecl = { name: string; description: string; parameters: Record<string, unknown> };

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

type InteractionResponse = { steps?: Step[]; status?: string; error?: { message?: string } };

export const geminiReady = () => Boolean(env.geminiKey());

export async function interact(opts: {
  system: string;
  input: Step[] | string;
  tools?: ToolDecl[];
  thinking?: 'minimal' | 'low' | 'medium' | 'high';
  timeoutMs?: number;
}): Promise<Step[]> {
  if (!geminiReady()) throw new ServiceError('not_configured', 'GEMINI_API_KEY manquante.');
  const body: Record<string, unknown> = {
    model: env.geminiModel(),
    store: false,
    system_instruction: opts.system,
    input: opts.input,
    generation_config: { thinking_level: opts.thinking ?? 'low' },
  };
  if (opts.tools?.length) body.tools = opts.tools.map((t) => ({ type: 'function', ...t }));
  const res = await fetchWithTimeout(
    `${env.geminiUrl()}/interactions`,
    { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.geminiKey() }, body: JSON.stringify(body) },
    opts.timeoutMs ?? 45_000,
  );
  const text = await res.text();
  if (!res.ok) {
    const code = res.status === 429 ? 'quota' : res.status === 401 || res.status === 403 ? 'auth' : 'bad_response';
    throw new ServiceError(code, `Gemini ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  const json = JSON.parse(text) as InteractionResponse;
  return json.steps ?? [];
}

export function outputText(steps: Step[]): string {
  return steps
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => (Array.isArray(s.content) ? (s.content as { type: string; text?: string }[]) : []))
    .filter((c) => c.type === 'text' && c.text)
    .map((c) => c.text)
    .join('')
    .trim();
}

type Call = { name: string; arguments?: Record<string, unknown>; id: string };

/**
 * A turn with tools: the model may call tools several times before answering.
 * Returns the final text and what each tool returned, for the page to use.
 */
export async function runWithTools(opts: {
  system: string;
  input: Step[];
  tools: ToolDecl[];
  handlers: Record<string, ToolHandler>;
  maxRounds?: number;
}): Promise<{ text: string; results: { name: string; args: Record<string, unknown>; result: unknown }[] }> {
  const input = [...opts.input];
  const results: { name: string; args: Record<string, unknown>; result: unknown }[] = [];
  for (let round = 0; round < (opts.maxRounds ?? 4); round++) {
    const steps = await interact({ system: opts.system, input, tools: opts.tools });
    const calls = steps.filter((s) => s.type === 'function_call') as unknown as Call[];
    if (calls.length === 0) return { text: outputText(steps), results };
    input.push(...steps);
    for (const c of calls) {
      const args = c.arguments ?? {};
      let result: unknown;
      let isError = false;
      try {
        const h = opts.handlers[c.name];
        result = h ? await h(args) : { error: `outil inconnu ${c.name}` };
      } catch (e) {
        isError = true;
        result = { error: e instanceof Error ? e.message.slice(0, 200) : 'échec' };
      }
      results.push({ name: c.name, args, result });
      input.push({ type: 'function_result', name: c.name, call_id: c.id, result: JSON.stringify(result), ...(isError ? { is_error: true } : {}) });
    }
  }
  // Too many rounds: ask for an answer without tools.
  const last = await interact({ system: opts.system, input: [...input, { type: 'user_input', content: 'Réponds maintenant, sans autre outil.' }] });
  return { text: outputText(last), results };
}

/** A one-shot answer expected as JSON (fences and chatter tolerated). */
export async function askJson<T>(system: string, prompt: string): Promise<T> {
  const steps = await interact({ system, input: prompt, thinking: 'low' });
  return parseJsonLoose<T>(outputText(steps));
}

export function parseJsonLoose<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new ServiceError('bad_response', 'Réponse du modèle illisible.');
  }
}
