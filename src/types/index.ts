export type RoutingMode = 
  | 'auto' 
  | 'on-device-preferred' 
  | 'backend-preferred' 
  | 'on-device-only' 
  | 'backend-only';

export type AIProvider = 'custom-backend' | 'local-vit';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface InteractiveDOMNode {
  refId: string;
  domRef?: string;
  piiType?: string;
  tagName: string;
  type?: string;
  id?: string;
  className?: string;
  role?: string;
  ariaLabel?: string;
  name?: string;
  placeholder?: string;
  value?: string;
  text?: string;
  href?: string;
  isVisible: boolean;
  isClickable: boolean;
  isInput: boolean;
  isSensitive: boolean;
  boundingBox: BoundingBox;
  selector: string;
  childrenCount?: number;
}

export interface ExtractedDOMSummary {
  title: string;
  url: string;
  viewport: { width: number; height: number };
  elements: InteractiveDOMNode[];
  interactiveCount: number;
  sensitiveElementsCount: number;
  sanitizedTextContent: string;
}

export interface PrivacySettings {
  enabled: boolean;
  maskPasswords: boolean;
  maskCreditCards: boolean;
  maskEmails: boolean;
  maskPhoneNumbers: boolean;
  maskFaces: boolean;
  maskApiKeys: boolean;
  customRegexRules: string[];
}

export interface CustomBackendConfig {
  endpointUrl: string;
  apiKey?: string;
  modelName: string;
  timeoutMs?: number;
  customHeaders?: Record<string, string>;
}

export interface ExtensionSettings {
  routingMode: RoutingMode;
  selectedProvider: AIProvider;
  backend: CustomBackendConfig;
  onDeviceModel: string;
  privacy: PrivacySettings;
  autoConfirmSafeActions: boolean;
  actionExecutionDelayMs: number;
  theme: 'dark' | 'light' | 'system';
}

export type ActionType = 
  | 'click' 
  | 'type' 
  | 'clear' 
  | 'scroll' 
  | 'select' 
  | 'hover' 
  | 'submit' 
  | 'navigate' 
  | 'answer';

export interface AgentAction {
  id: string;
  type: ActionType;
  refId?: string;
  selector?: string;
  value?: string;
  scrollDirection?: 'up' | 'down' | 'to-top' | 'to-bottom';
  description: string;
  requiresConfirmation?: boolean;
  isSensitiveAction?: boolean;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  error?: string;
}

export interface RedactionReport {
  passwordsMasked: number;
  emailsMasked: number;
  phonesMasked: number;
  creditCardsMasked: number;
  facesMasked: number;
  customMasks: number;
  totalRedacted: number;
  redactedLabels: string[];
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  modelUsed?: string;
  isLocalExecution?: boolean;
  redactionReport?: RedactionReport;
  actions?: AgentAction[];
  screenshotPreview?: string;
  pageContext?: {
    title: string;
    url: string;
  };
}

export type MessageType =
  | 'PING'
  | 'GET_PAGE_DOM'
  | 'EXECUTE_ACTION'
  | 'HIGHLIGHT_ELEMENT'
  | 'CLEAR_HIGHLIGHT'
  | 'CLEANUP_OVERLAYS'
  | 'CAPTURE_TAB'
  | 'REDACT_IMAGE'
  | 'PROCESS_QUERY'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'OPEN_SIDE_PANEL'
  | 'GET_ENTITY_LABEL'
  | 'START_NEW_TASK';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload?: T;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
