export class ElementHighlighter {
  private overlayContainer: HTMLDivElement | null = null;
  private activeBox: HTMLDivElement | null = null;
  private activeBadge: HTMLDivElement | null = null;

  constructor() {
    this.initContainer();
  }

  private initContainer() {
    let existing = document.getElementById('sihext-highlighter-root');
    if (!existing) {
      this.overlayContainer = document.createElement('div');
      this.overlayContainer.id = 'sihext-highlighter-root';
      this.overlayContainer.className = 'sihext-overlay-container';
      document.documentElement.appendChild(this.overlayContainer);
    } else {
      this.overlayContainer = existing as HTMLDivElement;
    }
  }

  public highlight(refId: string, label?: string, variant: 'action' | 'inspect' | 'sensitive' = 'action') {
    this.clear();
    const el = document.querySelector(`[data-sihext-ref="${refId}"]`);
    if (!el || !(el instanceof HTMLElement)) return;

    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    this.activeBox = document.createElement('div');
    this.activeBox.className = `sihext-highlight-box sihext-highlight-${variant}`;
    this.activeBox.style.top = `${rect.top + scrollY}px`;
    this.activeBox.style.left = `${rect.left + scrollX}px`;
    this.activeBox.style.width = `${rect.width}px`;
    this.activeBox.style.height = `${rect.height}px`;

    this.activeBadge = document.createElement('div');
    this.activeBadge.className = `sihext-highlight-badge sihext-badge-${variant}`;
    this.activeBadge.innerText = label || refId;
    this.activeBox.appendChild(this.activeBadge);

    this.overlayContainer?.appendChild(this.activeBox);
  }

  public clear() {
    if (this.activeBox) {
      this.activeBox.remove();
      this.activeBox = null;
      this.activeBadge = null;
    }
    if (this.overlayContainer) {
      this.overlayContainer.innerHTML = '';
    }
  }
}
