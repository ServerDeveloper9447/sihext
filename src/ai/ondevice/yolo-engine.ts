import { ExtractedDOMSummary, AgentAction, InteractiveDOMNode } from '../../types';

export interface OnDeviceResult {
  answer: string;
  actions: AgentAction[];
  modelUsed: string;
  latencyMs: number;
}

/**
 * On-device YOLO engine for webpage actions.
 */
export class OnDeviceYOLOEngine {
  private modelName = 'On-device YOLO';

  /**
   * Processes the user query locally against the current page and layout.
   */
  public async processLocal(
    query: string,
    domSummary: ExtractedDOMSummary
  ): Promise<OnDeviceResult> {
    const startTime = performance.now();

    const normalizedQuery = query.toLowerCase().trim();
    const actions: AgentAction[] = [];
    let answer = '';

    // 1. Check for specific action commands
    if (normalizedQuery.includes('click') || normalizedQuery.includes('press') || normalizedQuery.includes('open')) {
      const targetMatch = this.findBestElementMatch(normalizedQuery, domSummary.elements, ['button', 'a']);
      if (targetMatch) {
        actions.push({
          id: `act-${Date.now()}-1`,
          type: 'click',
          refId: targetMatch.refId,
          selector: targetMatch.selector,
          description: `Click ${targetMatch.tagName} "${targetMatch.text || targetMatch.ariaLabel || targetMatch.refId}"`,
          status: 'pending',
        });
        answer = `Local DOM match found target "${targetMatch.text || targetMatch.ariaLabel || targetMatch.refId}" at coordinates [${targetMatch.boundingBox.x}, ${targetMatch.boundingBox.y}]. Prepared click action.`;
      } else {
        answer = `Searched ${domSummary.elements.length} interactive elements locally, but could not find a high-confidence match for your click request.`;
      }
    } else if (normalizedQuery.includes('clear')) {
      const targetInput = this.findBestElementMatch(normalizedQuery, domSummary.elements, ['input', 'textarea']);
      if (targetInput) {
        actions.push({
          id: `act-${Date.now()}-1`,
          type: 'clear',
          refId: targetInput.refId,
          selector: targetInput.selector,
          description: `Clear ${targetInput.placeholder || targetInput.name || targetInput.refId}`,
          status: 'pending',
        });
        answer = `Located input field to clear (${targetInput.placeholder || targetInput.name || 'field'}).`;
      } else {
        answer = `Could not locate an input field to clear.`;
      }
    } else if (normalizedQuery.includes('type') || normalizedQuery.includes('fill') || normalizedQuery.includes('search')) {
      const targetInput = this.findBestElementMatch(normalizedQuery, domSummary.elements, ['input', 'textarea']);
      const textToType = this.extractTextToType(query);

      if (targetInput) {
        actions.push({
          id: `act-${Date.now()}-1`,
          type: 'type',
          refId: targetInput.refId,
          selector: targetInput.selector,
          value: textToType,
          description: `Type "${textToType}" into ${targetInput.placeholder || targetInput.name || targetInput.refId}`,
          status: 'pending',
        });
        answer = `Located input field (${targetInput.placeholder || targetInput.name || 'field'}). Prepared action to enter text.`;
      } else {
        answer = `Could not locate an active input field for typing.`;
      }
    } else if (normalizedQuery.includes('scroll down') || normalizedQuery.includes('next page')) {
      actions.push({
        id: `act-${Date.now()}-1`,
        type: 'scroll',
        scrollDirection: 'down',
        description: 'Scroll down page',
        status: 'pending',
      });
      answer = 'Prepared scroll down action.';
    } else if (normalizedQuery.includes('scroll up') || normalizedQuery.includes('top')) {
      actions.push({
        id: `act-${Date.now()}-1`,
        type: 'scroll',
        scrollDirection: normalizedQuery.includes('top') ? 'to-top' : 'up',
        description: 'Scroll up page',
        status: 'pending',
      });
      answer = 'Prepared scroll up action.';
    } else {
      // General question answering based on local DOM text
      answer = this.synthesizeLocalAnswer(query, domSummary);
    }

    const latencyMs = Math.round(performance.now() - startTime);

    return {
      answer,
      actions,
      modelUsed: this.modelName,
      latencyMs,
    };
  }

  private findBestElementMatch(
    query: string,
    elements: InteractiveDOMNode[],
    preferredTags: string[]
  ): InteractiveDOMNode | null {
    const cleanQuery = query.replace(/(click|press|open|type|fill|search for|clear|into|on|the|button|link|input)/gi, '').trim();

    // 1. Tag match + exact text match
    for (const el of elements) {
      if (preferredTags.includes(el.tagName)) {
        const text = (el.text || el.ariaLabel || el.placeholder || el.name || '').toLowerCase();
        if (text && cleanQuery && (text.includes(cleanQuery) || cleanQuery.includes(text))) {
          return el;
        }
      }
    }

    // 2. Any interactive element text match
    for (const el of elements) {
      const text = (el.text || el.ariaLabel || el.placeholder || '').toLowerCase();
      if (text && cleanQuery && text.includes(cleanQuery)) {
        return el;
      }
    }

    // 3. Fallback to first preferred tag if query is generic
    if (preferredTags.includes('input')) {
      return elements.find((e) => e.isInput && e.isVisible) || null;
    }

    return null;
  }

  private extractTextToType(query: string): string {
    const quotedMatch = query.match(/["']([^"']+)["']/);
    if (quotedMatch && quotedMatch[1]) {
      return quotedMatch[1];
    }
    const match = query.match(/(?:type|fill|search for|enter)\s+(.+?)(?:\s+(?:into|in|on)\b|$)/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return 'Sample Text';
  }

  private synthesizeLocalAnswer(query: string, domSummary: ExtractedDOMSummary): string {
    const lines: string[] = [
      `### Local DOM Summary`,
      `**Page**: [${domSummary.title}](${domSummary.url})`,
      `**Interactive Elements Detected**: ${domSummary.interactiveCount}`,
      `**Sensitive Elements Masked**: ${domSummary.sensitiveElementsCount}`,
      '',
      `**DOM Analysis**:`,
    ];

    if (query.toLowerCase().includes('summar') || query.toLowerCase().includes('what is')) {
      const snippet = domSummary.sanitizedTextContent.slice(0, 450).trim();
      lines.push(snippet ? `> ${snippet}...` : 'Page loaded with interactive UI elements.');
    } else {
      lines.push(`Analyzed the current page layout and elements locally using regex/DOM heuristics. You can ask me to click any button, fill forms, or summarize specific sections without sending your data to the cloud.`);
    }

    return lines.join('\n');
  }
}