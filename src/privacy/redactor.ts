// redactor.ts
import { PrivacySettings, RedactionReport } from '../types';

const PII_PATTERNS: Record<string, RegExp> = {
  card_number: /\b(?:\d[ -]*?){13,19}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  secret: /(?:api[_-]?key|bearer|token|secret|password|passwd|auth)\s*[:=]\s*['"]?([a-zA-Z0-9_\-.]{8,})['"]?/gi,
};

export class PrivacyRedactor {
  private settings: PrivacySettings;

  constructor(settings: PrivacySettings) {
    this.settings = settings;
  }

  public updateSettings(settings: PrivacySettings) {
    this.settings = settings;
  }

  private async requestLabel(piiType: string, value: string, ref: string): Promise<string> {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ENTITY_LABEL',
      payload: { piiType, value, ref },
    });
    return response.data.label;
  }

  private emptyReport(): RedactionReport {
    return {
      passwordsMasked: 0, emailsMasked: 0, phonesMasked: 0, creditCardsMasked: 0,
      facesMasked: 0, customMasks: 0, totalRedacted: 0, redactedLabels: [],
    };
  }

  public async sanitizeText(text: string, sourceRef = 'unknown'): Promise<{ sanitized: string; report: RedactionReport }> {
    if (!this.settings.enabled || !text) return { sanitized: text, report: this.emptyReport() };

    let sanitized = text;
    const report = this.emptyReport();

    if (this.settings.maskCreditCards) {
      for (const m of [...sanitized.matchAll(PII_PATTERNS.card_number)]) {
        const digits = m[0].replace(/\D/g, '');
        if (digits.length >= 13 && digits.length <= 19) {
          const label = await this.requestLabel('card_number', m[0], sourceRef);
          sanitized = sanitized.replace(m[0], `[${label}]`);
          report.creditCardsMasked++;
          if (!report.redactedLabels.includes('Credit Card')) report.redactedLabels.push('Credit Card');
        }
      }
    }

    if (this.settings.maskEmails) {
      for (const m of [...sanitized.matchAll(PII_PATTERNS.email)]) {
        const label = await this.requestLabel('email', m[0], sourceRef);
        sanitized = sanitized.replace(m[0], `[${label}]`);
        report.emailsMasked++;
        if (!report.redactedLabels.includes('Email')) report.redactedLabels.push('Email');
      }
    }

    if (this.settings.maskPhoneNumbers) {
      for (const m of [...sanitized.matchAll(PII_PATTERNS.phone)]) {
        const label = await this.requestLabel('phone', m[0], sourceRef);
        sanitized = sanitized.replace(m[0], `[${label}]`);
        report.phonesMasked++;
        if (!report.redactedLabels.includes('Phone Number')) report.redactedLabels.push('Phone Number');
      }
    }

    if (this.settings.maskApiKeys) {
      for (const m of [...sanitized.matchAll(PII_PATTERNS.secret)]) {
        const secretValue = m[1] || m[0];
        const label = await this.requestLabel('password', secretValue, sourceRef);
        sanitized = sanitized.replace(secretValue, `[${label}]`);
        report.passwordsMasked++;
        if (!report.redactedLabels.includes('Secret / Key')) report.redactedLabels.push('Secret / Key');
      }
    }

    if (this.settings.customRegexRules?.length) {
      for (const rule of this.settings.customRegexRules) {
        try {
          const reg = new RegExp(rule, 'gi');
          for (const m of [...sanitized.matchAll(reg)]) {
            const label = await this.requestLabel('custom', m[0], sourceRef);
            sanitized = sanitized.replace(m[0], `[${label}]`);
            report.customMasks++;
            if (!report.redactedLabels.includes('Custom Rule')) report.redactedLabels.push('Custom Rule');
          }
        } catch {
          // ignore invalid custom regex
        }
      }
    }

    report.totalRedacted =
      report.passwordsMasked + report.emailsMasked + report.phonesMasked +
      report.creditCardsMasked + report.customMasks;

    return { sanitized, report };
  }
}