import { PrivacySettings, RedactionReport } from '../types';

export class PrivacyRedactor {
  private settings: PrivacySettings;

  constructor(settings: PrivacySettings) {
    this.settings = settings;
  }

  public updateSettings(settings: PrivacySettings) {
    this.settings = settings;
  }

  /**
   * Sanitizes a raw text string, replacing sensitive patterns with masked placeholders.
   */
  public sanitizeText(text: string): { sanitized: string; report: RedactionReport } {
    if (!this.settings.enabled || !text) {
      return {
        sanitized: text,
        report: {
          passwordsMasked: 0,
          emailsMasked: 0,
          phonesMasked: 0,
          creditCardsMasked: 0,
          facesMasked: 0,
          customMasks: 0,
          totalRedacted: 0,
          redactedLabels: [],
        },
      };
    }

    let sanitized = text;
    let passwordsMasked = 0;
    let emailsMasked = 0;
    let phonesMasked = 0;
    let creditCardsMasked = 0;
    let customMasks = 0;
    const redactedLabels: string[] = [];

    // 1. Credit Card Numbers (13-19 digits with spaces/hyphens)
    if (this.settings.maskCreditCards) {
      const ccRegex = /\b(?:\d[ -]*?){13,19}\b/g;
      sanitized = sanitized.replace(ccRegex, (match) => {
        // Quick Luhn check or digit count filter
        const digits = match.replace(/\D/g, '');
        if (digits.length >= 13 && digits.length <= 19) {
          creditCardsMasked++;
          if (!redactedLabels.includes('Credit Card')) redactedLabels.push('Credit Card');
          return '[REDACTED_CREDIT_CARD]';
        }
        return match;
      });
    }

    // 2. Email Addresses
    if (this.settings.maskEmails) {
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      sanitized = sanitized.replace(emailRegex, () => {
        emailsMasked++;
        if (!redactedLabels.includes('Email')) redactedLabels.push('Email');
        return '[REDACTED_EMAIL]';
      });
    }

    // 3. Phone Numbers
    if (this.settings.maskPhoneNumbers) {
      const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
      sanitized = sanitized.replace(phoneRegex, () => {
        phonesMasked++;
        if (!redactedLabels.includes('Phone Number')) redactedLabels.push('Phone Number');
        return '[REDACTED_PHONE]';
      });
    }

    // 4. API Keys, Tokens & Passwords in query strings or JSON-like text
    if (this.settings.maskApiKeys) {
      const tokenRegex = /(?:api[_-]?key|bearer|token|secret|password|passwd|auth)\s*[:=]\s*['"]?([a-zA-Z0-9_\-.]{8,})['"]?/gi;
      sanitized = sanitized.replace(tokenRegex, (match, secret) => {
        passwordsMasked++;
        if (!redactedLabels.includes('Secret / Key')) redactedLabels.push('Secret / Key');
        return match.replace(secret, '[REDACTED_SECRET]');
      });
    }

    // 5. Custom Regex Rules
    if (this.settings.customRegexRules && this.settings.customRegexRules.length > 0) {
      for (const rule of this.settings.customRegexRules) {
        try {
          const reg = new RegExp(rule, 'gi');
          sanitized = sanitized.replace(reg, () => {
            customMasks++;
            if (!redactedLabels.includes('Custom Rule')) redactedLabels.push('Custom Rule');
            return '[REDACTED_CUSTOM]';
          });
        } catch {
          // Ignore invalid custom regex
        }
      }
    }

    const totalRedacted =
      passwordsMasked + emailsMasked + phonesMasked + creditCardsMasked + customMasks;

    return {
      sanitized,
      report: {
        passwordsMasked,
        emailsMasked,
        phonesMasked,
        creditCardsMasked,
        facesMasked: 0,
        customMasks,
        totalRedacted,
        redactedLabels,
      },
    };
  }
}
