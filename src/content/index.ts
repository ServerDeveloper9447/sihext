import { DOMExtractor } from './dom-extractor';
import { ActionExecutor } from './action-executor';
import { ElementHighlighter } from './highlighter';
import { DEFAULT_SETTINGS, getStoredSettings } from '../utils/storage';
import { ExtensionMessage, ExtensionResponse, AgentAction, ExtractedDOMSummary } from '../types';

let extractor: DOMExtractor;
const executor = new ActionExecutor();
const highlighter = new ElementHighlighter();

// Initialize extractor with saved privacy settings
getStoredSettings().then((settings) => {
  extractor = new DOMExtractor(settings.privacy);
}).catch(() => {
  extractor = new DOMExtractor(DEFAULT_SETTINGS.privacy);
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    extractor?.cleanupOverlays(true);
    highlighter?.clear();
  }
});

window.addEventListener('click', (e) => {
  if (!e.isTrusted) return;
  const existing = document.getElementById('som-overlay-container');
  if (existing) {
    extractor?.removeVisualOverlays();
  }
}, { capture: true });

// Listen for messages from background script or sidepanel/popup
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage & { action?: string; payload?: unknown },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionResponse) => void
  ) => {
    handleMessage(message)
      .then((res) => sendResponse(res))
      .catch((err: unknown) => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: errorMsg });
      });

    return true; // Keep message channel open for asynchronous response
  }
);

async function handleMessage(
  message: ExtensionMessage & { action?: string; payload?: unknown }
): Promise<ExtensionResponse> {
  const msgType = message.type || message.action;

  switch (msgType) {
    case 'PING':
      return { success: true, data: { status: 'ready', url: window.location.href } };

    case 'GET_PAGE_DOM': {
      if (!extractor) {
        const settings = await getStoredSettings();
        extractor = new DOMExtractor(settings.privacy);
      }
      extractor.cleanupOverlays();
      const domSummary: ExtractedDOMSummary = await extractor.extractDOM({ injectOverlays: false });
      return { success: true, data: domSummary };
    }

    case 'PREPARE_DOM':
    case 'ANNOTATE_DOM': {
      if (!extractor) {
        const settings = await getStoredSettings();
        extractor = new DOMExtractor(settings.privacy);
      }
      const domSummary: ExtractedDOMSummary = await extractor.extractDOM({ injectOverlays: true });
      const piiBoxes = domSummary.elements.filter((e) => e.isSensitive).map((e) => e.boundingBox);
      return {
        success: true,
        data: domSummary,
        // Match content.js shape for background.js consumer
        ...({ piiBoxes, interactiveElements: domSummary.elements } as any),
      };
    }

    case 'EXECUTE_ACTION': {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (!rawPayload) {
        return { success: false, error: 'No action provided' };
      }

      let action: AgentAction;
      if (rawPayload.action && !rawPayload.type) {
        const actionType = String(rawPayload.action) as AgentAction['type'];
        const targetId = rawPayload.target_id ? String(rawPayload.target_id) : undefined;
        action = {
          id: `act-${Date.now()}`,
          type: actionType,
          refId: targetId ? `sihext-${targetId}` : (rawPayload.refId as string | undefined),
          value: rawPayload.value as string | undefined,
          description: (rawPayload.description as string) || `${actionType} on target [${targetId || ''}]`,
          status: 'pending',
        };
      } else {
        action = rawPayload as unknown as AgentAction;
      }

      // Highlight target element during action execution
      if (action.refId) {
        highlighter.highlight(action.refId, `${action.type.toUpperCase()}: ${action.description}`);
      }

      const result = await executor.execute(action);

      extractor?.removeVisualOverlays();
      setTimeout(() => {
        highlighter.clear();
        extractor?.cleanupOverlays(true);
      }, 1200);

      return { success: result.success, data: result };
    }

    case 'HIGHLIGHT_ELEMENT': {
      const { refId, label, variant } = (message.payload as { refId: string; label?: string; variant?: 'action' | 'inspect' | 'sensitive' }) || {};
      if (refId) {
        highlighter.highlight(refId, label, variant);
      }
      return { success: true };
    }

    case 'CLEAR_HIGHLIGHT': {
      highlighter.clear();
      return { success: true };
    }

    case 'CLEANUP_OVERLAYS':
    case 'CLEANUP_DOM': {
      extractor?.removeVisualOverlays();
      return { success: true };
    }

    case 'RESET_DOM': {
      highlighter.clear();
      extractor?.cleanupOverlays(true);
      return { success: true };
    }

    default:
      return { success: false, error: `Unhandled message type: ${msgType}` };
  }
}
