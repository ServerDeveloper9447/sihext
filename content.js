/**
 * Content Script (content.js)
 * 
 * Responsibilities:
 * 1. Step C: Locate DOM PII elements and generate Set-of-Mark (SoM) overlays
 * 2. Step G: Execute planned actions (click, type, scroll) on the target element and cleanup overlays
 */

// Memory map: ID -> Real DOM Element
const idToElementMap = new Map();
let overlayContainer = null;

// ==========================================
// PII Heuristics Detection (Step C)
// ==========================================
/**
 * Scans the DOM for standard sensitive PII elements (passwords, credit cards, SSN, PINs).
 * Returns their viewport-relative bounding boxes for canvas redaction.
 */
function findPII() {
  const piiBoxes = [];

  // PII Selectors
  const piiSelectors = [
    'input[type="password"]',
    'input[autocomplete*="cc-"]',
    'input[autocomplete*="password"]',
    'input[name*="password" i]',
    'input[name*="passwd" i]',
    'input[name*="cvv" i]',
    'input[name*="cvc" i]',
    'input[name*="ssn" i]',
    'input[name*="creditcard" i]',
    'input[id*="password" i]',
    'input[id*="ssn" i]',
    'input[id*="cvv" i]',
    '.ssn',
    '.credit-card',
    '.creditcard',
    '.cvv',
    '[data-sensitive="true"]',
  ];

  const matchedElements = document.querySelectorAll(piiSelectors.join(','));

  for (const el of matchedElements) {
    if (!isElementVisible(el)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      piiBoxes.push({
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        tag: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || 'sensitive',
      });
    }
  }

  return piiBoxes;
}

// ==========================================
// Set-of-Mark (SoM) Annotation (Step C)
// ==========================================
/**
 * Finds all visible interactive elements on the page, assigns each a unique integer ID,
 * and renders an overlay box with an ID badge.
 */
function applySetOfMark() {
  cleanupOverlays();
  idToElementMap.clear();

  // Create or retrieve root overlay container
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'som-overlay-container';
  document.documentElement.appendChild(overlayContainer);

  const interactiveSelectors = [
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="switch"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
    '[onclick]',
  ];

  const candidates = Array.from(document.querySelectorAll(interactiveSelectors.join(',')));
  const sanitizedDOM = [];
  let markCounter = 1;

  // Track scroll offsets for accurate page-relative positioning
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;

  for (const el of candidates) {
    if (!isElementVisible(el)) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue; // Skip microscopic nodes

    const currentId = markCounter++;
    idToElementMap.set(String(currentId), el);
    el.setAttribute('data-som-id', String(currentId));

    // 1. Create SoM Overlay Box
    const overlay = document.createElement('div');
    overlay.className = 'som-mark-overlay';
    overlay.style.top = `${rect.top + scrollY}px`;
    overlay.style.left = `${rect.left + scrollX}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    // 2. Create SoM ID Badge
    const badge = document.createElement('div');
    badge.className = 'som-mark-badge';
    badge.textContent = String(currentId);
    overlay.appendChild(badge);

    overlayContainer.appendChild(overlay);

    // 3. Build Sanitized DOM description for Vision Agent
    let text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if (text.length > 80) text = text.slice(0, 80) + '...';

    sanitizedDOM.push({
      id: currentId,
      tagName: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || undefined,
      text: text || undefined,
      ariaLabel: el.getAttribute('aria-label') || undefined,
      placeholder: el.getAttribute('placeholder') || undefined,
      role: el.getAttribute('role') || undefined,
      isInput: ['input', 'textarea', 'select'].includes(el.tagName.toLowerCase()),
      boundingBox: {
        x: Math.round(rect.left),
        y: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
    });
  }

  return sanitizedDOM;
}

// ==========================================
// Action Execution & Cleanup (Step G)
// ==========================================
/**
 * Executes action on the specified target DOM element.
 */
async function executeAction(payload) {
  const { action = 'click', target_id, value } = payload || {};
  const targetElement = idToElementMap.get(String(target_id)) || document.querySelector(`[data-som-id="${target_id}"]`);

  if (!targetElement) {
    cleanupOverlays();
    return { success: false, error: `Target element with ID [${target_id}] was not found in the DOM.` };
  }

  try {
    // 1. Smoothly scroll target element into viewport center
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    targetElement.classList.add('som-action-pulse');

    await new Promise((r) => setTimeout(r, 200));

    // 2. Execute requested action type
    if (action === 'click') {
      targetElement.focus();
      // Dispatch standard mouse event sequence
      ['mousedown', 'mouseup', 'click'].forEach((evtType) => {
        targetElement.dispatchEvent(new MouseEvent(evtType, { bubbles: true, cancelable: true, view: window }));
      });
      if (typeof targetElement.click === 'function') {
        targetElement.click();
      }
    } else if (action === 'type' || action === 'fill') {
      targetElement.focus();
      const textToType = value || 'test input';

      if (targetElement instanceof HTMLInputElement || targetElement instanceof HTMLTextAreaElement) {
        targetElement.value = textToType;
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
        targetElement.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (targetElement.isContentEditable) {
        targetElement.textContent = textToType;
        targetElement.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else if (action === 'focus') {
      targetElement.focus();
    }

    // 3. Remove Set-of-Mark overlays to return page to normal
    setTimeout(() => {
      targetElement.classList.remove('som-action-pulse');
      cleanupOverlays();
    }, 400);

    return {
      success: true,
      message: `Successfully executed "${action}" on element [${target_id}] (${targetElement.tagName.toLowerCase()})`,
    };
  } catch (err) {
    cleanupOverlays();
    return { success: false, error: err.message };
  }
}

function removeVisualOverlays() {
  const existing = document.getElementById('som-overlay-container');
  if (existing) {
    existing.remove();
  }
  document.querySelectorAll('.som-mark-overlay, .som-mark-badge').forEach((el) => el.remove());
  overlayContainer = null;
}

function cleanupOverlays() {
  removeVisualOverlays();
  document.querySelectorAll('[data-som-id]').forEach((el) => el.removeAttribute('data-som-id'));
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    cleanupOverlays();
  }
});

window.addEventListener('click', (e) => {
  if (!e.isTrusted) return;
  const existing = document.getElementById('som-overlay-container');
  if (existing) {
    removeVisualOverlays();
  }
}, { capture: true });

// Helper: Check element visibility
function isElementVisible(el) {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) <= 0.05) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// ==========================================
// Message Dispatcher
// ==========================================
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const action = message.action || message.type;
  if (action === 'PREPARE_DOM') {
    try {
      cleanupOverlays();
      const piiBoxes = findPII();
      const interactiveElements = applySetOfMark();
      sendResponse({
        success: true,
        piiBoxes,
        interactiveElements,
      });
    } catch (err) {
      console.error('[Content] Failed to prepare DOM:', err);
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  if (action === 'EXECUTE_ACTION') {
    executeAction(message.payload)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (action === 'CLEANUP_DOM' || action === 'CLEANUP_OVERLAYS') {
    removeVisualOverlays();
    sendResponse({ success: true });
    return true;
  }

  if (action === 'CLEAR_HIGHLIGHT' || action === 'RESET_DOM') {
    cleanupOverlays();
    sendResponse({ success: true });
    return true;
  }
});
