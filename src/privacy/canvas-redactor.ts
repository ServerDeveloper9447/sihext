import { BoundingBox } from '../types';

export interface RedactionRegion {
  box: BoundingBox;
  label: string;
  redactionStyle: 'blackout' | 'blur';
}

export class CanvasRedactor {
  public static async redactScreenshot(
    dataUrl: string,
    regions: RedactionRegion[],
    viewport: { width: number; height: number }
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

          ctx.drawImage(img, 0, 0);
          const scaleX = canvas.width / viewport.width;
          const scaleY = canvas.height / viewport.height;

          for (const region of regions) {
            const { x, y, width, height } = region.box;
            const scaledX = x * scaleX;
            const scaledY = y * scaleY;
            const scaledRight = (x + width) * scaleX;
            const scaledBottom = (y + height) * scaleY;
            const drawX = Math.max(0, scaledX);
            const drawY = Math.max(0, scaledY);
            const drawW = Math.min(scaledRight, canvas.width) - drawX;
            const drawH = Math.min(scaledBottom, canvas.height) - drawY;
            if (drawW <= 0 || drawH <= 0) continue;

            ctx.save();
            if (region.redactionStyle === 'blur') {
              ctx.filter = 'blur(14px)';
              ctx.drawImage(canvas, drawX, drawY, drawW, drawH, drawX, drawY, drawW, drawH);
              ctx.filter = 'none';
            } else {
              ctx.fillStyle = '#090d16';
              ctx.fillRect(drawX, drawY, drawW, drawH);
            }
            ctx.strokeStyle = '#4f46e5';
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, drawY, drawW, drawH);

            ctx.font = 'bold 12px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (drawW > 50 && drawH > 16) {
              ctx.fillText(region.label, drawX + drawW / 2, drawY + drawH / 2);
            }
            ctx.restore();
          }

          resolve(canvas.toDataURL('image/jpeg', 0.88));
        } catch (err) {
          console.error('Error applying canvas redaction:', err);
          resolve(dataUrl);
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