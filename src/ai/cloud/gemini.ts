import { ExtractedDOMSummary, AgentAction } from '../../types';

export interface CloudAIResponse {
  answer: string;
  actions: AgentAction[];
  modelUsed: string;
  tokensUsed?: number;
}

export class GeminiClient {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'gemini-1.5-flash') {
    this.apiKey = apiKey;
    this.model = model;
  }

  public async generateAgentResponse(
    prompt: string,
    domSummary: ExtractedDOMSummary,
    redactedScreenshotUrl?: string
  ): Promise<CloudAIResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API Key is missing. Please set it in Extension Options.');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const systemInstructions = `
You are an expert AI browser agent. You have direct perception of a sanitized webpage DOM and screenshot.
All sensitive data (passwords, credit cards, faces) have been pre-stripped/masked.

Your task is to:
1. Answer the user's question or explain the page.
2. If the user wants an action executed on the page, generate an explicit list of actions using the available refIds (e.g. data-sihext-ref="sihext-1").

ALWAYS respond in valid JSON format matching this schema:
{
  "answer": "Clear markdown explanation or response to user",
  "actions": [
    {
      "id": "act-1",
      "type": "click" | "type" | "scroll" | "select" | "submit" | "navigate",
      "refId": "sihext-1",
      "value": "text to type if type action",
      "scrollDirection": "down" | "up",
      "description": "Brief user-facing description of what this action does"
    }
  ]
}
`;

    const userContentParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];

    // Add DOM context and prompt
    const contextPrompt = `
SYSTEM INSTRUCTION:
${systemInstructions}

PAGE CONTEXT:
URL: ${domSummary.url}
Title: ${domSummary.title}
Viewport: ${domSummary.viewport.width}x${domSummary.viewport.height}

INTERACTIVE DOM ELEMENTS (Sanitized):
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
  })),
  null,
  2
)}

USER REQUEST:
${prompt}
`;

    userContentParts.push({ text: contextPrompt });

    // Attach redacted screenshot if available
    if (redactedScreenshotUrl && redactedScreenshotUrl.startsWith('data:image')) {
      const base64Data = redactedScreenshotUrl.split(',')[1];
      const mimeType = redactedScreenshotUrl.split(';')[0].split(':')[1] || 'image/jpeg';
      userContentParts.push({
        inline_data: {
          mime_type: mimeType,
          data: base64Data,
        },
      });
    }

    const payload = {
      contents: [
        {
          role: 'user',
          parts: userContentParts,
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Gemini API Error (${response.status}): ${errorData.error?.message || response.statusText}`
      );
    }

    const result = await response.json();
    const candidateText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('Empty response received from Gemini API');
    }

    try {
      const parsed = JSON.parse(candidateText);
      return {
        answer: parsed.answer || candidateText,
        actions: (parsed.actions || []).map((a: AgentAction, idx: number) => ({
          ...a,
          id: a.id || `act-${Date.now()}-${idx}`,
          status: 'pending',
        })),
        modelUsed: `Gemini (${this.model})`,
        tokensUsed: result.usageMetadata?.totalTokenCount,
      };
    } catch {
      return {
        answer: candidateText,
        actions: [],
        modelUsed: `Gemini (${this.model})`,
      };
    }
  }
}
