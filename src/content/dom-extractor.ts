import { ExtractedDOMSummary, InteractiveDOMNode, PrivacySettings } from '../types';
import { DOMSanitizer } from '../privacy/dom-sanitizer';

export class DOMExtractor {
  private sanitizer: DOMSanitizer;
  private refCounter = 0;
  private overlayContainer: HTMLDivElement | null = null;

  constructor(privacySettings: PrivacySettings) {
    this.sanitizer = new DOMSanitizer(privacySettings);
  }

  public updatePrivacySettings(settings: PrivacySettings) {
    this.sanitizer.updateSettings(settings);
  }

  private autoDismissTimer: ReturnType<typeof setTimeout> | null = null;

  public removeVisualOverlays() {
    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }
    if (this.overlayContainer) {
      this.overlayContainer.remove();
      this.overlayContainer = null;
    }
    const existing = document.getElementById('som-overlay-container');
    if (existing) existing.remove();
    document.querySelectorAll('.som-mark-overlay, .som-mark-badge').forEach((el) => el.remove());
  }

  public cleanupOverlays(clearIds: boolean = false) {
    this.removeVisualOverlays();
    if (clearIds) {
      document.querySelectorAll('[data-som-id]').forEach((el) => el.removeAttribute('data-som-id'));
    }
  }

  /**
   * Scans current webpage DOM, extracts interactive elements, assigns integer/ref IDs,
   * and optionally injects Set-of-Mark overlays when requested.
   */
  public async extractDOM(options: { injectOverlays?: boolean } = {}): Promise<ExtractedDOMSummary> {
    this.cleanupOverlays(true);
    this.refCounter = 0;

    const shouldInject = Boolean(options.injectOverlays);
    if (shouldInject) {
      this.overlayContainer = document.createElement('div');
      this.overlayContainer.id = 'som-overlay-container';
      document.documentElement.appendChild(this.overlayContainer);

      this.autoDismissTimer = setTimeout(() => {
        this.removeVisualOverlays();
      }, 15000);
    }

    const elements: InteractiveDOMNode[] = [];
    let sensitiveElementsCount = 0;

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
    const scrollX = window.scrollX || window.pageXOffset || 0;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    for (const el of candidateElements) {
      if (!this.isElementVisible(el)) {
        continue;
      }

      this.refCounter++;
      const currentId = this.refCounter;
      const refId = `sihext-${currentId}`;
      el.setAttribute('data-sihext-ref', refId);
      el.setAttribute('data-som-id', String(currentId));

      const rect = el.getBoundingClientRect();
      const tagName = el.tagName.toLowerCase();
      const isInput = ['input', 'select', 'textarea'].includes(tagName);
      const isClickable = ['button', 'a'].includes(tagName) || el.getAttribute('role') === 'button' || el.hasAttribute('onclick');

      // value/placeholder must be extracted BEFORE classification, since
      // getElementPiiType needs the current value to run its content-regex fallback.
      let value: string | undefined;
      let placeholder: string | undefined;

      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        value = el.value;
        if ('placeholder' in el) {
          placeholder = el.placeholder;
        }
      }

      const piiType = this.sanitizer.getElementPiiType(el, value);
      const isSensitive = piiType !== null;

      if (isSensitive) {
        sensitiveElementsCount++;
      }

      if (shouldInject && this.overlayContainer && (isClickable || isInput)) {
        const overlay = document.createElement('div');
        overlay.className = 'som-mark-overlay';
        overlay.style.top = `${rect.top + scrollY}px`;
        overlay.style.left = `${rect.left + scrollX}px`;
        overlay.style.width = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;

        const badge = document.createElement('div');
        badge.className = 'som-mark-badge';
        badge.textContent = String(currentId);
        overlay.appendChild(badge);

        this.overlayContainer.appendChild(overlay);
      }

      let text = (el.textContent || '').trim().replace(/\s+/g, ' ');
      if (text.length > 250) {
        text = text.substring(0, 250) + '...';
      }

      const rawNode: InteractiveDOMNode = {
        refId,
        domRef: refId,
        piiType: piiType || undefined,
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

      const sanitizedNode = await this.sanitizer.sanitizeNode(rawNode);
      elements.push(sanitizedNode);
    }

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