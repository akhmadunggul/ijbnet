import crypto from 'crypto';
import { GlobalSettings, CandidateCareer, Candidate } from '../db/models/index';
import { decryptNullable } from './crypto';
import { cacheDel } from './redis';
import { Op } from 'sequelize';

interface DeepSeekResponse {
  choices: Array<{ message: { content: string } }>;
}

export interface TranslateOptions {
  userId?: string;    // JWT sub — hashed before sending to DeepSeek
  timeoutMs?: number; // default 25_000
  context?: string;   // caller label for logs ('cv-live' | 'auto-save' | 'pdf' | ...)
}

interface TranslateResult {
  text: string | null;
  timedOut: boolean;
  latencyMs: number;
}

/** One-way hash of the user ID for DeepSeek's user field and log correlation. */
function hashUserId(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex').slice(0, 16);
}

/**
 * Resolves the active DeepSeek API key.
 * DB value (encrypted) takes precedence over DEEPSEEK_API_KEY env var.
 * Returns null when neither is set or decryption fails.
 */
export async function getDeepSeekApiKey(): Promise<string | null> {
  try {
    const row = await GlobalSettings.findOne({ where: { key: 'deepseek_api_key' } });
    if (row) {
      const val = (row.toJSON() as unknown as Record<string, unknown>)['value'];
      if (typeof val === 'string' && val) return decryptNullable(val);
    }
  } catch { /* DB not yet ready — fall through to env */ }
  return process.env['DEEPSEEK_API_KEY'] ?? null;
}

/**
 * Core translate call with structured logging and detailed result.
 * Used internally — external callers use translateId2Ja.
 */
async function callDeepSeek(text: string, apiKey: string, options: TranslateOptions): Promise<TranslateResult> {
  const { userId, timeoutMs = 25_000, context = 'unknown' } = options;
  const hashedUser = userId ? hashUserId(userId) : 'anon';
  const start = Date.now();

  const requestBody: Record<string, unknown> = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional translator specialising in Indonesian to Japanese translation for employment and resume documents. ' +
          'Translate the user message into natural, professional Japanese (敬体 / です・ます調 where appropriate). ' +
          'Output only the translated text — no explanations, no quotation marks, no preamble.',
      },
      { role: 'user', content: text.trim() },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    user: hashedUser, // DeepSeek user_id for content safety and usage isolation
  };

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const latencyMs = Date.now() - start;

    if (!response.ok) {
      console.warn('[translate]', JSON.stringify({
        context, user: hashedUser, textLen: text.trim().length,
        status: 'api_error', httpStatus: response.status, latencyMs,
      }));
      return { text: null, timedOut: false, latencyMs };
    }

    const data = (await response.json()) as DeepSeekResponse;
    const translated = data.choices?.[0]?.message?.content?.trim() ?? null;

    console.log('[translate]', JSON.stringify({
      context, user: hashedUser, textLen: text.trim().length,
      status: translated ? 'ok' : 'empty', outputLen: translated?.length ?? 0, latencyMs,
    }));

    return { text: translated, timedOut: false, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');

    console.warn('[translate]', JSON.stringify({
      context, user: hashedUser, textLen: text.trim().length,
      status: isTimeout ? 'timeout' : 'error',
      error: err instanceof Error ? err.message : String(err),
      latencyMs,
    }));

    return { text: null, timedOut: isTimeout, latencyMs };
  }
}

/**
 * Translate Indonesian text to Japanese using the DeepSeek API.
 * Returns the translated string, or null on any failure.
 * Never throws — safe for fire-and-forget callers.
 */
export async function translateId2Ja(text: string, options: TranslateOptions = {}): Promise<string | null> {
  const apiKey = await getDeepSeekApiKey();
  if (!apiKey || !text.trim()) return null;
  const { text: result } = await callDeepSeek(text, apiKey, options);
  return result;
}

/**
 * Fire-and-forget: translate all career entries for a candidate that have
 * companyBusinessActivity but no companyBusinessActivityJa, then save back.
 * Never throws.
 */
export async function backfillCareerJa(candidateId: string): Promise<void> {
  try {
    const autoTranslateSetting = await GlobalSettings.findOne({ where: { key: 'auto_translate' } });
    const autoTranslate = autoTranslateSetting
      ? (autoTranslateSetting.toJSON() as unknown as Record<string, unknown>)['value'] !== false
      : true;
    if (!autoTranslate) return;

    const entries = await CandidateCareer.findAll({
      where: {
        candidateId,
        companyBusinessActivity: { [Op.not]: null },
        companyBusinessActivityJa: { [Op.is]: null as any },
      },
    });
    if (!entries.length) return;

    await Promise.allSettled(
      entries.map(async (entry) => {
        const t = await translateId2Ja(entry.companyBusinessActivity!, { context: 'career-backfill' });
        if (t) await entry.update({ companyBusinessActivityJa: t });
      }),
    );

    // Invalidate the candidate's cached GET /me so next fetch returns translated data
    const cand = await Candidate.findByPk(candidateId, { attributes: ['userId'] });
    if (cand?.userId) await cacheDel(`cand:me:${cand.userId}`).catch(() => null);
  } catch { /* never fail the parent request */ }
}

/**
 * Like translateId2Ja but exposes timeout vs other error distinction.
 * Used by the live translate route to return 504 vs 502.
 */
export async function translateId2JaDetailed(
  text: string,
  options: TranslateOptions = {},
): Promise<TranslateResult & { keyMissing: boolean }> {
  const apiKey = await getDeepSeekApiKey();
  if (!apiKey) return { text: null, timedOut: false, latencyMs: 0, keyMissing: true };
  if (!text.trim()) return { text: null, timedOut: false, latencyMs: 0, keyMissing: false };
  const result = await callDeepSeek(text, apiKey, options);
  return { ...result, keyMissing: false };
}
