import { AgentAction } from '../types';

// Actions that legitimately don't need a resolved DOM element/point.
const ACTIONS_WITHOUT_ELEMENT = new Set(['scroll', 'navigate', 'wait', 'answer', 'done', 'press_key']);

export class ActionExecutor {
  /**
   * Executes an automated DOM action on the active webpage.
   */
  public async execute(action: AgentAction): Promise<{ success: boolean; message?: string }> {
    try {
      const targetElement = this.resolveElement(action);

      if (!targetElement && !ACTIONS_WITHOUT_ELEMENT.has(action.type)) {
        const targetDesc =
          action.refId || action.selector ||
          (action.x !== undefined ? `(${action.x}, ${action.y})` : 'unknown');
        return {
          success: false,
          message: `Target element not found for: ${targetDesc}`,
        };
      }

      // Scroll target into view -- but NOT for coordinate-targeted actions.
      // x/y were chosen from what was already visible in the screenshot, and
      // they're only valid at that scroll position; scrolling here would
      // shift the page and leave the click landing on the wrong spot.
      const coordinatesInPlay = action.x !== undefined || action.targetX !== undefined;
      if (targetElement && !coordinatesInPlay) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        await new Promise((r) => setTimeout(r, 150));
      }

      switch (action.type) {
        case 'click':
          return await this.handleClick(targetElement!, action);

        case 'double_click':
          return await this.handleDoubleClick(targetElement!, action);

        case 'right_click':
          return await this.handleRightClick(targetElement!, action);

        case 'type':
          return await this.handleType(targetElement!, action.value || '');

        case 'clear':
          return await this.handleClear(targetElement!);

        case 'scroll':
          return await this.handleScroll(targetElement, action.scrollDirection, action.scrollAmountPx);

        case 'select':
          return await this.handleSelect(targetElement!, action.value || '');

        case 'hover':
          return await this.handleHover(targetElement!, action);

        case 'drag':
          return await this.handleDrag(targetElement!, action);

        case 'press_key':
          return await this.handlePressKey(targetElement, action.key);

        case 'submit':
          return await this.handleSubmit(targetElement!);

        case 'navigate':
          if (action.url) {
            window.location.href = action.url;
            return { success: true, message: `Navigating to ${action.url}` };
          }
          return { success: false, message: 'No URL provided for navigation' };

        case 'wait':
          return await this.handleWait(action.durationMs);

        case 'answer':
          // Not a DOM action -- the answer text is surfaced to the user by
          // the calling layer (coordinator/UI). Nothing to execute on the page.
          return { success: true, message: action.answerText || 'Answer provided.' };

        case 'done':
          return { success: true, message: 'Task marked complete.' };

        default:
          return { success: false, message: `Unsupported action type: ${action.type}` };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Action failed: ${msg}` };
    }
  }

  private resolveByRefId(refId: string): HTMLElement | null {
    let el = document.querySelector(`[data-sihext-ref="${refId}"]`);
    if (!el) {
      const somId = refId.startsWith('sihext-') ? refId.replace('sihext-', '') : refId;
      el = document.querySelector(`[data-som-id="${somId}"]`);
    }
    return el instanceof HTMLElement ? el : null;
  }

  private resolveElement(action: AgentAction): HTMLElement | null {
    if (action.refId) {
      const el = this.resolveByRefId(action.refId);
      if (el) return el;
    }
    if (action.selector) {
      const el = document.querySelector(action.selector);
      if (el instanceof HTMLElement) return el;
    }
    // Fallback: pixel coordinates (canvas-rendered UI with no DOM element to
    // reference). By the time an action reaches the executor, x/y are already
    // real viewport CSS pixels -- the model's 0-1000 normalized values are
    // converted upstream by denormalizeCoordinates() in the backend client.
    if (action.x !== undefined && action.y !== undefined) {
      const el = document.elementFromPoint(action.x, action.y);
      if (el instanceof HTMLElement) return el;
    }
    return null;
  }

  /** clientX/clientY for dispatched mouse events -- explicit x/y if given (canvas case), else the element's center. */
  private getClientCoords(el: HTMLElement, action: AgentAction): { clientX: number; clientY: number } {
    if (action.x !== undefined && action.y !== undefined) {
      return { clientX: action.x, clientY: action.y };
    }
    const rect = el.getBoundingClientRect();
    return { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
  }

  private async handleClick(el: HTMLElement, action: AgentAction): Promise<{ success: boolean; message?: string }> {
    el.focus();
    const { clientX, clientY } = this.getClientCoords(el, action);

    const mouseEvents = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
    for (const evtName of mouseEvents) {
      el.dispatchEvent(
        new MouseEvent(evtName, { bubbles: true, cancelable: true, view: window, clientX, clientY })
      );
    }

    if (typeof el.click === 'function') {
      el.click();
    }

    return { success: true, message: 'Element clicked successfully' };
  }

  private async handleDoubleClick(el: HTMLElement, action: AgentAction): Promise<{ success: boolean; message?: string }> {
    el.focus();
    const { clientX, clientY } = this.getClientCoords(el, action);
    const events = ['mousedown', 'mouseup', 'click', 'mousedown', 'mouseup', 'dblclick'];
    for (const evtName of events) {
      el.dispatchEvent(
        new MouseEvent(evtName, { bubbles: true, cancelable: true, view: window, clientX, clientY, detail: 2 })
      );
    }
    return { success: true, message: 'Element double-clicked' };
  }

  private async handleRightClick(el: HTMLElement, action: AgentAction): Promise<{ success: boolean; message?: string }> {
    el.focus();
    const { clientX, clientY } = this.getClientCoords(el, action);
    const events = ['mousedown', 'mouseup', 'contextmenu'];
    for (const evtName of events) {
      el.dispatchEvent(
        new MouseEvent(evtName, { bubbles: true, cancelable: true, view: window, clientX, clientY, button: 2 })
      );
    }
    return { success: true, message: 'Element right-clicked' };
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
    direction?: 'up' | 'down' | 'left' | 'right' | 'to-top' | 'to-bottom',
    amountPx?: number
  ): Promise<{ success: boolean; message?: string }> {
    const scrollTarget = el || window;
    const distance = amountPx ?? 400; // now actually honors the model's requested amount

    switch (direction) {
      case 'down':
        scrollTarget.scrollBy({ top: distance, behavior: 'smooth' });
        break;
      case 'up':
        scrollTarget.scrollBy({ top: -distance, behavior: 'smooth' });
        break;
      case 'left':
        scrollTarget.scrollBy({ left: -distance, behavior: 'smooth' });
        break;
      case 'right':
        scrollTarget.scrollBy({ left: distance, behavior: 'smooth' });
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

    return { success: true, message: `Scrolled ${direction || 'down'} by ${distance}px` };
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

  private async handleHover(el: HTMLElement, action: AgentAction): Promise<{ success: boolean; message?: string }> {
    const { clientX, clientY } = this.getClientCoords(el, action);
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, clientX, clientY }));
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, clientX, clientY }));
    return { success: true, message: 'Element hovered' };
  }

  private async handleDrag(
    sourceEl: HTMLElement,
    action: AgentAction
  ): Promise<{ success: boolean; message?: string }> {
    const targetEl = action.targetRefId
      ? this.resolveByRefId(action.targetRefId)
      : action.targetX !== undefined && action.targetY !== undefined
      ? document.elementFromPoint(action.targetX, action.targetY)
      : null;

    if (!(targetEl instanceof HTMLElement)) {
      return { success: false, message: 'Drag target not found' };
    }

    const dataTransfer = new DataTransfer();
    const dispatch = (el: HTMLElement, type: string) =>
      el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));

    dispatch(sourceEl, 'dragstart');
    dispatch(targetEl, 'dragenter');
    dispatch(targetEl, 'dragover');
    dispatch(targetEl, 'drop');
    dispatch(sourceEl, 'dragend');

    return { success: true, message: 'Drag completed' };
  }

  private async handlePressKey(
    el: HTMLElement | null,
    key?: string
  ): Promise<{ success: boolean; message?: string }> {
    if (!key) {
      return { success: false, message: 'No key specified for press_key action' };
    }
    const target = el || (document.activeElement as HTMLElement) || document.body;
    target.focus?.();

    const eventInit: KeyboardEventInit = { key, bubbles: true, cancelable: true };
    target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    target.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    target.dispatchEvent(new KeyboardEvent('keyup', eventInit));

    // Dispatched KeyboardEvents don't trigger native form submission on
    // their own -- nudge it along for the common "press Enter to submit" case.
    if (key === 'Enter' && target instanceof HTMLInputElement) {
      const form = target.closest('form');
      if (form) {
        form.requestSubmit ? form.requestSubmit() : form.submit();
      }
    }

    return { success: true, message: `Pressed key "${key}"` };
  }

  private async handleWait(durationMs?: number): Promise<{ success: boolean; message?: string }> {
    const ms = durationMs ?? 1000;
    await new Promise((r) => setTimeout(r, ms));
    return { success: true, message: `Waited ${ms}ms` };
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
    return this.handleClick(el, { type: 'click' } as AgentAction);
  }
}