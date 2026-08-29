// Simple script to generate valid PNG icon files without external native dependencies
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(size, primaryColor = [99, 102, 241], accentColor = [168, 85, 247]) {
  const width = size;
  const height = size;
  
  // Create RGBA buffer
  const rawData = Buffer.alloc(height * (1 + width * 4));
  
  const center = size / 2;
  const radius = size * 0.44;
  const innerRadius = size * 0.22;
  
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      let r = 0, g = 0, b = 0, a = 0;
      
      if (dist <= radius) {
        // Gradient factor
        const t = (x + y) / (width + height);
        r = Math.round(primaryColor[0] * (1 - t) + accentColor[0] * t);
        g = Math.round(primaryColor[1] * (1 - t) + accentColor[1] * t);
        b = Math.round(primaryColor[2] * (1 - t) + accentColor[2] * t);
        
        // Edge antialiasing
        if (dist > radius - 1) {
          a = Math.round(255 * (radius - dist));
        } else {
          a = 255;
        }
        
        // Inner core (glowing eye / lens)
        if (dist <= innerRadius) {
          const coreT = 1 - (dist / innerRadius);
          r = Math.min(255, Math.round(r + 120 * coreT));
          g = Math.min(255, Math.round(g + 120 * coreT));
          b = Math.min(255, Math.round(b + 150 * coreT));
        }
      }
      
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  // Deflate rawData
  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // Bit depth
  ihdr.writeUInt8(6, 9); // ColorType 6 (RGBA)
  ihdr.writeUInt8(0, 10); // Compression
  ihdr.writeUInt8(0, 11); // Filter
  ihdr.writeUInt8(0, 12); // Interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  
  const crcData = chunk.subarray(4, 8 + len);
  const crc = calculateCRC(crcData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 implementation
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function calculateCRC(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  const pngBuf = createPNG(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), pngBuf);
  console.log(`Generated icon-${size}.png`);
});
