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

// Listen for messages from background script or sidepanel/popup
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
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

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'PING':
      return { success: true, data: { status: 'ready', url: window.location.href } };

    case 'GET_PAGE_DOM': {
      if (!extractor) {
        const settings = await getStoredSettings();
        extractor = new DOMExtractor(settings.privacy);
      }
      const domSummary: ExtractedDOMSummary = extractor.extractDOM();
      return { success: true, data: domSummary };
    }

    case 'EXECUTE_ACTION': {
      const action = message.payload as AgentAction;
      if (!action) {
        return { success: false, error: 'No action provided' };
      }

      // Highlight target element during action execution
      if (action.refId) {
        highlighter.highlight(action.refId, `${action.type.toUpperCase()}: ${action.description}`);
      }

      const result = await executor.execute(action);

      // Auto-clear highlight after 1.5 seconds
      setTimeout(() => highlighter.clear(), 1500);

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

    default:
      return { success: false, error: `Unhandled message type: ${message.type}` };
  }
}
