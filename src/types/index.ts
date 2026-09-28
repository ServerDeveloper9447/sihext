export type RoutingMode = 
  | 'auto' 
  | 'on-device-preferred' 
  | 'backend-preferred' 
  | 'on-device-only' 
  | 'backend-only';

export type AIProvider = 'custom-backend' | 'local-yolo';

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

export type ServerActionType =
  | 'click'
  | 'double_click'
  | 'right_click'
  | 'type'
  | 'clear'
  | 'select'
  | 'hover'
  | 'drag'
  | 'press_key'
  | 'scroll'
  | 'submit'
  | 'navigate'
  | 'wait'
  | 'answer'
  | 'done';

  export interface ServerAgentAction {
  action: ServerActionType;
    element_id: number | string | null;
    x: number | null;                 // normalized 0-1000 coordinate fallback for canvas UIs
  y: number | null;
  value: string | null;             // literal text, OR a placeholder ref like "name-1" to resolve locally
  key: string | null;               // for 'press_key', e.g. "Enter", "Tab", "Escape"
  target_element_id: number | string | null; // for 'drag': drop-target element
  target_x: number | null;          // for 'drag' without a target element
  target_y: number | null;
  scroll_direction: 'up' | 'down' | 'left' | 'right' | null;
  scroll_amount_px: number | null;
  duration_ms: number | null;       // for 'wait'
  url: string | null;               // for 'navigate'
  answer_text: string | null;       // for 'answer' -- information reported back to the user, not a DOM action
  reasoning: string;
}

export type ActionType = ServerActionType;

export interface AgentAction {
  id: string;
  type: ActionType;
 
  // targeting -- prefer refId whenever a DOM element exists; x/y is the
  // canvas-content fallback, same convention as ServerAgentAction
  refId?: string;
  selector?: string;
  x?: number;
  y?: number;
 
  // per-action-type payloads
  value?: string;                 // 'type' (literal or placeholder ref) / 'select' (chosen option)
  key?: string;                   // 'press_key'
  targetRefId?: string;           // 'drag'
  targetX?: number;
  targetY?: number;
  scrollDirection?: 'up' | 'down' | 'left' | 'right' | 'to-top' | 'to-bottom';
  scrollAmountPx?: number;
  durationMs?: number;            // 'wait'
  url?: string;                   // 'navigate'
  answerText?: string;            // 'answer' -- text surfaced back to the user, not a DOM action
 
  description: string;
  requiresConfirmation?: boolean;
  isSensitiveAction?: boolean;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
  error?: string;
}

export function fromServerAction(server: ServerAgentAction, id: string): AgentAction {
  return {
    id,
    type: server.action,
    refId: server.element_id != null ? String(server.element_id) : undefined,
    x: server.x ?? undefined,
    y: server.y ?? undefined,
    value: server.value ?? undefined,
    key: server.key ?? undefined,
    targetRefId: server.target_element_id != null ? String(server.target_element_id) : undefined,
    targetX: server.target_x ?? undefined,
    targetY: server.target_y ?? undefined,
    scrollDirection: server.scroll_direction ?? undefined,
    scrollAmountPx: server.scroll_amount_px ?? undefined,
    durationMs: server.duration_ms ?? undefined,
    url: server.url ?? undefined,
    answerText: server.answer_text ?? undefined,
    description: server.reasoning,
    status: 'pending',
  };
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
  | 'PREPARE_DOM'
  | 'ANNOTATE_DOM'
  | 'EXECUTE_ACTION'
  | 'HIGHLIGHT_ELEMENT'
  | 'CLEAR_HIGHLIGHT'
  | 'CLEANUP_OVERLAYS'
  | 'CLEANUP_DOM'
  | 'RESET_DOM'
  | 'CAPTURE_TAB'
  | 'REDACT_IMAGE'
  | 'PROCESS_QUERY'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'OPEN_SIDE_PANEL'
  | 'GET_ENTITY_LABEL'
  | 'GET_ENTITY_VALUES'
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
