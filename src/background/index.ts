import { DEFAULT_SETTINGS, getStoredSettings, saveStoredSettings } from '../utils/storage';
import { ExtensionMessage, ExtensionResponse } from '../types';

// Handle extension install and setup defaults
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    const existing = await getStoredSettings();
    if (!existing.selectedProvider) {
      await saveStoredSettings(DEFAULT_SETTINGS);
    }
  }

  // Enable side panel on all sites
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
});

// Listen for keyboard shortcut commands
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle_sidepanel') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id && tab.windowId && chrome.sidePanel) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch((err) => {
        console.error('Error opening side panel:', err);
      });
    }
  }
});

// Central message dispatcher in Service Worker
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (res: ExtensionResponse) => void
  ) => {
    handleBackgroundMessage(message, sender)
      .then((res) => sendResponse(res))
      .catch((err: unknown) => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: errorMsg });
      });

    return true;
  }
);

async function handleBackgroundMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender
): Promise<ExtensionResponse> {
  switch (message.type) {
    case 'PING':
      return { success: true, data: { status: 'background_active' } };

    case 'OPEN_SIDE_PANEL': {
      if (chrome.sidePanel && sender.tab?.windowId) {
        await chrome.sidePanel.open({ windowId: sender.tab.windowId });
        return { success: true };
      }
      return { success: false, error: 'SidePanel API not available or no windowId' };
    }

    case 'CAPTURE_TAB': {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.windowId) {
          return { success: false, error: 'No active window found for screenshot capture' };
        }

        const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
          format: 'jpeg',
          quality: 85,
        });

        return { success: true, data: dataUrl };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Screenshot failed: ${msg}` };
      }
    }

    case 'GET_SETTINGS': {
      const settings = await getStoredSettings();
      return { success: true, data: settings };
    }

    default:
      return { success: false, error: `Unrecognized background message: ${message.type}` };
  }
}
