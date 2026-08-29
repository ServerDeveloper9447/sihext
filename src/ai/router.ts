import { ExtensionSettings, ExtractedDOMSummary, RoutingMode, AIProvider } from '../types';

export interface RoutingDecision {
  target: 'on-device' | 'backend';
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
    const mode: RoutingMode = settings.routingMode || 'auto';
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // 1. If offline, must use on-device ViT
    if (!isOnline) {
      return {
        target: 'on-device',
        provider: 'local-vit',
        reason: 'Device is offline; running purely in-browser on-device ViT engine.',
        confidence: 1.0,
      };
    }

    // 2. Strict forced modes
    if (mode === 'on-device-only') {
      return {
        target: 'on-device',
        provider: 'local-vit',
        reason: 'Policy: Strict On-Device execution only (zero outbound network requests).',
        confidence: 1.0,
      };
    }

    if (mode === 'backend-only') {
      return {
        target: 'backend',
        provider: 'custom-backend',
        reason: 'Policy: Route directly to custom self-hosted model backend.',
        confidence: 1.0,
      };
    }

    if (mode === 'on-device-preferred') {
      return {
        target: 'on-device',
        provider: 'local-vit',
        reason: 'Preference: On-Device ViT preferred.',
        confidence: 0.85,
      };
    }

    if (mode === 'backend-preferred') {
      return {
        target: 'backend',
        provider: 'custom-backend',
        reason: 'Preference: Custom model backend preferred.',
        confidence: 0.85,
      };
    }

    // 3. Auto Mode: Intelligent decision based on privacy and complexity
    // If sensitive data density is high, prioritize local processing for maximum privacy
    if (domSummary.sensitiveElementsCount > 0 && settings.privacy.enabled) {
      return {
        target: 'on-device',
        provider: 'local-vit',
        reason: `Privacy Guard: ${domSummary.sensitiveElementsCount} sensitive elements detected on page. Routing to on-device ViT to prevent external transmission.`,
        confidence: 0.9,
      };
    }

    // Simple navigation actions (clicks, simple inputs, scrolls) are handled instantaneously on-device
    const isSimpleNavigation = /^(click|scroll|find|type|select|focus|go to|open)\b/i.test(query.trim());
    if (isSimpleNavigation && domSummary.interactiveCount < 60) {
      return {
        target: 'on-device',
        provider: 'local-vit',
        reason: 'Task is a lightweight DOM action suitable for instant on-device ViT execution.',
        confidence: 0.8,
      };
    }

    // Complex reasoning, visual page analysis, or deep questions route to our custom backend server
    return {
      target: 'backend',
      provider: 'custom-backend',
      reason: 'Complex task or multi-step reasoning; routing to custom self-hosted model backend.',
      confidence: 0.88,
    };
  }
}
