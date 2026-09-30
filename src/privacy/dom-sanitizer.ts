import { PrivacySettings, InteractiveDOMNode } from '../types';
import { PrivacyRedactor } from './redactor';

const FIELD_KEYWORDS: Record<string, string[]> = {
  password: ['password', 'passwd', 'pwd', 'secret', 'auth', 'private', 'passcode', 'passphrase'],
  card_number: ['credit card', 'creditcard', 'cc number', 'card number', 'cardnumber'],
  card_security: ['cvv', 'cvc', 'security code', 'expiry', 'expiration', 'exp date', 'exp month', 'exp year'],
  username: ['username', 'user id', 'login id', 'user name'],
  name: ['full name', 'first name', 'given name', 'last name', 'family name', 'middle name', 'fname', 'lname', 'name'],
  email: ['email', 'e mail'],
  phone: ['phone', 'mobile', 'telephone', 'tel', 'contact number'],
  address: ['address', 'street', 'city', 'state', 'zip code', 'zipcode', 'postal code', 'postcode', 'pincode'],
  company: ['company', 'organization', 'org name'],
  dob: ['dob', 'birthdate', 'date of birth', 'birthday'],
  gov_id: ['ssn', 'social security', 'pin', 'aadhaar', 'aadhar', 'pan number', 'passport', 'driver license', 'tax id', 'national id', 'government id'],
  personal_data: ['gender', 'sex'],
  bank_account: ['iban', 'swift', 'routing number', 'bank account', 'account number'],
  promo_gift: ['promo', 'coupon', 'giftcode', 'gift card'],
};

const AUTOCOMPLETE_PII_TYPES: Record<string, string> = {
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'tel-country-code': 'phone',
  'cc-name': 'name',
  'cc-number': 'card_number',
  'cc-exp': 'card_security',
  'cc-exp-month': 'card_security',
  'cc-exp-year': 'card_security',
  'cc-csc': 'card_security',
  'given-name': 'name',
  'additional-name': 'name',
  'family-name': 'name',
  name: 'name',
  'bday': 'dob',
  'bday-day': 'dob',
  'bday-month': 'dob',
  'bday-year': 'dob',
  'street-address': 'address',
  'address-line1': 'address',
  'address-line2': 'address',
  'address-level1': 'address',
  'address-level2': 'address',
  'postal-code': 'address',
  'current-password': 'password',
  'new-password': 'password',
  'one-time-code': 'password',
  username: 'username',
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
    const autocomplete = (element.getAttribute('autocomplete') || '').toLowerCase().trim();
    const autocompleteTokens = autocomplete.split(/\s+/);
    for (const token of autocompleteTokens) {
      if (AUTOCOMPLETE_PII_TYPES[token]) return AUTOCOMPLETE_PII_TYPES[token];
    }

    if (element instanceof HTMLInputElement) {
      const inputType = element.type.toLowerCase();
      if (inputType === 'password') return 'password';
      if (inputType === 'email') return 'email';
      if (inputType === 'tel') return 'phone';
    }

    const labelledBy = (element.getAttribute('aria-labelledby') || '')
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent || '')
      .join(' ');
    const labels = element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement
      ? Array.from(element.labels || []).map((label) => label.textContent || '').join(' ')
      : '';
    const questionLabel = element.closest('[role="listitem"]')
      ?.querySelector('[role="heading"]')?.textContent || '';
    const isFormControl = element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement ||
      element instanceof HTMLTextAreaElement ||
      ['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(element.getAttribute('role') || '');
    const attributesToCheck = [
      element.getAttribute('id') || '',
      element.getAttribute('name') || '',
      autocomplete,
      element.getAttribute('type') || '',
      element.getAttribute('aria-label') || '',
      element.getAttribute('placeholder') || '',
      labelledBy,
      labels,
      questionLabel,
      isFormControl && typeof element.className === 'string' ? element.className : '',
    ].join(' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
    const tokens: string[] = attributesToCheck.match(/[a-z0-9]+/g) || [];

    for (const [type, keywords] of Object.entries(FIELD_KEYWORDS)) {
      if (keywords.some((keyword) => {
        const keywordTokens = keyword.split(/[^a-z0-9]+/).filter(Boolean);
        return tokens.some((token, index) => token === keywordTokens[0] &&
          keywordTokens.every((part, offset) => tokens[index + offset] === part));
      })) return type;
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

  public findSensitiveTextRanges(value: string): Array<{ start: number; end: number; piiType: string; value: string }> {
    if (!this.settings.enabled || !value) return [];

    const matches: Array<{ start: number; end: number; piiType: string; value: string }> = [];
    for (const [piiType, pattern] of Object.entries(PII_REGEX)) {
      const globalPattern = new RegExp(pattern.source, `${pattern.flags}g`);
      for (const match of value.matchAll(globalPattern)) {
        if (match.index === undefined || !match[0]) continue;
        matches.push({ start: match.index, end: match.index + match[0].length, piiType, value: match[0] });
      }
    }

    matches.sort((left, right) => left.start - right.start || right.end - left.end);
    return matches.filter((match, index) =>
      !matches.slice(0, index).some((prior) => match.start < prior.end && match.end > prior.start)
    );
  }

  public isElementSensitive(element: Element): boolean {
    if (!this.settings.enabled) return false;
    return this.classifyByAttributes(element) !== null;
  }

  public getElementPiiType(element: Element, currentValue?: string): string | null {
    if (!this.settings.enabled) return null;
    return this.classifyByAttributes(element) || (currentValue ? this.classifyByContent(currentValue) : null);
  }

  public async getSensitiveValueToken(piiType: string, value: string): Promise<string> {
    return this.requestLabel(piiType, value, 'page-text');
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
    let sanitizedLabel = node.label || '';

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
    }
    if (sanitizedText) sanitizedText = (await this.redactor.sanitizeText(sanitizedText, node.domRef)).sanitized;
    if (sanitizedValue) sanitizedValue = (await this.redactor.sanitizeText(sanitizedValue, node.domRef)).sanitized;
    if (sanitizedPlaceholder) sanitizedPlaceholder = (await this.redactor.sanitizeText(sanitizedPlaceholder, node.domRef)).sanitized;
    if (sanitizedLabel) sanitizedLabel = (await this.redactor.sanitizeText(sanitizedLabel, node.domRef)).sanitized;

    return {
      ...node,
      isSensitive,
      piiType: piiType || undefined,
      label: sanitizedLabel,
      text: sanitizedText,
      value: sanitizedValue,
      placeholder: sanitizedPlaceholder,
    };
  }
}