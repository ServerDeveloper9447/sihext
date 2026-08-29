import { ExtractedDOMSummary, AgentAction } from '../../types';
import { CloudAIResponse } from './gemini';

export class OpenAIClient {
  private apiKey: string;
  private model: string;
  private customBaseUrl: string;

  constructor(apiKey: string, model = 'gpt-4o-mini', customBaseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.customBaseUrl = customBaseUrl.replace(/\/+$/, '');
  }

  public async generateAgentResponse(
    prompt: string,
    domSummary: ExtractedDOMSummary,
    redactedScreenshotUrl?: string
  ): Promise<CloudAIResponse> {
    if (!this.apiKey && !this.customBaseUrl.includes('localhost')) {
      throw new Error('OpenAI API Key is missing. Please set it in Extension Options.');
    }

    const endpoint = `${this.customBaseUrl}/chat/completions`;

    const systemPrompt = `
You are an expert AI browser agent operating on a sanitized webpage.
All sensitive data (passwords, credit cards, faces) have been pre-stripped/masked.

Evaluate the user request and the sanitized DOM elements to answer questions or formulate automation steps.
Always respond in JSON format with "answer" (string) and "actions" (array of action objects).
Action types: "click", "type", "scroll", "select", "submit", "navigate".
Use refIds (e.g. "sihext-1") for target elements.
`;

    const messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }> = [
      { role: 'system', content: systemPrompt },
    ];

    const contentArray: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: `PAGE CONTEXT:
Title: ${domSummary.title}
URL: ${domSummary.url}
Viewport: ${domSummary.viewport.width}x${domSummary.viewport.height}

INTERACTIVE ELEMENTS:
${JSON.stringify(
  domSummary.elements.slice(0, 100).map((el) => ({
    refId: el.refId,
    tag: el.tagName,
    type: el.type,
    text: el.text,
    placeholder: el.placeholder,
    role: el.role,
    ariaLabel: el.ariaLabel,
    isInput: el.isInput,
    isClickable: el.isClickable,
    bounds: el.boundingBox,
  }))
)}

USER REQUEST:
${prompt}`,
      },
    ];

    if (redactedScreenshotUrl && redactedScreenshotUrl.startsWith('data:image')) {
      contentArray.push({
        type: 'image_url',
        image_url: {
          url: redactedScreenshotUrl,
          detail: 'low',
        },
      });
    }

    messages.push({ role: 'user', content: contentArray });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `OpenAI API Error (${response.status}): ${errorData.error?.message || response.statusText}`
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response received from OpenAI API');
    }

    try {
      const parsed = JSON.parse(content);
      return {
        answer: parsed.answer || content,
        actions: (parsed.actions || []).map((a: AgentAction, idx: number) => ({
          ...a,
          id: a.id || `act-${Date.now()}-${idx}`,
          status: 'pending',
        })),
        modelUsed: `OpenAI (${this.model})`,
        tokensUsed: result.usage?.total_tokens,
      };
    } catch {
      return {
        answer: content,
        actions: [],
        modelUsed: `OpenAI (${this.model})`,
      };
    }
  }
}
