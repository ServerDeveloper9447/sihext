import { ExtractedDOMSummary, AgentAction, CustomBackendConfig, ServerAgentAction, fromServerAction } from '../../types';
import { denormalizeCoordinates } from '../../utils/coordinates';

export interface CustomBackendResponse {
  answer: string;
  action: AgentAction;
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
   * Tests connectivity to the agent server (GET /health).
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

      const healthUrl = this.config.endpointUrl.replace(/\/agent\/?$/, '/health');
      const res = await fetch(healthUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
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
   * Sends the redacted DOM + task + sanitized screenshot + prior action
   * history to the agent server and returns the SINGLE next action to
   * execute. This is a one-action-per-call loop, not a full multi-step
   * plan -- call this again after executing the returned action, with an
   * updated history, until the action is "done".
   */
  public async generateAgentResponse(
    task: string,
    domSummary: ExtractedDOMSummary,
    redactedScreenshotUrl?: string,
    history: string[] = []
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

    // Matches SanitizedRequestSchema in schemas.py exactly.
    const pageUrl = new URL(domSummary.url);
    const pageContext = [
      `Page: ${domSummary.title}`,
      `Site: ${pageUrl.origin}`,
      `Viewport: ${domSummary.viewport.width}x${domSummary.viewport.height}`,
      `Interactive elements: ${domSummary.interactiveCount}; sensitive fields: ${domSummary.sensitiveElementsCount}`,
    ].join('\n');
    const availableValueTokens = new Map<string, string>();
    for (const region of domSummary.sensitiveTextRegions || []) {
      availableValueTokens.set(region.valueToken, region.piiType);
    }
    for (const element of domSummary.elements) {
      if (!element.isSensitive || !element.piiType) continue;
      for (const source of [element.value, element.text]) {
        const valueToken = source?.match(/^\[([A-Za-z][A-Za-z0-9_]*-\d+)\]$/)?.[1];
        if (valueToken) availableValueTokens.set(valueToken, element.piiType);
      }
    }
    const localValueTokens = Array.from(availableValueTokens.entries())
      .map(([valueToken, piiType]) => `${piiType}=[${valueToken}]`);
    const pageValueContext = localValueTokens.length > 0
      ? `Detected page values (local-only tokens; use the exact token as the action value): ${localValueTokens.join(', ')}`
      : 'No detected page-value tokens are available.';
    const payload = {
      task: `${pageContext}\n${pageValueContext}\n\nUser request: ${task}`,
      screenshot: redactedScreenshotUrl || null,
      dom: {
        elements: domSummary.elements.slice(0, 120).map((el) => ({
          element_id: Number(el.refId.replace(/^sihext-/, '')),
          tag: el.tagName,
          label: [
            el.label || el.value || el.text || el.ariaLabel || el.placeholder || el.name || '',
            el.name ? `name=${el.name}` : '',
            el.type ? `type=${el.type}` : '',
            el.role ? `role=${el.role}` : '',
            el.autocomplete ? `autocomplete=${el.autocomplete}` : '',
            el.required ? 'required' : '',
            el.isSensitive ? `sensitive=${el.piiType || 'true'}` : '',
          ].filter(Boolean).join(' | ').replace(/^\[([^\]]+)\]$/, '$1').slice(0, 500),
        })),
      },
      history,
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
          `Agent Server Error (${response.status}): ${errorText || response.statusText}`
        );
      }

      const result: ServerAgentAction = await response.json();
      const latencyMs = Math.round(performance.now() - startTime);

      // The model returns x/y on a 0-1000 scale; convert to real viewport
      // pixels here, once, so everything downstream (the executor) only ever
      // deals with real coordinates.
      const action = denormalizeCoordinates(
        fromServerAction(result, `act-${Date.now()}`),
        domSummary.viewport
      );

      // "answer" isn't a DOM action -- surface answer_text as the chat
      // response. Everything else shows its one-sentence reasoning so the
      // user can see what the agent is about to do.
      const answer = result.action === 'answer' && result.answer_text
        ? result.answer_text
        : result.reasoning;

      return {
        answer,
        action,
        modelUsed: `Agent Server (${this.config.modelName})`,
        latencyMs,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Agent server request timed out after ${timeoutMs / 1000}s`);
      }
      throw err;
    }
  }
}