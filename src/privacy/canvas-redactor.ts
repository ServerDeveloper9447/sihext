import { BoundingBox } from '../types';

export interface RedactionRegion {
  box: BoundingBox;
  label?: string;
  type?: 'password' | 'face' | 'pii' | 'custom';
}

export class CanvasRedactor {
  /**
   * Redacts sensitive bounding boxes from a screenshot data URL.
   * Returns a sanitized base64 data URL.
   */
  public static async redactScreenshot(
    dataUrl: string,
    regions: RedactionRegion[]
  ): Promise<string> {
    if (!regions || regions.length === 0) {
      return dataUrl;
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          // 1. Draw original screenshot
          ctx.drawImage(img, 0, 0);

          // 2. Draw redactions over each sensitive region
          for (const region of regions) {
            const { x, y, width, height } = region.box;
            
            // Boundary validation
            const drawX = Math.max(0, x);
            const drawY = Math.max(0, y);
            const drawW = Math.min(width, canvas.width - drawX);
            const drawH = Math.min(height, canvas.height - drawY);

            if (drawW <= 0 || drawH <= 0) continue;

            // Draw solid privacy blackout box with subtle rounded corners
            ctx.save();
            ctx.fillStyle = '#090d16'; // Deep dark privacy mask
            ctx.strokeStyle = '#4f46e5'; // Brand border
            ctx.lineWidth = 2;

            ctx.fillRect(drawX, drawY, drawW, drawH);
            ctx.strokeRect(drawX, drawY, drawW, drawH);

            // Draw Privacy label badge
            const labelText = region.label || (region.type === 'face' ? '🔒 FACE MASKED' : '🔒 REDACTED');
            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = '#818cf8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (drawW > 70 && drawH > 20) {
              ctx.fillText(labelText, drawX + drawW / 2, drawY + drawH / 2);
            }
            ctx.restore();
          }

          resolve(canvas.toDataURL('image/jpeg', 0.88));
        } catch (err) {
          console.error('Error applying canvas redaction:', err);
          resolve(dataUrl); // Fallback
        }
      };

      img.onerror = (err) => {
        console.error('Failed to load image for redaction:', err);
        reject(err);
      };

      img.src = dataUrl;
    });
  }
}
