import { ExtensionSettings, AgentMessage } from '../types';

export const DEFAULT_SETTINGS: ExtensionSettings = {
  routingMode: 'auto',
  selectedProvider: 'gemini',
  cloudModel: 'gemini-1.5-flash',
  onDeviceModel: 'vit-base-webgpu',
  privacy: {
    enabled: true,
    maskPasswords: true,
    maskCreditCards: true,
    maskEmails: true,
    maskPhoneNumbers: true,
    maskFaces: true,
    maskApiKeys: true,
    customRegexRules: [],
  },
  providers: {
    geminiApiKey: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    customEndpoint: 'http://localhost:11434/v1',
  },
  autoConfirmSafeActions: true,
  actionExecutionDelayMs: 350,
  theme: 'dark',
};

const STORAGE_KEYS = {
  SETTINGS: 'sihext_settings',
  CHAT_HISTORY: 'sihext_chat_history',
  ACTIVE_SESSION: 'sihext_active_session',
};

export async function getStoredSettings(): Promise<ExtensionSettings> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve(DEFAULT_SETTINGS);
      return;
    }
    chrome.storage.sync.get([STORAGE_KEYS.SETTINGS], (result) => {
      if (chrome.runtime.lastError || !result[STORAGE_KEYS.SETTINGS]) {
        resolve(DEFAULT_SETTINGS);
      } else {
        resolve({
          ...DEFAULT_SETTINGS,
          ...result[STORAGE_KEYS.SETTINGS],
          privacy: {
            ...DEFAULT_SETTINGS.privacy,
            ...(result[STORAGE_KEYS.SETTINGS].privacy || {}),
          },
          providers: {
            ...DEFAULT_SETTINGS.providers,
            ...(result[STORAGE_KEYS.SETTINGS].providers || {}),
          },
        });
      }
    });
  });
}

export async function saveStoredSettings(settings: ExtensionSettings): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve();
      return;
    }
    chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function getStoredChatHistory(): Promise<AgentMessage[]> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve([]);
      return;
    }
    chrome.storage.local.get([STORAGE_KEYS.CHAT_HISTORY], (result) => {
      if (chrome.runtime.lastError || !result[STORAGE_KEYS.CHAT_HISTORY]) {
        resolve([]);
      } else {
        resolve(result[STORAGE_KEYS.CHAT_HISTORY]);
      }
    });
  });
}

export async function saveStoredChatHistory(history: AgentMessage[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve();
      return;
    }
    // Limit stored messages to last 50 for storage quota
    const trimmed = history.slice(-50);
    chrome.storage.local.set({ [STORAGE_KEYS.CHAT_HISTORY]: trimmed }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

export async function clearStoredChatHistory(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      resolve();
      return;
    }
    chrome.storage.local.remove([STORAGE_KEYS.CHAT_HISTORY], () => {
      resolve();
    });
  });
}
