import { ExtensionMessage, ExtensionResponse } from '../types';

export async function sendMessageToActiveTab<T, R = unknown>(
  message: ExtensionMessage<T>
): Promise<ExtensionResponse<R>> {
  if (typeof chrome === 'undefined' || !chrome.tabs) {
    return { success: false, error: 'Chrome tabs API unavailable' };
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.id) {
    return { success: false, error: 'No active tab found' };
  }

  try {
    const response = await chrome.tabs.sendMessage(activeTab.id, message);
    return response || { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

export async function sendMessageToBackground<T, R = unknown>(
  message: ExtensionMessage<T>
): Promise<ExtensionResponse<R>> {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    return { success: false, error: 'Chrome runtime API unavailable' };
  }

  try {
    const response = await chrome.runtime.sendMessage(message);
    return response || { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}
