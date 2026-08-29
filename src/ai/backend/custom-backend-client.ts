import { ExtractedDOMSummary, AgentAction, CustomBackendConfig } from '../../types';

export interface CustomBackendResponse {
  answer: string;
  actions: AgentAction[];
  modelUsed: string;
  latencyMs?: number;
  tokensUsed?: number;
}

export class CustomBackendClient {
  private config: CustomBackendConfig;

  constructor(config: CustomBackendConfig) {
    this.config = config;
  }

  /**
   * Tests connectivity to the custom model backend.
   */
  public async testConnection(): Promise<{ ok: boolean; message: string; latencyMs: number }> {
    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(this.config.customHeaders || {}),
      };

      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      // Try GET/POST health probe
      const res = await fetch(this.config.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ping: true }),
        signal: controller.signal,
      }).catch(async () => {
        // Fallback to GET probe
        return await fetch(this.config.endpointUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - start);

      if (res.status < 500) {
        return {
          ok: true,
          message: `Backend reachable (HTTP ${res.status}) in ${latencyMs}ms`,
          latencyMs,
        };
      } else {
        return {
          ok: false,
          message: `Backend returned error HTTP ${res.status}: ${res.statusText}`,
          latencyMs,
        };
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - start);
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        message: `Connection failed: ${msg}`,
        latencyMs,
      };
    }
  }

  /**
   * Sends sanitized DOM + query + redacted screenshot to our custom model backend.
   */
  public async generateAgentResponse(
    prompt: string,
    domSummary: ExtractedDOMSummary,
    redactedScreenshotUrl?: string
  ): Promise<CustomBackendResponse> {
    if (!this.config.endpointUrl) {
      throw new Error('Custom backend endpoint URL is not configured. Please set it in Extension Settings.');
    }

    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutMs = this.config.timeoutMs || 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.config.customHeaders || {}),
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const payload = {
      query: prompt,
      model: this.config.modelName || 'custom-dom-agent-v1',
      page: {
        title: domSummary.title,
        url: domSummary.url,
        viewport: domSummary.viewport,
      },
      elements: domSummary.elements.slice(0, 120).map((el) => ({
        refId: el.refId,
        tagName: el.tagName,
        type: el.type,
        text: el.text,
        placeholder: el.placeholder,
        role: el.role,
        ariaLabel: el.ariaLabel,
        isInput: el.isInput,
        isClickable: el.isClickable,
        boundingBox: el.boundingBox,
        selector: el.selector,
      })),
      screenshot: redactedScreenshotUrl || null,
      timestamp: Date.now(),
    };

    try {
      const response = await fetch(this.config.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `Custom Backend Error (${response.status}): ${errorText || response.statusText}`
        );
      }

      const result = await response.json();
      const latencyMs = Math.round(performance.now() - startTime);

      // Support multiple response shapes from custom backend
      // Shape A: { answer: "...", actions: [ ... ] }
      // Shape B: { message: "...", plan: [ ... ] }
      // Shape C: { choices: [{ message: { content: "{ answer, actions }" } }] } (OpenAI style)
      if (result.choices && result.choices[0]?.message?.content) {
        const rawContent = result.choices[0].message.content;
        try {
          const parsed = JSON.parse(rawContent);
          return {
            answer: parsed.answer || rawContent,
            actions: (parsed.actions || []).map((a: AgentAction, idx: number) => ({
              ...a,
              id: a.id || `act-${Date.now()}-${idx}`,
              status: 'pending',
            })),
            modelUsed: `Custom Backend (${this.config.modelName})`,
            latencyMs,
          };
        } catch {
          return {
            answer: rawContent,
            actions: [],
            modelUsed: `Custom Backend (${this.config.modelName})`,
            latencyMs,
          };
        }
      }

      const answer = result.answer || result.message || result.response || 'Action plan formulated.';
      const rawActions = result.actions || result.plan || [];

      const actions: AgentAction[] = Array.isArray(rawActions)
        ? rawActions.map((a: Partial<AgentAction>, idx: number) => ({
            id: a.id || `act-${Date.now()}-${idx}`,
            type: (a.type || 'click') as AgentAction['type'],
            refId: a.refId,
            selector: a.selector,
            value: a.value,
            scrollDirection: a.scrollDirection,
            description: a.description || `Execute ${a.type || 'action'}`,
            status: 'pending',
          }))
        : [];

      return {
        answer,
        actions,
        modelUsed: `Custom Backend (${this.config.modelName || 'Self-Hosted'})`,
        latencyMs,
        tokensUsed: result.tokensUsed,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Custom backend request timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    }
  }
}
