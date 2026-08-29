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

export class AgentCoordinator {
  private vitEngine = new OnDeviceViTEngine();

  /**
   * Orchestrates query execution across router, privacy filters, on-device ViT, and custom backend.
   */
  public async executeAgentTurn(
    prompt: string,
    domSummary: ExtractedDOMSummary,
    settings: ExtensionSettings,
    rawScreenshotUrl?: string
  ): Promise<{ message: AgentMessage; routing: RoutingDecision }> {
    // 1. Decide route (On-device ViT vs Custom Backend)
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
      // Execute with local on-device ViT engine (zero outbound traffic)
      const localRes = await this.vitEngine.processLocal(prompt, domSummary);
      answer = localRes.answer;
      actions = localRes.actions;
      modelUsed = localRes.modelUsed;
      isLocalExecution = true;
    } else {
      // 2. Prepare Custom Backend Request with Privacy Redaction
      if (rawScreenshotUrl && settings.privacy.enabled) {
        // Collect sensitive regions for image redaction
        const sensitiveRegions: RedactionRegion[] = domSummary.elements
          .filter((el) => el.isSensitive)
          .map((el) => ({
            box: el.boundingBox,
            label: '🔒 REDACTED',
            type: 'password',
          }));

        // Redact screenshot before sending to backend
        redactedScreenshot = await CanvasRedactor.redactScreenshot(
          rawScreenshotUrl,
          sensitiveRegions
        );
      } else {
        redactedScreenshot = rawScreenshotUrl;
      }

      // 3. Dispatch to our own model backend
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
