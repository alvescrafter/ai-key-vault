// generate-icons.js — Generates PNG icons programmatically
// Run with: node generate-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sizes = [16, 48, 128];
const outputDir = path.join(__dirname, 'icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Simple icon drawing function (no external dependency needed)
function drawIcon(size) {
  // We'll create a simple PNG using raw pixel data
  // Since we can't use canvas without installing it, let's create a minimal valid PNG
  
  const width = size;
  const height = size;
  
  // Create a simple icon programmatically
  const pixels = [];
  const center = size / 2;
  const radius = size * 0.45;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      let r = 26, g = 26, b = 46, a = 255; // #1a1a2e background
      
      // Circle background
      if (dist <= radius) {
        r = 26; g = 26; b = 46;
        
        // Lock body (lower rectangle)
        const lockLeft = center - radius * 0.42;
        const lockRight = center + radius * 0.42;
        const lockTop = center + radius * 0.05;
        const lockBottom = center + radius * 0.65;
        
        if (x >= lockLeft && x <= lockRight && y >= lockTop && y <= lockBottom) {
          // Accent gradient (simplified)
          r = 67; g = 97; b = 238; // #4361ee
        }
        
        // Lock shackle (arc)
        const shackleRadius = radius * 0.35;
        const shackleCenterY = center - radius * 0.05;
        const shackleDist = Math.sqrt(dx * dx + (y - shackleCenterY) * (y - shackleCenterY));
        const shackleWidth = radius * 0.12;
        
        if (shackleDist >= shackleRadius - shackleWidth && shackleDist <= shackleRadius + shackleWidth) {
          if (y < lockTop && x > center - shackleRadius - shackleWidth && x < center + shackleRadius + shackleWidth) {
            r = 67; g = 97; b = 238; // #4361ee
          }
        }
        
        // Keyhole
        const keyholeDist = Math.sqrt(dx * dx + (y - (center + radius * 0.15)) * (y - (center + radius * 0.15)));
        if (keyholeDist <= radius * 0.1) {
          r = 26; g = 26; b = 46;
        }
        // Keyhole slot
        if (Math.abs(dx) <= radius * 0.05 && y >= center + radius * 0.15 && y <= center + radius * 0.35) {
          r = 26; g = 26; b = 46;
        }
      }
      
      // Anti-alias the circle edge
      if (dist > radius - 1 && dist < radius + 1) {
        const alpha = 1 - (dist - radius + 0.5);
        a = Math.round(alpha * 255);
      } else if (dist > radius + 1) {
        a = 0;
      }
      
      pixels.push(r, g, b, a);
    }
  }
  
  return { width, height, pixels };
}

// Create a minimal valid PNG file
function createPNG(width, height, pixels) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type (RGBA)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createChunk('IHDR', ihdrData);
  
  // IDAT chunk - image data
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    rawData[rowOffset] = 0; // filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const srcOffset = (y * width + x) * 4;
      rawData[pixelOffset] = pixels[srcOffset];
      rawData[pixelOffset + 1] = pixels[srcOffset + 1];
      rawData[pixelOffset + 2] = pixels[srcOffset + 2];
      rawData[pixelOffset + 3] = pixels[srcOffset + 3];
    }
  }
  
  // Compress with zlib (deflate)
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawData);
  const idat = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return crc ^ 0xFFFFFFFF;
}

// Generate all sizes
sizes.forEach(size => {
  const { width, height, pixels } = drawIcon(size);
  const png = createPNG(width, height, pixels);
  const outputPath = path.join(outputDir, `icon${size}.png`);
  fs.writeFileSync(outputPath, png);
  console.log(`Generated ${outputPath} (${png.length} bytes)`);
});

console.log('Done! Icons generated.');