const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function createIcon() {
  const buildDir = path.resolve(__dirname, '../build');
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
  }

  // Modern SVG with gradient, gold badge, and 'V' emblem
  const svg = `
  <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#064e3b" />
        <stop offset="50%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#022c22" />
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="50%" stop-color="#eab308" />
        <stop offset="100%" stop-color="#ca8a04" />
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.5"/>
      </filter>
    </defs>

    <!-- Background squircle -->
    <rect x="12" y="12" width="232" height="232" rx="54" fill="url(#bgGrad)" stroke="url(#goldGrad)" stroke-width="4" filter="url(#shadow)" />

    <!-- Inner subtle ring -->
    <circle cx="128" cy="128" r="88" fill="none" stroke="#10b981" stroke-width="2" stroke-opacity="0.3" stroke-dasharray="6,6" />

    <!-- 'V' Symbol styled with gold gradient -->
    <path d="M 64 74 L 110 186 C 114 196, 122 202, 128 202 C 134 202, 142 196, 146 186 L 192 74 L 164 74 L 128 166 L 92 74 Z" 
          fill="url(#goldGrad)" 
          filter="url(#shadow)" />

    <!-- Small Rupee Coin Insignia at center top -->
    <circle cx="128" cy="64" r="14" fill="#065f46" stroke="url(#goldGrad)" stroke-width="2"/>
    <text x="128" y="70" font-family="Arial, sans-serif" font-weight="bold" font-size="14" fill="#fef08a" text-anchor="middle">₹</text>
  </svg>
  `;

  const sizes = [256, 128, 64, 48, 32, 16];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer();
    pngBuffers.push({ size, buf });
  }

  // Save 256x256 PNG
  const png256 = pngBuffers.find(p => p.size === 256).buf;
  fs.writeFileSync(path.join(buildDir, 'icon.png'), png256);
  console.log('Created build/icon.png (256x256)');

  // Assemble Windows .ico container containing all resolutions
  // Header: 6 bytes
  // Dir entries: 16 bytes each
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // Reserved
  header.writeUInt16LE(1, 2);      // Image type: 1 = ICO
  header.writeUInt16LE(count, 4);  // Image count

  let currentOffset = 6 + (16 * count);
  const dirEntries = [];
  const imageBlocks = [];

  for (const item of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(item.size === 256 ? 0 : item.size, 0); // Width (0 for 256)
    entry.writeUInt8(item.size === 256 ? 0 : item.size, 1); // Height (0 for 256)
    entry.writeUInt8(0, 2);                                 // Color palette
    entry.writeUInt8(0, 3);                                 // Reserved
    entry.writeUInt16LE(1, 4);                              // Color planes
    entry.writeUInt16LE(32, 6);                             // Bits per pixel
    entry.writeUInt32LE(item.buf.length, 8);                // Image size
    entry.writeUInt32LE(currentOffset, 12);                 // Offset
    
    dirEntries.push(entry);
    imageBlocks.push(item.buf);
    currentOffset += item.buf.length;
  }

  const icoBuffer = Buffer.concat([header, ...dirEntries, ...imageBlocks]);
  fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);
  console.log(`Created build/icon.ico (${icoBuffer.length} bytes, containing ${count} resolutions: ${sizes.join(', ')})`);
}

createIcon().catch(console.error);
