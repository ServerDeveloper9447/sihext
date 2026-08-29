/**
 * Offscreen Document Script (offscreen.js)
 * 
 * Why Offscreen Document?
 * In Chrome Manifest V3, Background Service Workers cannot access the DOM or the HTML5 <canvas>
 * API (rendering context). Additionally, keeping WebGPU context and large ML model weights in memory
 * is much more reliable inside an offscreen document than in an ephemeral Service Worker.
 * 
 * Responsibilities:
 * 1. Load viewport screenshot into Canvas context
 * 2. Run on-device ML visual PII detection (Face / Sensitive visual element detection)
 * 3. Perform canvas redactions (solid blackout masks over DOM PII boxes and detected faces)
 * 4. Return sanitized base64 PNG data URI to background.js
 */

// ==========================================
// ML Placeholder: Visual PII & Face Detection (Step E)
// ==========================================
/**
 * Detects visual PII (such as human faces, profile avatars, badges) in the screenshot using on-device ML.
 * 
 * =========================================================================
 * TODO: Implement Transformers.js (@xenova/transformers) with WebGPU here.
 * =========================================================================
 * 
 * Example Implementation Plan:
 * -----------------------------
 * 1. Import pipeline from Transformers.js:
 *    import { pipeline, env } from '@xenova/transformers';
 *    env.backends.onnx.wasm.numThreads = 4;
 * 
 * 2. Initialize face/object detection pipeline with WebGPU:
 *    const detector = await pipeline('object-detection', 'Xenova/yolos-tiny', {
 *      device: 'webgpu', // Uses WebGPU hardware acceleration
 *    });
 * 
 * 3. Run inference on the input image:
 *    const results = await detector(canvas);
 *    // Filter for labels like 'person', 'face', or proprietary sensitive objects
 *    const faceBoxes = results
 *      .filter(pred => pred.label === 'person' && pred.score > 0.6)
 *      .map(pred => ({
 *        x: pred.box.xmin,
 *        y: pred.box.ymin,
 *        width: pred.box.xmax - pred.box.xmin,
 *        height: pred.box.ymax - pred.box.ymin,
 *        label: 'FACE',
 *        confidence: pred.score
 *      }));
 *    return faceBoxes;
 * =========================================================================
 * 
 * @param {HTMLImageElement|HTMLCanvasElement} imageSource - The loaded image or canvas
 * @returns {Promise<Array<{x: number, y: number, width: number, height: number, label: string}>>}
 */
async function detectVisualPII(imageSource) {
  console.log('[Offscreen] detectVisualPII called for image size:', imageSource.width, 'x', imageSource.height);

  // Simulated WebGPU on-device inference latency
  await new Promise((resolve) => setTimeout(resolve, 80));

  // Placeholder: Return dummy visual PII bounding boxes (e.g. detected face or avatar area)
  const dummyVisualPII = [
    {
      x: 100,
      y: 100,
      width: 60,
      height: 60,
      label: 'FACE (ML Detected)',
      confidence: 0.95,
    },
  ];

  console.log('[Offscreen] detectVisualPII (Placeholder) returned:', dummyVisualPII);
  return dummyVisualPII;
}

// ==========================================
// Canvas Redaction Pipeline
// ==========================================
/**
 * Loads image, runs visual ML detection, draws black redaction rectangles over all sensitive coordinates,
 * and exports the sanitized base64 data URI.
 */
async function processAndRedactImage(imageBase64, domPiiBoxes = []) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = async () => {
      try {
        const canvas = document.getElementById('redaction-canvas') || document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to obtain 2D canvas rendering context.');
        }

        // 1. Draw original screenshot
        ctx.drawImage(img, 0, 0);

        // 2. Run on-device ML visual PII detection (Face detection)
        const visualPiiBoxes = await detectVisualPII(img);

        // 3. Combine DOM PII boxes with Visual ML PII boxes
        const allRedactionBoxes = [
          ...domPiiBoxes.map((b) => ({ ...b, source: 'DOM_PII', label: '🔒 REDACTED' })),
          ...visualPiiBoxes.map((b) => ({ ...b, source: 'VISUAL_ML', label: '🔒 FACE' })),
        ];

        console.log(`[Offscreen] Applying ${allRedactionBoxes.length} total redaction masks to canvas.`);

        // 4. Draw black redaction boxes over each sensitive region
        for (const box of allRedactionBoxes) {
          const drawX = Math.max(0, Math.round(box.x));
          const drawY = Math.max(0, Math.round(box.y));
          const drawW = Math.min(Math.round(box.width), canvas.width - drawX);
          const drawH = Math.min(Math.round(box.height), canvas.height - drawY);

          if (drawW <= 0 || drawH <= 0) continue;

          ctx.save();
          // Solid blackout mask
          ctx.fillStyle = '#000000';
          ctx.fillRect(drawX, drawY, drawW, drawH);

          // Redaction outline border
          ctx.strokeStyle = box.source === 'VISUAL_ML' ? '#ec4899' : '#6366f1';
          ctx.lineWidth = 2;
          ctx.strokeRect(drawX, drawY, drawW, drawH);

          // Draw privacy label badge if box is large enough
          if (drawW > 50 && drawH > 18) {
            ctx.font = 'bold 11px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(box.label || '🔒 REDACTED', drawX + drawW / 2, drawY + drawH / 2);
          }

          ctx.restore();
        }

        // 5. Export sanitized canvas to base64 PNG data URI
        const redactedDataUrl = canvas.toDataURL('image/png');

        resolve({
          success: true,
          redactedImage: redactedDataUrl,
          stats: {
            domPiiMasked: domPiiBoxes.length,
            visualPiiMasked: visualPiiBoxes.length,
            totalMasked: allRedactionBoxes.length,
          },
        });
      } catch (err) {
        console.error('[Offscreen] Error during canvas redaction:', err);
        reject(err);
      }
    };

    img.onerror = (err) => {
      console.error('[Offscreen] Failed to load screenshot image:', err);
      reject(new Error('Failed to load screenshot into Image object for canvas redaction.'));
    };

    img.src = imageBase64;
  });
}

// ==========================================
// Runtime Message Listener
// ==========================================
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'PROCESS_IMAGE') {
    const { imageBase64, piiBoxes = [] } = message;

    if (!imageBase64) {
      sendResponse({ success: false, error: 'No imageBase64 provided to offscreen process.' });
      return true;
    }

    processAndRedactImage(imageBase64, piiBoxes)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));

    return true; // Asynchronous response
  }
});
