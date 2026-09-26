/**
 * Background Service Worker (background.js)
 * Orchestrates the Privacy-Preserving Vision Agent loop:
 * 1. Ensures Offscreen document exists
 * 2. Commands Content Script to apply Set-of-Mark and locate PII elements
 * 3. Captures visible tab screenshot
 * 4. Routes screenshot & PII boxes to Offscreen document for Canvas & ML Redaction
 * 5. Calls Vision Agent backend API placeholder
 * 6. Commands Content Script to execute planned action and clean up DOM
 */

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

// Central State Manager
const agentState = {
  isRunning: false,
  lastPrompt: '',
  lastResult: null,
  activeTabId: null,
};

// ==========================================
// Offscreen Document Lifecycle Manager
// ==========================================
async function ensureOffscreenDocument() {
  // Check if offscreen document already exists using getContexts API (Chrome 116+)
  if ('getContexts' in chrome.runtime) {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    if (existingContexts.length > 0) {
      return;
    }
  } else {
    // Fallback check for earlier versions
    const matchedClients = await clients.matchAll();
    for (const client of matchedClients) {
      if (client.url.includes(OFFSCREEN_DOCUMENT_PATH)) {
        return;
      }
    }
  }

  // Create new offscreen document
  try {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: [
        chrome.offscreen.Reason.DOM_PARSER || 'DOM_PARSER',
        chrome.offscreen.Reason.BLOBS || 'BLOBS',
      ],
      justification: 'Required for HTML5 Canvas image redaction and WebGPU ML inference',
    });
    console.log('[Background] Offscreen document created successfully.');
  } catch (err) {
    // If it was created concurrently, ignore the error
    if (!err.message?.includes('Only a single offscreen document may be created')) {
      console.error('[Background] Failed to create offscreen document:', err);
      throw err;
    }
  }
}

// ==========================================
// Vision Agent API Placeholder (Step F)
// ==========================================
/**
 * Async function to invoke the Vision-Language Agent Backend.
 * 
 * TODO: Connect this function to your actual FastAPI / vLLM / custom model backend server.
 * Example FastAPI endpoint call:
 *   const response = await fetch('http://localhost:8000/api/v1/vision-agent', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       prompt,
 *       image: base64Image, // Redacted screenshot with Set-of-Mark IDs
 *       dom_elements: sanitizedDOM,
 *     })
 *   });
 *   return await response.json();
 */
async function callVisionAgentAPI(prompt, base64Image, sanitizedDOM) {
  console.log('[Background] callVisionAgentAPI invoked with prompt:', prompt);
  console.log('[Background] Sanitized DOM node count:', sanitizedDOM?.length || 0);

  // Simulated processing latency (e.g. inference time)
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Determine an intelligent mock target from the sanitized DOM elements
  let targetId = '1';
  let actionType = 'click';
  let valueToType = '';

  const normalizedPrompt = prompt.toLowerCase();

  if (sanitizedDOM && sanitizedDOM.length > 0) {
    // Look for matching elements based on user prompt keywords
    if (normalizedPrompt.includes('search') || normalizedPrompt.includes('type') || normalizedPrompt.includes('fill')) {
      const inputEl = sanitizedDOM.find((el) => el.isInput || el.tagName === 'input');
      if (inputEl) {
        targetId = String(inputEl.id);
        actionType = 'type';
        valueToType = prompt.replace(/(type|fill|search for|enter|into|the|box)/gi, '').trim() || 'AI agent query';
      }
    } else {
      // Find first clickable button/link
      const clickableEl = sanitizedDOM.find((el) => el.tagName === 'button' || el.tagName === 'a');
      if (clickableEl) {
        targetId = String(clickableEl.id);
        actionType = 'click';
      }
    }
  }

  // Return formatted action plan
  return {
    action: actionType,
    target_id: targetId,
    value: valueToType,
    explanation: `Vision Model identified target mark [${targetId}] to execute "${actionType}" based on user prompt "${prompt}".`,
    model: 'Privacy-Vision-Agent-v1 (Placeholder / Mock API)',
  };
}

// ==========================================
// Orchestration Loop (Step A -> G)
// ==========================================
async function executeAgentLoop(prompt, sendProgress) {
  agentState.isRunning = true;
  agentState.lastPrompt = prompt;

  try {
    // 1. Get active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      throw new Error('No active browser tab found to inspect.');
    }
    agentState.activeTabId = activeTab.id;

    // 2. Ensure Offscreen Document exists (Step B)
    sendProgress?.({ step: 'init_offscreen', message: 'Ensuring offscreen canvas & ML environment...' });
    await ensureOffscreenDocument();

    // 3. Command Content Script to Prepare DOM with Set-of-Mark & PII detection (Step C)
    sendProgress?.({ step: 'prepare_dom', message: 'Annotating interactive elements & detecting PII in DOM...' });
    const domResponse = await chrome.tabs.sendMessage(activeTab.id, {
      action: 'PREPARE_DOM',
    });

    if (!domResponse || !domResponse.success) {
      throw new Error(domResponse?.error || 'Content script failed to prepare DOM with Set-of-Mark.');
    }

    const { piiBoxes = [], interactiveElements = [] } = domResponse;
    console.log(`[Background] Received ${interactiveElements.length} Set-of-Mark elements and ${piiBoxes.length} DOM PII boxes.`);

    // 4. Capture visible tab screenshot (Step D)
    sendProgress?.({ step: 'capture_screen', message: 'Capturing high-resolution viewport screenshot...' });
    // Small delay to ensure Set-of-Mark overlays are painted by browser
    await new Promise((r) => setTimeout(r, 120));

    const rawScreenshot = await chrome.tabs.captureVisibleTab(activeTab.windowId, {
      format: 'png',
    });

    chrome.tabs.sendMessage(activeTab.id, { action: 'CLEANUP_DOM' }).catch(() => { });

    // 5. Send to Offscreen Document for Canvas & ML Redaction (Step E)
    sendProgress?.({ step: 'redact_image', message: 'Running on-device visual redaction (Canvas + ML Face Detection)...' });
    const redactResponse = await chrome.runtime.sendMessage({
      action: 'PROCESS_IMAGE',
      imageBase64: rawScreenshot,
      piiBoxes: piiBoxes,
    });

    if (!redactResponse || !redactResponse.success) {
      throw new Error(redactResponse?.error || 'Offscreen document failed to redact image.');
    }

    const redactedScreenshot = redactResponse.redactedImage;
    const redactionStats = redactResponse.stats || { domPiiMasked: piiBoxes.length, visualPiiMasked: 0 };
    console.log('[Background] Redaction complete. Total masked regions:', redactionStats);

    // 6. Call Vision Agent API Placeholder (Step F)
    sendProgress?.({ step: 'call_vlm', message: 'Submitting redacted screenshot & Set-of-Mark map to Vision Agent...' });
    const visionResponse = await callVisionAgentAPI(prompt, redactedScreenshot, interactiveElements);

    // 7. Execute Action & Cleanup in Content Script (Step G)
    sendProgress?.({ step: 'execute_action', message: `Executing action "${visionResponse.action}" on target [${visionResponse.target_id}]...` });
    const execResponse = await chrome.tabs.sendMessage(activeTab.id, {
      action: 'EXECUTE_ACTION',
      payload: visionResponse,
    });

    const finalResult = {
      success: true,
      prompt,
      visionResponse,
      execResponse,
      redactionStats,
      interactiveCount: interactiveElements.length,
      redactedImagePreview: redactedScreenshot,
      timestamp: Date.now(),
    };

    agentState.lastResult = finalResult;
    return finalResult;
  } catch (err) {
    console.error('[Background] Error in agent loop:', err);
    // Cleanup DOM overlays if active tab is still valid
    if (agentState.activeTabId) {
      chrome.tabs.sendMessage(agentState.activeTabId, { action: 'CLEANUP_DOM' }).catch(() => {});
    }
    throw err;
  } finally {
    agentState.isRunning = false;
  }
}

// ==========================================
// Runtime Message Listener
// ==========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_AGENT_LOOP') {
    const prompt = message.prompt || 'Analyze and interact with page';
    console.log('[Background] Received START_AGENT_LOOP:', prompt);

    executeAgentLoop(prompt, (progress) => {
      // Broadcast progress if popup is listening
      chrome.runtime.sendMessage({
        action: 'AGENT_PROGRESS',
        progress,
      }).catch(() => {});
    })
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true; // Keep message channel open for async response
  }

  if (message.action === 'GET_AGENT_STATE') {
    sendResponse({ success: true, state: agentState });
    return true;
  }

  if (message.action === 'CLEANUP_DOM') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'CLEANUP_DOM' }).then(sendResponse).catch(() => sendResponse({ success: false }));
      }
    });
    return true;
  }
});
