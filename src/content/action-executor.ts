import { AgentAction } from '../types';

export class ActionExecutor {
  /**
   * Executes an automated DOM action on the active webpage.
   */
  public async execute(action: AgentAction): Promise<{ success: boolean; message?: string }> {
    try {
      const targetElement = this.resolveElement(action);

      if (!targetElement && action.type !== 'scroll' && action.type !== 'navigate') {
        return {
          success: false,
          message: `Target element not found for ref: ${action.refId || action.selector}`,
        };
      }

      // Scroll target into view if applicable
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        await new Promise((r) => setTimeout(r, 150));
      }

      switch (action.type) {
        case 'click':
          return await this.handleClick(targetElement!);

        case 'type':
          return await this.handleType(targetElement!, action.value || '');

        case 'clear':
          return await this.handleClear(targetElement!);

        case 'scroll':
          return await this.handleScroll(targetElement, action.scrollDirection);

        case 'select':
          return await this.handleSelect(targetElement!, action.value || '');

        case 'hover':
          return await this.handleHover(targetElement!);

        case 'submit':
          return await this.handleSubmit(targetElement!);

        case 'navigate':
          if (action.value) {
            window.location.href = action.value;
            return { success: true, message: `Navigating to ${action.value}` };
          }
          return { success: false, message: 'No URL provided for navigation' };

        default:
          return { success: false, message: `Unsupported action type: ${action.type}` };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Action failed: ${msg}` };
    }
  }

  private resolveElement(action: AgentAction): HTMLElement | null {
    if (action.refId) {
      let el = document.querySelector(`[data-sihext-ref="${action.refId}"]`);
      if (!el) {
        const somId = action.refId.startsWith('sihext-')
          ? action.refId.replace('sihext-', '')
          : action.refId;
        el = document.querySelector(`[data-som-id="${somId}"]`);
      }
      if (el instanceof HTMLElement) return el;
    }
    if (action.selector) {
      const el = document.querySelector(action.selector);
      if (el instanceof HTMLElement) return el;
    }
    return null;
  }

  private async handleClick(el: HTMLElement): Promise<{ success: boolean; message?: string }> {
    el.focus();
    
    // Dispatch mouse events
    const mouseEvents = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
    for (const evtName of mouseEvents) {
      el.dispatchEvent(
        new MouseEvent(evtName, {
          bubbles: true,
          cancelable: true,
          view: window,
        })
      );
    }

    if (typeof el.click === 'function') {
      el.click();
    }

    return { success: true, message: 'Element clicked successfully' };
  }

  private async handleType(
    el: HTMLElement,
    text: string
  ): Promise<{ success: boolean; message?: string }> {
    el.focus();

    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      // Set value directly and dispatch input events
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, text);
      } else {
        el.value = text;
      }

      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, message: `Typed "${text}" into field` };
    }

    if (el.isContentEditable) {
      el.textContent = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return { success: true, message: `Typed "${text}" into editable element` };
    }

    return { success: false, message: 'Target element is not an editable input' };
  }

  private async handleClear(el: HTMLElement): Promise<{ success: boolean; message?: string }> {
    el.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, message: 'Input cleared' };
    }
    return { success: false, message: 'Element is not clearable' };
  }

  private async handleScroll(
    el: HTMLElement | null,
    direction?: 'up' | 'down' | 'to-top' | 'to-bottom'
  ): Promise<{ success: boolean; message?: string }> {
    const scrollTarget = el || window;
    const distance = 400;

    switch (direction) {
      case 'down':
        scrollTarget.scrollBy({ top: distance, behavior: 'smooth' });
        break;
      case 'up':
        scrollTarget.scrollBy({ top: -distance, behavior: 'smooth' });
        break;
      case 'to-top':
        scrollTarget.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'to-bottom':
        scrollTarget.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        break;
      default:
        scrollTarget.scrollBy({ top: distance, behavior: 'smooth' });
    }

    return { success: true, message: `Scrolled ${direction || 'down'}` };
  }

  private async handleSelect(
    el: HTMLElement,
    val: string
  ): Promise<{ success: boolean; message?: string }> {
    if (el instanceof HTMLSelectElement) {
      el.value = val;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, message: `Selected option "${val}"` };
    }
    return { success: false, message: 'Target is not a select element' };
  }

  private async handleHover(el: HTMLElement): Promise<{ success: boolean; message?: string }> {
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
    return { success: true, message: 'Element hovered' };
  }

  private async handleSubmit(el: HTMLElement): Promise<{ success: boolean; message?: string }> {
    if (el instanceof HTMLFormElement) {
      el.submit();
      return { success: true, message: 'Form submitted' };
    }
    const parentForm = el.closest('form');
    if (parentForm) {
      parentForm.requestSubmit ? parentForm.requestSubmit() : parentForm.submit();
      return { success: true, message: 'Associated form submitted' };
    }
    return this.handleClick(el);
  }
}
