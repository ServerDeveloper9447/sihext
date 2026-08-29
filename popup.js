/**
 * Popup Script (popup.js)
 * Handles user interaction in popup, triggers START_AGENT_LOOP in background.js,
 * and renders live progress & redaction preview.
 */

document.addEventListener('DOMContentLoaded', () => {
  const promptInput = document.getElementById('prompt-input');
  const runBtn = document.getElementById('run-btn');
  const pipelineStatus = document.getElementById('pipeline-status');
  const logList = document.getElementById('log-list');
  const resultBox = document.getElementById('result-box');
  const previewBox = document.getElementById('preview-box');
  const previewImg = document.getElementById('preview-img');
  const chips = document.querySelectorAll('.chip');

  // Quick chip click handlers
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const text = chip.getAttribute('data-text');
      if (text) {
        promptInput.value = text;
      }
    });
  });

  // Listen for progress updates from background service worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'AGENT_PROGRESS' && message.progress) {
      appendLog(message.progress.message);
    }
  });

  // Main trigger: Run Agent Loop
  runBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt) return;

    // Reset UI
    setRunningState(true);
    clearLogs();
    resultBox.style.display = 'none';
    previewBox.style.display = 'none';

    appendLog(`🚀 Starting agent loop for prompt: "${prompt}"`);

    try {
      // Step A: Send START_AGENT_LOOP to background service worker
      const response = await chrome.runtime.sendMessage({
        action: 'START_AGENT_LOOP',
        prompt: prompt,
      });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Agent loop returned failure.');
      }

      const { visionResponse, execResponse, redactionStats, redactedImagePreview, interactiveCount } = response.data;

      appendLog(`✓ Found & marked ${interactiveCount} interactive DOM elements`);
      appendLog(`✓ Redacted ${redactionStats.totalMasked} sensitive regions (${redactionStats.domPiiMasked} DOM PII + ${redactionStats.visualPiiMasked} Visual Faces)`);
      appendLog(`✓ Vision Model planned: ${visionResponse.action.toUpperCase()} target [${visionResponse.target_id}]`);
      appendLog(`✓ DOM Action status: ${execResponse?.message || 'Completed'}`);

      // Display result box
      resultBox.style.display = 'block';
      resultBox.innerHTML = `
        <strong>✓ Agent Turn Completed</strong><br/>
        • Action: <code>${visionResponse.action}</code> on target <code>[${visionResponse.target_id}]</code><br/>
        • Redactions Applied: ${redactionStats.totalMasked} (${redactionStats.domPiiMasked} DOM PII, ${redactionStats.visualPiiMasked} Face ML)<br/>
        • Status: ${execResponse?.message || 'Action executed successfully'}
      `;

      // Display redacted screenshot preview
      if (redactedImagePreview) {
        previewImg.src = redactedImagePreview;
        previewBox.style.display = 'block';
      }

      pipelineStatus.textContent = 'Completed';
      pipelineStatus.style.color = '#34d399';
    } catch (err) {
      console.error('[Popup] Error running agent loop:', err);
      appendLog(`❌ Error: ${err.message}`);
      resultBox.style.display = 'block';
      resultBox.style.background = 'rgba(244, 63, 94, 0.15)';
      resultBox.style.borderColor = 'rgba(244, 63, 94, 0.4)';
      resultBox.style.color = '#fda4af';
      resultBox.textContent = `Execution Failed: ${err.message}`;

      pipelineStatus.textContent = 'Failed';
      pipelineStatus.style.color = '#f43f5e';
    } finally {
      setRunningState(false);
    }
  });

  function setRunningState(isRunning) {
    if (isRunning) {
      runBtn.disabled = true;
      runBtn.innerHTML = '<span class="spinner"></span> <span>Running Agent Loop...</span>';
      pipelineStatus.textContent = 'In Progress...';
      pipelineStatus.style.color = '#fbbf24';
    } else {
      runBtn.disabled = false;
      runBtn.innerHTML = '<span>Run Vision Agent Loop</span>';
    }
  }

  function clearLogs() {
    logList.innerHTML = '';
  }

  function appendLog(text) {
    const item = document.createElement('div');
    item.className = 'log-item';
    item.textContent = text.startsWith('✓') || text.startsWith('🚀') || text.startsWith('❌') ? text : `• ${text}`;
    if (text.startsWith('✓')) {
      item.classList.add('done');
    }
    logList.appendChild(item);
    logList.scrollTop = logList.scrollHeight;
  }
});
