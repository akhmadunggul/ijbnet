import { GlobalSettings } from '../db/models/index';
import { decryptNullable } from './crypto';

interface DeepSeekResponse {
  choices: Array<{ message: { content: string } }>;
}

/**
 * Resolves the active DeepSeek API key.
 * DB value (encrypted) takes precedence over the DEEPSEEK_API_KEY env var.
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
 * Translate Indonesian text to Japanese using the DeepSeek chat API.
 * Returns null when the API key is absent, the text is empty, or the call fails.
 * Never throws — callers can safely fire-and-forget.
 */
export async function translateId2Ja(text: string): Promise<string | null> {
  const apiKey = await getDeepSeekApiKey();
  if (!apiKey || !text.trim()) return null;

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
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
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as DeepSeekResponse;
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}
