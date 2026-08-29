import { PrivacySettings, InteractiveDOMNode } from '../types';
import { PrivacyRedactor } from './redactor';

const SENSITIVE_KEYWORDS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'creditcard',
  'cc-number',
  'cvv',
  'cvc',
  'ssn',
  'pin',
  'token',
  'auth',
  'private',
];

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

  /**
   * Evaluates whether an element is inherently sensitive based on its attributes.
   */
  public isElementSensitive(element: Element): boolean {
    if (!this.settings.enabled) return false;

    // Check input type password
    if (element instanceof HTMLInputElement && element.type.toLowerCase() === 'password') {
      return true;
    }

    // Check name, id, class, aria-label, and autocomplete attributes
    const attributesToCheck = [
      element.getAttribute('id') || '',
      element.getAttribute('name') || '',
      element.getAttribute('autocomplete') || '',
      element.getAttribute('aria-label') || '',
      element.getAttribute('placeholder') || '',
      element.className && typeof element.className === 'string' ? element.className : '',
    ].join(' ').toLowerCase();

    return SENSITIVE_KEYWORDS.some((kw) => attributesToCheck.includes(kw));
  }

  /**
   * Sanitizes an extracted DOM node and masks its values/text.
   */
  public sanitizeNode(node: InteractiveDOMNode): InteractiveDOMNode {
    if (!this.settings.enabled) return node;

    const isSensitive = node.isSensitive || (node.type && node.type.toLowerCase() === 'password');
    let sanitizedText = node.text || '';
    let sanitizedValue = node.value || '';
    let sanitizedPlaceholder = node.placeholder || '';

    if (isSensitive) {
      if (node.type === 'password' || this.settings.maskPasswords) {
        sanitizedValue = sanitizedValue ? '[REDACTED_PASSWORD]' : '';
        sanitizedText = sanitizedText ? '[REDACTED_PASSWORD]' : '';
      }
    } else {
      if (sanitizedText) {
        sanitizedText = this.redactor.sanitizeText(sanitizedText).sanitized;
      }
      if (sanitizedValue) {
        sanitizedValue = this.redactor.sanitizeText(sanitizedValue).sanitized;
      }
      if (sanitizedPlaceholder) {
        sanitizedPlaceholder = this.redactor.sanitizeText(sanitizedPlaceholder).sanitized;
      }
    }

    return {
      ...node,
      isSensitive: !!isSensitive,
      text: sanitizedText,
      value: sanitizedValue,
      placeholder: sanitizedPlaceholder,
    };
  }
}
