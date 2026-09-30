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
    const fieldAssignments = this.extractFieldAssignments(query, domSummary.elements);
    const pageAssignments = fieldAssignments.length === 0
      ? this.getPageFieldAssignments(query, domSummary)
      : [];

    // 1. Honor field/value pairs explicitly supplied by the user.
    if (fieldAssignments.length > 0) {
      for (const { element, value } of fieldAssignments) {
        actions.push({
          id: `act-${Date.now()}-${actions.length + 1}`,
          type: 'type',
          refId: element.refId,
          selector: element.selector,
          value,
          description: `Fill ${element.label || element.ariaLabel || element.name || element.placeholder || 'form field'}`,
          status: 'pending',
        });
      }
      answer = `Prepared ${actions.length} local form-fill action${actions.length === 1 ? '' : 's'} for the explicitly named field${actions.length === 1 ? '' : 's'}.`;
    // 2. Infer mappings only when the user asks to fill without giving values.
    } else if (pageAssignments.length > 0) {
      for (const { element, valueToken } of pageAssignments) {
        actions.push({
          id: `act-${Date.now()}-${actions.length + 1}`,
          type: 'type',
          refId: element.refId,
          selector: element.selector,
          value: `[${valueToken}]`,
          description: `Fill ${element.label || element.ariaLabel || element.name || 'form field'} with matching page data`,
          status: 'pending',
        });
      }
      answer = `Matched ${actions.length} detected page value${actions.length === 1 ? '' : 's'} to form field${actions.length === 1 ? '' : 's'} locally.`;
    // 3. Check for specific action commands
    } else if (normalizedQuery.includes('click') || normalizedQuery.includes('press') || normalizedQuery.includes('open')) {
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
    const prefersInputs = preferredTags.some((tag) => tag === 'input' || tag === 'textarea');
    const isPreferredElement = (element: InteractiveDOMNode) =>
      preferredTags.includes(element.tagName) ||
      (prefersInputs && element.isInput) ||
      (preferredTags.includes('button') && element.isClickable);
    const getElementContext = (element: InteractiveDOMNode) => [
      element.label,
      element.text,
      element.ariaLabel,
      element.placeholder,
      element.name,
      element.id,
      element.type,
      element.role,
      element.autocomplete,
      element.piiType,
    ].filter(Boolean).join(' ').toLowerCase();

    // 1. Preferred control + match against its label and semantic metadata
    for (const el of elements) {
      if (isPreferredElement(el)) {
        const context = getElementContext(el);
        if (context && cleanQuery && (context.includes(cleanQuery) || cleanQuery.includes(context))) {
          return el;
        }
      }
    }

    // 2. Any interactive element text match
    for (const el of elements) {
      const context = getElementContext(el);
      if (context && cleanQuery && context.includes(cleanQuery)) {
        return el;
      }
    }

    // 3. Fallback to first preferred tag if query is generic
    if (prefersInputs) {
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

  private getPageFieldAssignments(
    query: string,
    domSummary: ExtractedDOMSummary
  ): Array<{ element: InteractiveDOMNode; valueToken: string }> {
    const asksToFillForm =
      /\b(fill|complete|autofill|populate|enter|put)\b/i.test(query) &&
      /\b(form|fields?|details|information|registration|application|profile|checkout|email|e-mail|phone|name|address|birth|card)\b/i.test(query);
    if (!asksToFillForm) return [];

    const availableValues = new Map<string, string>();
    for (const region of domSummary.sensitiveTextRegions || []) {
      availableValues.set(region.valueToken, region.piiType);
    }
    for (const element of domSummary.elements) {
      if (!element.isSensitive || !element.piiType) continue;
      for (const source of [element.value, element.text]) {
        const valueToken = source?.match(/^\[([A-Za-z][A-Za-z0-9_]*-\d+)\]$/)?.[1];
        if (valueToken) availableValues.set(valueToken, element.piiType);
      }
    }
    const values = Array.from(availableValues, ([valueToken, piiType]) => ({ valueToken, piiType }));
    const assignments: Array<{ element: InteractiveDOMNode; valueToken: string }> = [];
    for (const element of domSummary.elements) {
      if (!element.isInput || !element.isVisible || !element.isSensitive || !element.piiType) continue;
      const value = values.find((candidate) => this.areCompatiblePiiTypes(element.piiType!, candidate.piiType));
      if (!value || assignments.some((assignment) => assignment.element.refId === element.refId)) continue;
      assignments.push({ element, valueToken: value.valueToken });
    }
    return assignments;
  }

  private areCompatiblePiiTypes(fieldType: string, valueType: string): boolean {
    if (fieldType === valueType) return true;
    const governmentIdTypes = new Set(['gov_id', 'ssn', 'aadhaar', 'pan']);
    return governmentIdTypes.has(fieldType) && governmentIdTypes.has(valueType);
  }

  private extractFieldAssignments(
    query: string,
    elements: InteractiveDOMNode[]
  ): Array<{ element: InteractiveDOMNode; value: string }> {
    const fieldElements = elements.filter((element) => element.isInput && element.isVisible);
    const aliases = fieldElements.flatMap((element) => {
      const labels = [element.label, element.ariaLabel, element.name, element.placeholder]
        .filter((label): label is string => Boolean(label))
        .map((label) => ({ element, label: label.trim().replace(/\s*\*+\s*$/, '') }))
        .filter(({ label }) => label.length > 1);
      return labels;
    }).sort((left, right) => right.label.length - left.label.length);

    const mentions: Array<{ element: InteractiveDOMNode; start: number; end: number }> = [];
    const lowerQuery = query.toLowerCase();
    for (const { element, label } of aliases) {
      const lowerLabel = label.toLowerCase();
      let start = lowerQuery.indexOf(lowerLabel);
      while (start !== -1) {
        const end = start + lowerLabel.length;
        const overlaps = mentions.some((mention) => start < mention.end && end > mention.start);
        if (!overlaps) mentions.push({ element, start, end });
        start = lowerQuery.indexOf(lowerLabel, end);
      }
    }
    mentions.sort((left, right) => left.start - right.start);

    const assignments: Array<{ element: InteractiveDOMNode; value: string }> = [];
    for (let index = 0; index < mentions.length; index++) {
      const mention = mentions[index];
      const remainder = query.slice(mention.end);
      const connector = remainder.match(/^\s*(?:field\s+)?(?:with|to|as|=|:)\s*/i);
      if (!connector) continue;

      const valueStart = mention.end + connector[0].length;
      const nextFieldStart = mentions[index + 1]?.start ?? query.length;
      const value = query.slice(valueStart, nextFieldStart)
        .replace(/[\s,;]+(?:and|then)?\s*$/i, '')
        .trim()
        .replace(/^(?:["'])(.*)(?:["'])$/s, '$1');
      if (!value || assignments.some((assignment) => assignment.element.refId === mention.element.refId)) continue;
      assignments.push({ element: mention.element, value });
    }

    return assignments;
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