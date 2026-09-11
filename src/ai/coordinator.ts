import {
  ExtensionSettings,
  ExtractedDOMSummary,
  AgentMessage,
  RedactionReport,
} from '../types';
import { AIRouter, RoutingDecision } from './router';
import { OnDeviceViTEngine } from './ondevice/vit-engine';
import { CustomBackendClient } from './backend/custom-backend-client';
import { CanvasRedactor, RedactionRegion } from '../privacy/canvas-redactor';

const IMAGE_PII_TYPES = new Set(['face', 'aadhar_card', 'pan_card', 'passport', 'qr_code', 'document']);

/** Pulls the already-assigned label (e.g. "name-1") out of a sanitized "[name-1]" string. */
function extractLabel(sanitizedValue: string | undefined, sanitizedText: string | undefined, fallbackType: string | undefined): string {
  const source = sanitizedValue || sanitizedText || '';
  const match = source.match(/\[([^\]]+)\]/);
  return match ? match[1] : (fallbackType ? `${fallbackType}-1` : 'field-1');
}

export class AgentCoordinator {
  private vitEngine = new OnDeviceViTEngine();

  public async executeAgentTurn(
    prompt: string,
    domSummary: ExtractedDOMSummary,
    settings: ExtensionSettings,
    rawScreenshotUrl?: string
  ): Promise<{ message: AgentMessage; routing: RoutingDecision }> {
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
      const localRes = await this.vitEngine.processLocal(prompt, domSummary);
      answer = localRes.answer;
      actions = localRes.actions;
      modelUsed = localRes.modelUsed;
      isLocalExecution = true;
    } else {
      if (rawScreenshotUrl && settings.privacy.enabled) {
        const sensitiveRegions: RedactionRegion[] = domSummary.elements
          .filter((el) => el.isSensitive)
          .map((el) => ({
            box: el.boundingBox,
            label: extractLabel(el.value, el.text, el.piiType),
            redactionStyle: IMAGE_PII_TYPES.has(el.piiType ?? '') ? 'blur' : 'blackout',
          }));

        redactedScreenshot = await CanvasRedactor.redactScreenshot(
          rawScreenshotUrl,
          sensitiveRegions
        );
      } else {
        redactedScreenshot = rawScreenshotUrl;
      }

      const backendClient = new CustomBackendClient(settings.backend);
      const backendRes = await backendClient.generateAgentResponse(
        prompt,
        domSummary,
        redactedScreenshot
      );

      answer = backendRes.answer;
      actions = backendRes.actions;
      modelUsed = backendRes.modelUsed;
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