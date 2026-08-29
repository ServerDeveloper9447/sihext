import { ExtensionSettings, ExtractedDOMSummary, RoutingMode, AIProvider } from '../types';

export interface RoutingDecision {
  target: 'on-device' | 'cloud';
  provider: AIProvider;
  reason: string;
  confidence: number;
}

export class AIRouter {
  /**
   * Evaluates the query, DOM summary, network status, and user settings to determine optimal execution target.
   */
  public static decideRoute(
    query: string,
    domSummary: ExtractedDOMSummary,
    settings: ExtensionSettings
  ): RoutingDecision {
    const mode: RoutingMode = settings.routingMode;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // 1. If offline, must use on-device
    if (!isOnline) {
      return {
        target: 'on-device',
        provider: 'local-vit',
        reason: 'Device is offline; routing to local on-device ViT engine.',
        confidence: 1.0,
      };
    }

    // 2. Strict forced modes
    if (mode === 'on-device-only') {
      return {
        target: 'on-device',
        provider: 'local-vit',
        reason: 'User policy: Strict on-device execution only.',
        confidence: 1.0,
      };
    }

    if (mode === 'cloud-only') {
      return {
        target: 'cloud',
        provider: settings.selectedProvider,
        reason: 'User policy: Cloud provider execution only.',
        confidence: 1.0,
      };
    }

    if (mode === 'on-device-preferred') {
      return {
        target: 'on-device',
        provider: 'local-vit',
        reason: 'User preference: On-device preferred.',
        confidence: 0.85,
      };
    }

    if (mode === 'cloud-preferred') {
      return {
        target: 'cloud',
        provider: settings.selectedProvider,
        reason: 'User preference: Cloud model preferred.',
        confidence: 0.85,
      };
    }

    // 3. Auto Mode: Intelligent decision based on privacy and complexity
    // If sensitive data density is high, prioritize local processing for maximum privacy
    if (domSummary.sensitiveElementsCount > 0 && settings.privacy.enabled) {
      // Sensitive fields detected on the page (e.g. login / checkout form)
      return {
        target: 'on-device',
        provider: 'local-vit',
        reason: `Privacy Guard: ${domSummary.sensitiveElementsCount} sensitive elements detected on page. Routing to on-device ViT to prevent external transmission.`,
        confidence: 0.9,
      };
    }

    // Simple queries (e.g. "click login", "find search bar", "scroll down") can be answered instantaneously on-device
    const isSimpleNavigation = /^(click|scroll|find|type|select|focus|go to|open)\b/i.test(query.trim());
    if (isSimpleNavigation && domSummary.interactiveCount < 60) {
      return {
        target: 'on-device',
        provider: 'local-vit',
        reason: 'Task is a lightweight DOM navigation action suitable for instant on-device ViT execution.',
        confidence: 0.8,
      };
    }

    // Complex reasoning, deep summarization, or large DOM trees route to Cloud
    return {
      target: 'cloud',
      provider: settings.selectedProvider,
      reason: 'Complex task or open-ended reasoning; routing to high-capacity Cloud model.',
      confidence: 0.88,
    };
  }
}
