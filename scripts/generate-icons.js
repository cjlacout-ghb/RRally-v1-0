import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function createSvg(size) {
  const fontSize = Math.round(size * 0.48);
  const y = Math.round(size * 0.64);
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#0a122a"/>
    <text x="${size / 2}" y="${y}" font-family="Space Mono, monospace, sans-serif" font-weight="700" font-size="${fontSize}" fill="#b8c4ff" text-anchor="middle" letter-spacing="-0.02em">RR</text>
  </svg>`;
}

async function generate() {
  const targets = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'favicon.png', size: 64 }
  ];

  for (const target of targets) {
    const svg = createSvg(target.size);
    const dest = path.join(publicDir, target.name);
    await sharp(Buffer.from(svg)).png().toFile(dest);
    console.log(`Generated ${target.name} (${target.size}x${target.size})`);
  }
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
