// @ts-nocheck

// apps/proselenos-app/src/lib/providers/openrouter.ts

import { OpenAI } from 'openai';

// ---- Public types ---------------------------------------------------------
export interface AIConfig {
  model_name?: string;
  temperature?: number;
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  [key: string]: any;
}

export interface StreamOptions {
  temperature?: number;
  onDone?: (finishReason?: string) => void;
  logChunks?: boolean;
  signal?: AbortSignal;
}

export interface ModelData {
  id: string;
  [key: string]: any;
}

// ---- Helper utilities -----------------------------------------------------
function isRetryableCode(code: unknown): boolean {
  const n = Number(code);
  return [429, 500, 502, 503, 504].includes(n);
}

function formatProviderError(src: any): Error {
  const prov = src?.metadata?.provider_name ?? 'provider';
  const code = src?.code ?? '?';
  const msg = src?.message ?? 'Stream error';
  const err: any = new Error(`[${prov}] ${code}: ${msg}`);
  err.code = code;
  err.retryable = !!src?.metadata?.raw?.retryable || isRetryableCode(code);
  return err as Error;
}

// ---- Provider class -------------------------------------------------------
export class AiApiService {
  private client: OpenAI | null = null;
  private model: string;
  private temperature: number;
  private apiKeyMissing = false;
  public prompt: string | null = null;
  public user: string = "proselenos";

  constructor(config: AIConfig = {}) {
    const apiKey = config.apiKey;
    const baseURL = "https://openrouter.ai/api/v1";
    const headers = config.headers ?? {
        'HTTP-Referer': 'https://everythingebooks.org',
        'X-Title': 'EverythingEbooks'
    };

    this.model = config.model_name ?? ' ';
    this.temperature = typeof config.temperature === 'number' ? config.temperature : 0.2;
    this.apiKeyMissing = !apiKey;

    if (apiKey) {
      this.client = new OpenAI({ apiKey, baseURL, defaultHeaders: headers });
    }
  }

  // ---- configuration ------------------------------------------------------
  setPrompt(manuscript: string) {
    this.prompt = manuscript ?? '';
  }

  setModel(model: string) {
    this.model = model;
  }

  setTemperature(t: number) {
    this.temperature = t;
  }

  isChatCompatible(model: string | { id?: string }): boolean {
    const id = typeof model === 'string' ? model : model?.id ?? '';
    // exclude obviously non-chat families; allow gpt-5* etc.
    return !/(embedding|whisper|tts|audio-)/i.test(id);
  }

  async verifyAiAPI(): Promise<boolean> {
    if (this.apiKeyMissing || !this.client) return false;
    try {
      const models = await this.client.models.list();
      return !!(models?.data?.length);
    } catch (err) {
      console.warn('OpenRouter verifyAiAPI failed:', err);
      return false;
    }
  }

  async getAvailableModels(): Promise<ModelData[]> {
    if (this.apiKeyMissing || !this.client) {
      return [];
    }

    try {
      const models = await this.client.models.list();
      const allModels = models.data || [];
      
      // Filter for chat-compatible models only and sort alphabetically
      return allModels
        .filter((model: ModelData) => this.isChatCompatible(model))
        .sort((a: ModelData, b: ModelData) => a.id.localeCompare(b.id));
    } catch (error: any) {
      console.error('OpenRouter models list error:', error.message);
      return [];
    }
  }

  // ---- request builders ---------------------------------------------------
  private buildMessages(userPrompt: string) {
    // If caller has already embedded manuscript markers, pass-through
    if (this.prompt?.trimStart().startsWith('=== MANUSCRIPT ===')) {
      const full = `${this.prompt}\n\n=== INSTRUCTIONS ===\n${userPrompt}\n=== END INSTRUCTIONS ===`;
      return [
        { role: 'user', content: full },
      ];
    }

    // Otherwise, embed manuscript plainly
    const manuscript = this.prompt ?? '';
    const combined = `=== MANUSCRIPT ===\n${manuscript}\n=== END MANUSCRIPT ===\n\n=== INSTRUCTIONS ===\n${userPrompt}\n=== END INSTRUCTIONS ===`;
    return [
      { role: 'user', content: combined },
    ];
  }

  private buildCreateParams(messages: any[], opts?: Partial<StreamOptions>) {
    return {
      model: this.model,
      temperature: typeof opts?.temperature === 'number' ? opts.temperature : this.temperature,
      messages,
    } as any;
  }

  // ---- non-stream completion ---------------------------
  async completeOnce(prompt: string): Promise<string> {
    if (!this.client || this.apiKeyMissing) throw new Error('OpenRouter client not initialized - missing API key');
    if (!this.prompt) throw new Error('No manuscript loaded.');

    const messages = this.buildMessages(prompt);
    const params = this.buildCreateParams(messages);

    const res: any = await this.client.chat.completions.create({
      ...params,
      stream: false,
    });

    const text = res?.choices?.[0]?.message?.content ?? '';
    return typeof text === 'string' ? text : '';
  }

  // ---- stream with robust error handling --------------------
  async streamWithThinking(
    prompt: string,
    onText: (text: string) => void,
    options: StreamOptions = {}
  ): Promise<void> {
    if (!this.client || this.apiKeyMissing) throw new Error('OpenRouter client not initialized - missing API key');
    if (!this.prompt) throw new Error('No manuscript loaded.');

    const messages = this.buildMessages(prompt);
    const params = this.buildCreateParams(messages, options);

    // Create stream inside the function to avoid TDZ/circular init issues in Next.js
    // Pass abort signal to OpenAI client for timeout support
    const stream: AsyncIterable<any> = await this.client.chat.completions.create(
      {
        ...params,
        stream: true,
      },
      { signal: options.signal }
    ) as any;

    let lastFinish: string | undefined;

    try {
      for await (const chunk of stream) {
        // 1) Top-level streamed error (some providers)
        const topErr = (chunk as any)?.error;
        if (topErr) throw formatProviderError(topErr);

        const choice = (chunk as any)?.choices?.[0];
        if (!choice) continue;

        // 2) Choice-level provider error
        const chErr = (choice as any)?.error;
        if (chErr) throw formatProviderError(chErr);

        // 3) finish_reason can be "error" in some streams
        const finishReason = (choice as any)?.finish_reason;
        if (finishReason === 'error') {
          const e: any = new Error('Stream ended with finish_reason=error');
          e.retryable = true; // informational only; you are NOT retrying
          throw e;
        }

        // 4) Normal delta
        const text = (choice as any)?.delta?.content;
        if (typeof text === 'string' && text.length) onText(text);

        if (finishReason) lastFinish = finishReason;
      }
    } catch (error: any) {
      // Handle abort signal timeout
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        throw new Error('TOOL_TIMEOUT_ABORTED');
      }
      throw error;
    }

    // OpenAI SDK may swallow abort and end stream cleanly - check explicitly
    if (options.signal?.aborted) {
      throw new Error('TOOL_TIMEOUT_ABORTED');
    }

    options.onDone?.(lastFinish);

  }

  async countTokens(text: string): Promise<number> {
    try {
      if (!this.client || this.apiKeyMissing || !this.model) {
        throw new Error('OpenRouter client not initialized or model not set');
      }
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: text }],
        max_tokens: 16, // minimal generation to save costs
        temperature: 0
      });
      return response.usage?.prompt_tokens || -1;
    } catch (error: any) {
      console.error('Token counting error:', error);
      return -1;
    }
  }
}

export default AiApiService;
