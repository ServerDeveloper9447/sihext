import {
  ExtensionSettings,
  ExtractedDOMSummary,
  AgentMessage,
  AgentAction,
  RedactionReport,
} from '../types';
import { AIRouter, RoutingDecision } from './router';
import { OnDeviceYOLOEngine } from './ondevice/yolo-engine';
import { CustomBackendClient } from './backend/custom-backend-client';
import { CanvasRedactor, RedactionRegion } from '../privacy/canvas-redactor';

// Document/identity-image classes get a full blackout (no reconstructable
// pixels left, matching the "precision of redaction" requirement) -- these
// should NEVER be merely blurred. "face" alone can use a softer blur since
// it's a demo-aesthetic choice, not a security requirement.
const BLACKOUT_PII_TYPES = new Set(['aadhar_card', 'pan_card', 'passport', 'qr_code', 'document']);
const BLUR_PII_TYPES = new Set(['face']);

/** Pulls the already-assigned label (e.g. "name-1") out of a sanitized "[name-1]" string. */
function extractLabel(sanitizedValue: string | undefined, sanitizedText: string | undefined, fallbackType: string | undefined): string {
  const source = sanitizedValue || sanitizedText || '';
  const match = source.match(/\[([^\]]+)\]/);
  return match ? match[1] : (fallbackType ? `${fallbackType}-1` : 'field-1');
}

function formatPiiType(piiType: string): string {
  const labels: Record<string, string> = {
    card_number: 'Card',
    aadhaar: 'Aadhaar',
    pan: 'PAN',
    pincode_in: 'Postal code',
    ssn: 'SSN',
    dob: 'Date of birth',
  };
  return labels[piiType] || piiType.replace(/_/g, ' ');
}

export class AgentCoordinator {
  private yoloEngine = new OnDeviceYOLOEngine();

  // Conversation-level history of prior action reasoning, sent to the
  // backend so it has context across turns of the same task. Reset this
  // (call resetHistory()) whenever the user starts a new task.
  private history: string[] = [];

  public resetHistory(): void {
    this.history = [];
  }

  public recordExecutionResult(
    action: AgentAction,
    result: { success: boolean; message?: string }
  ): void {
    const outcome = result.success ? 'succeeded' : 'failed';
    const detail = result.message ? `: ${result.message}` : '';
    this.history.push(`${action.type} ${action.description} ${outcome}${detail}`);
  }

  public async executeAgentTurn(
    prompt: string,
    domSummary: ExtractedDOMSummary,
    settings: ExtensionSettings,
    rawScreenshotUrl?: string
  ): Promise<{ message: AgentMessage; routing: RoutingDecision }> {
    const routing = AIRouter.decideRoute(prompt, domSummary, settings);

    let answer = '';
    let actions: AgentAction[] = [];
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

    if (rawScreenshotUrl && settings.privacy.enabled) {
      const sensitiveRegions: RedactionRegion[] = domSummary.elements
        .filter((el) => el.isSensitive)
        .flatMap((el) => {
          const piiType = el.piiType ?? '';
          const redactionStyle: 'blur' | 'blackout' = BLACKOUT_PII_TYPES.has(piiType)
            ? 'blackout'
            : BLUR_PII_TYPES.has(piiType)
            ? 'blur'
            : 'blackout';
          const boxes = el.sensitiveBoundingBoxes?.length
            ? el.sensitiveBoundingBoxes
            : el.isInput
            ? [el.boundingBox]
            : [];
          return boxes.map((box) => ({
            box,
            label: extractLabel(el.value, el.text, el.piiType),
            redactionStyle,
          }));
        });
      const seenBoxes = new Set(sensitiveRegions.map(({ box }) =>
        `${box.x}:${box.y}:${box.width}:${box.height}`
      ));
      for (const region of domSummary.sensitiveTextRegions || []) {
        const { boundingBox: box, piiType } = region;
        const key = `${box.x}:${box.y}:${box.width}:${box.height}`;
        if (seenBoxes.has(key)) continue;
        seenBoxes.add(key);
        sensitiveRegions.push({ box, label: formatPiiType(piiType), redactionStyle: 'blackout' });
      }

      redactedScreenshot = await CanvasRedactor.redactScreenshot(
        rawScreenshotUrl,
        sensitiveRegions,
        domSummary.viewport
      );
    }

    if (routing.target === 'on-device') {
      const localRes = await this.yoloEngine.processLocal(prompt, domSummary);
      answer = localRes.answer;
      actions = localRes.actions;
      modelUsed = localRes.modelUsed;
      isLocalExecution = true;
    } else {
      const backendClient = new CustomBackendClient(settings.backend);
      const backendRes = await backendClient.generateAgentResponse(
        prompt,
        domSummary,
        redactedScreenshot,
        this.history
      );

      answer = backendRes.answer;
      actions = [backendRes.action]; // server returns one action per call
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
      screenshotPreview: settings.privacy.enabled ? redactedScreenshot : undefined,
      pageContext: {
        title: domSummary.title,
        url: domSummary.url,
      },
    };

    return { message, routing };
  }
}