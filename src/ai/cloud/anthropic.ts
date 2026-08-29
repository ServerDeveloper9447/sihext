import { ExtractedDOMSummary, AgentAction } from '../../types';
import { CloudAIResponse } from './gemini';

export class AnthropicClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'claude-3-5-sonnet-20241022') {
    this.apiKey = apiKey;
    this.model = model;
  }

  public async generateAgentResponse(
    prompt: string,
    domSummary: ExtractedDOMSummary,
    redactedScreenshotUrl?: string
  ): Promise<CloudAIResponse> {
    if (!this.apiKey) {
      throw new Error('Anthropic API Key is missing. Please set it in Extension Options.');
    }

    const endpoint = 'https://api.anthropic.com/v1/messages';

    const systemPrompt = `
You are an expert AI browser agent. You operate on sanitized DOM representations.
All sensitive data (passwords, credit cards, faces) have been pre-stripped/masked.

Evaluate the user request and DOM context to respond with valid JSON:
{
  "answer": "Explanation to user",
  "actions": [
    {
      "id": "act-1",
      "type": "click" | "type" | "scroll" | "select" | "submit" | "navigate",
      "refId": "sihext-1",
      "value": "string",
      "description": "action description"
    }
  ]
}
`;

    const userContent: Array<Record<string, unknown>> = [];

    if (redactedScreenshotUrl && redactedScreenshotUrl.startsWith('data:image')) {
      const base64Data = redactedScreenshotUrl.split(',')[1];
      const mediaType = redactedScreenshotUrl.split(';')[0].split(':')[1] || 'image/jpeg';
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      });
    }

    userContent.push({
      type: 'text',
      text: `PAGE CONTEXT:
Title: ${domSummary.title}
URL: ${domSummary.url}

ELEMENTS:
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
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Anthropic API Error (${response.status}): ${errorData.error?.message || response.statusText}`
      );
    }

    const result = await response.json();
    const textPart = result.content?.find((c: { type: string; text?: string }) => c.type === 'text');
    const content = textPart?.text || '';

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);
      return {
        answer: parsed.answer || content,
        actions: (parsed.actions || []).map((a: AgentAction, idx: number) => ({
          ...a,
          id: a.id || `act-${Date.now()}-${idx}`,
          status: 'pending',
        })),
        modelUsed: `Anthropic (${this.model})`,
        tokensUsed: result.usage?.input_tokens + result.usage?.output_tokens,
      };
    } catch {
      return {
        answer: content,
        actions: [],
        modelUsed: `Anthropic (${this.model})`,
      };
    }
  }
}
