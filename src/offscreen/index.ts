import { CanvasRedactor, RedactionRegion } from '../privacy/canvas-redactor';
import { ExtensionMessage, ExtensionResponse } from '../types';

// Listen for offscreen canvas manipulation messages
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (res: ExtensionResponse) => void
  ) => {
    if (message.type === 'REDACT_IMAGE') {
      const payload = message.payload as { dataUrl: string; regions: RedactionRegion[] };
      CanvasRedactor.redactScreenshot(payload.dataUrl, payload.regions)
        .then((redactedUrl) => {
          sendResponse({ success: true, data: redactedUrl });
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          sendResponse({ success: false, error: msg });
        });
      return true;
    }
  }
);
