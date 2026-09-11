import { PrivacySettings, InteractiveDOMNode } from '../types';
import { PrivacyRedactor } from './redactor';

const FIELD_KEYWORDS: Record<string, string[]> = {
  password: ['password', 'passwd', 'pwd', 'secret', 'auth', 'private'],
  card_number: ['creditcard', 'cc-number', 'cardnumber', 'card-number'],
  card_security: ['cvv', 'cvc', 'security-code', 'expiry', 'exp-date', 'exp-month', 'exp-year'],
  name: ['fullname', 'firstname', 'lastname', 'fname', 'lname', 'name'],
  email: ['email', 'e-mail'],
  phone: ['phone', 'mobile', 'tel', 'contact-number'],
  address: ['address', 'street', 'city', 'state', 'zipcode', 'postcode', 'pincode'],
  username: ['username', 'user-id', 'login-id'],
  company: ['company', 'organization', 'org-name'],
  dob: ['dob', 'birthdate', 'date-of-birth'],
  gov_id: ['ssn', 'pin', 'aadhaar', 'aadhar', 'pan-number', 'passport-number'],
  promo_gift: ['promo', 'coupon', 'giftcode', 'gift-card'],
};

const PII_REGEX: Record<string, RegExp> = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  phone: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/,
  card_number: /\b(?:\d[ -]*?){13,19}\b/,
  aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/,
  pan: /\b[A-Z]{5}\d{4}[A-Z]\b/,
  pincode_in: /\b\d{6}\b/,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  dob: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/,
};

export class DOMSanitizer {
  private redactor: PrivacyRedactor;
  private settings: PrivacySettings;

  constructor(settings: PrivacySettings) {
    this.settings = settings;
    this.redactor = new PrivacyRedactor(settings);
  }

  public updateSettings(settings: PrivacySettings) {
    this.settings = settings;
    this.redactor.updateSettings(settings);
  }

  private classifyByAttributes(element: Element): string | null {
    if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'password') {
      return 'password';
    }
    const attributesToCheck = [
      element.getAttribute('id') || '',
      element.getAttribute('name') || '',
      element.getAttribute('autocomplete') || '',
      element.getAttribute('aria-label') || '',
      element.getAttribute('placeholder') || '',
      element.className && typeof element.className === 'string' ? element.className : '',
    ].join(' ').toLowerCase();

    for (const [type, keywords] of Object.entries(FIELD_KEYWORDS)) {
      if (keywords.some((kw) => attributesToCheck.includes(kw))) return type;
    }
    return null;
  }

  private classifyByContent(value: string): string | null {
    if (!value) return null;
    for (const [type, pattern] of Object.entries(PII_REGEX)) {
      if (pattern.test(value)) return type;
    }
    return null;
  }

  public isElementSensitive(element: Element): boolean {
    if (!this.settings.enabled) return false;
    return this.classifyByAttributes(element) !== null;
  }

  public getElementPiiType(element: Element, currentValue?: string): string | null {
    if (!this.settings.enabled) return null;
    return this.classifyByAttributes(element) || (currentValue ? this.classifyByContent(currentValue) : null);
  }

  private async requestLabel(piiType: string, value: string | null, ref: string): Promise<string> {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ENTITY_LABEL',
      payload: { piiType, value, ref },
    });
    return response.data.label;
  }

  public async sanitizeNode(node: InteractiveDOMNode): Promise<InteractiveDOMNode> {
    if (!this.settings.enabled) return node;

    let sanitizedText = node.text || '';
    let sanitizedValue = node.value || '';
    let sanitizedPlaceholder = node.placeholder || '';

    const piiType =
      node.piiType ||
      this.classifyByContent(sanitizedValue || sanitizedText);

    const isSensitive = !!piiType;

    if (isSensitive) {
      const rawValue = sanitizedValue || sanitizedText;
      const label = await this.requestLabel(piiType!, rawValue, node.domRef ?? 'unknown');
      const tag = `[${label}]`;
      sanitizedValue = sanitizedValue ? tag : '';
      sanitizedText = sanitizedText ? tag : '';
    } else {
      if (sanitizedText) sanitizedText = (await this.redactor.sanitizeText(sanitizedText, node.domRef)).sanitized;
      if (sanitizedValue) sanitizedValue = (await this.redactor.sanitizeText(sanitizedValue, node.domRef)).sanitized;
      if (sanitizedPlaceholder) sanitizedPlaceholder = (await this.redactor.sanitizeText(sanitizedPlaceholder, node.domRef)).sanitized;
    }

    return {
      ...node,
      isSensitive,
      piiType: piiType || undefined,
      text: sanitizedText,
      value: sanitizedValue,
      placeholder: sanitizedPlaceholder,
    };
  }
}