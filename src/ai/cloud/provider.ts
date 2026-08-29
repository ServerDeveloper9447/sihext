import {
  ExtensionSettings,
  ExtractedDOMSummary,
  AgentMessage,
  RedactionReport,
} from '../../types';
import { AIRouter, RoutingDecision } from '../router';
import { OnDeviceViTEngine } from '../ondevice/vit-engine';
import { GeminiClient, CloudAIResponse } from './gemini';
import { OpenAIClient } from './openai';
import { AnthropicClient } from './anthropic';
import { CanvasRedactor, RedactionRegion } from '../../privacy/canvas-redactor';

export class AgentCoordinator {
  private vitEngine = new OnDeviceViTEngine();

  /**
   * Orchestrates query execution across router, privacy filters, on-device ViT, and cloud providers.
   */
  public async executeAgentTurn(
    prompt: string,
    domSummary: ExtractedDOMSummary,
    settings: ExtensionSettings,
    rawScreenshotUrl?: string
  ): Promise<{ message: AgentMessage; routing: RoutingDecision }> {
    // 1. Decide route (On-device vs Cloud)
    const routing = AIRouter.decideRoute(prompt, domSummary, settings);

    let answer = '';
    let actions = [];
    let modelUsed = '';
    let isLocalExecution = false;
    let redactedScreenshot: string | undefined;

    const redactionReport: RedactionReport = {
      passwordsMasked: domSummary.sensitiveElementsCount,
      emailsMasked: 0,
      phonesMasked: 0,
      creditCardsMasked: 0,
      facesMasked: 0,
      customMasks: 0,
      totalRedacted: domSummary.sensitiveElementsCount,
      redactedLabels: domSummary.sensitiveElementsCount > 0 ? ['Sensitive Input/Password'] : [],
    };

    if (routing.target === 'on-device') {
      // Execute with local on-device ViT engine
      const localRes = await this.vitEngine.processLocal(prompt, domSummary);
      answer = localRes.answer;
      actions = localRes.actions;
      modelUsed = localRes.modelUsed;
      isLocalExecution = true;
    } else {
      // 2. Prepare Cloud Request with Privacy Redaction
      if (rawScreenshotUrl && settings.privacy.enabled) {
        // Collect sensitive regions for image redaction
        const sensitiveRegions: RedactionRegion[] = domSummary.elements
          .filter((el) => el.isSensitive)
          .map((el) => ({
            box: el.boundingBox,
            label: '🔒 REDACTED',
            type: 'password',
          }));

        // Redact screenshot before transmission
        redactedScreenshot = await CanvasRedactor.redactScreenshot(
          rawScreenshotUrl,
          sensitiveRegions
        );
      } else {
        redactedScreenshot = rawScreenshotUrl;
      }

      // 3. Dispatch to selected cloud provider
      let cloudRes: CloudAIResponse;

      switch (settings.selectedProvider) {
        case 'gemini': {
          const client = new GeminiClient(settings.providers.geminiApiKey || '', settings.cloudModel);
          cloudRes = await client.generateAgentResponse(prompt, domSummary, redactedScreenshot);
          break;
        }

        case 'openai': {
          const client = new OpenAIClient(
            settings.providers.openaiApiKey || '',
            settings.cloudModel || 'gpt-4o-mini',
            settings.providers.customEndpoint
          );
          cloudRes = await client.generateAgentResponse(prompt, domSummary, redactedScreenshot);
          break;
        }

        case 'anthropic': {
          const client = new AnthropicClient(
            settings.providers.anthropicApiKey || '',
            settings.cloudModel || 'claude-3-5-sonnet-20241022'
          );
          cloudRes = await client.generateAgentResponse(prompt, domSummary, redactedScreenshot);
          break;
        }

        default: {
          const client = new GeminiClient(settings.providers.geminiApiKey || '', 'gemini-1.5-flash');
          cloudRes = await client.generateAgentResponse(prompt, domSummary, redactedScreenshot);
        }
      }

      answer = cloudRes.answer;
      actions = cloudRes.actions;
      modelUsed = cloudRes.modelUsed;
      isLocalExecution = false;
    }

    const message: AgentMessage = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: answer,
      timestamp: Date.now(),
      modelUsed,
      isLocalExecution,
      redactionReport,
      actions,
      screenshotPreview: redactedScreenshot,
      pageContext: {
        title: domSummary.title,
        url: domSummary.url,
      },
    };

    return { message, routing };
  }
}
