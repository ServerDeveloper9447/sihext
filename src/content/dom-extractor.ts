import { ExtractedDOMSummary, InteractiveDOMNode, PrivacySettings } from '../types';
import { DOMSanitizer } from '../privacy/dom-sanitizer';

export class DOMExtractor {
  private sanitizer: DOMSanitizer;
  private refCounter = 0;

  constructor(privacySettings: PrivacySettings) {
    this.sanitizer = new DOMSanitizer(privacySettings);
  }

  public updatePrivacySettings(settings: PrivacySettings) {
    this.sanitizer.updateSettings(settings);
  }

  /**
   * Scans current webpage DOM, extracts interactive elements, assigns ref IDs, and sanitizes sensitive data.
   */
  public extractDOM(): ExtractedDOMSummary {
    this.refCounter = 0;
    const elements: InteractiveDOMNode[] = [];
    let sensitiveElementsCount = 0;

    // Selector targeting interactive and semantic elements
    const targetSelector = [
      'button',
      'a[href]',
      'input',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="switch"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
      'h1',
      'h2',
      'h3',
      'form',
    ].join(',');

    const candidateElements = Array.from(document.querySelectorAll(targetSelector));

    for (const el of candidateElements) {
      if (!this.isElementVisible(el)) {
        continue;
      }

      this.refCounter++;
      const refId = `sihext-${this.refCounter}`;
      el.setAttribute('data-sihext-ref', refId);

      const rect = el.getBoundingClientRect();
      const tagName = el.tagName.toLowerCase();
      const isInput = ['input', 'select', 'textarea'].includes(tagName);
      const isClickable = ['button', 'a'].includes(tagName) || el.getAttribute('role') === 'button' || el.hasAttribute('onclick');
      const isSensitive = this.sanitizer.isElementSensitive(el);

      if (isSensitive) {
        sensitiveElementsCount++;
      }

      let text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      // Limit text length per element to avoid huge payloads
      if (text.length > 250) {
        text = text.substring(0, 250) + '...';
      }

      let value: string | undefined;
      let placeholder: string | undefined;

      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        value = el.value;
        if ('placeholder' in el) {
          placeholder = el.placeholder;
        }
      }

      const rawNode: InteractiveDOMNode = {
        refId,
        tagName,
        type: el.getAttribute('type') || undefined,
        id: el.id || undefined,
        className: typeof el.className === 'string' ? el.className.split(' ').slice(0, 3).join(' ') : undefined,
        role: el.getAttribute('role') || undefined,
        ariaLabel: el.getAttribute('aria-label') || undefined,
        name: el.getAttribute('name') || undefined,
        placeholder,
        value,
        text: text || undefined,
        href: el instanceof HTMLAnchorElement ? el.href : undefined,
        isVisible: true,
        isClickable,
        isInput,
        isSensitive,
        boundingBox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
        },
        selector: this.generateCSSSelector(el),
      };

      const sanitizedNode = this.sanitizer.sanitizeNode(rawNode);
      elements.push(sanitizedNode);
    }

    // Build sanitized page text summary
    const bodyText = (document.body.innerText || '').slice(0, 3000);

    return {
      title: document.title,
      url: window.location.href,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      elements,
      interactiveCount: elements.length,
      sensitiveElementsCount,
      sanitizedTextContent: bodyText,
    };
  }

  private isElementVisible(el: Element): boolean {
    if (!(el instanceof HTMLElement)) return false;

    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity) <= 0.05
    ) {
      return false;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }

    // Check if within reasonably scrollable area
    return true;
  }

  private generateCSSSelector(el: Element): string {
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }
    const ref = el.getAttribute('data-sihext-ref');
    if (ref) {
      return `[data-sihext-ref="${ref}"]`;
    }
    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute('name');
    if (name) {
      return `${tag}[name="${CSS.escape(name)}"]`;
    }
    return tag;
  }
}
