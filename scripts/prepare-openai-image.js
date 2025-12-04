const fs = require('fs');
const path = require('path');

const ALLOWED_EXTS = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function detectMime(buffer, ext) {
  const header = buffer.subarray(0, 12);

  if (header.compare(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) === 0) {
    return 'image/png';
  }

  if (header[0] === 0xff && header[1] === 0xd8) {
    return 'image/jpeg';
  }

  if (
    header.slice(0, 6).compare(Buffer.from('GIF87a')) === 0 ||
    header.slice(0, 6).compare(Buffer.from('GIF89a')) === 0
  ) {
    return 'image/gif';
  }

  if (
    header.slice(0, 4).compare(Buffer.from('RIFF')) === 0 &&
    header.slice(8, 12).compare(Buffer.from('WEBP')) === 0
  ) {
    return 'image/webp';
  }

  // Fall back to extension if the signature is missing but the extension is known.
  return ALLOWED_EXTS[ext] || null;
}

function validateImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (!ALLOWED_EXTS[ext]) {
    throw new Error(
      `Unsupported file type "${ext || '<none>'}". Allowed: ${Object.keys(ALLOWED_EXTS).join(', ')}`
    );
  }

  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }

  if (stats.size === 0) {
    throw new Error(`Image is empty: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  const mime = detectMime(buffer, ext);

  if (!mime || mime !== ALLOWED_EXTS[ext]) {
    throw new Error(
      `Invalid image signature for ${filePath}. Ensure the file is a real ${ALLOWED_EXTS[ext]} and not UTF-16/text encoded.`
    );
  }

  return { buffer, mime, size: stats.size };
}

function buildDataUrl(filePath) {
  const { buffer, mime, size } = validateImage(filePath);
  const base64 = buffer.toString('base64');

  // OpenAI vision endpoints expect a data URL with the mime prefix.
  // Passing a raw Buffer, file path string, or base64 without `data:<mime>;base64,` will trigger "image data ... not valid".
  const imageUrl = `data:${mime};base64,${base64}`;

  return { imageUrl, mime, size };
}

function main() {
  const filePath = process.argv[2] || 'docs/mobile-screenshot.png';

  try {
    const { imageUrl, mime, size } = buildDataUrl(filePath);
    console.log('Prepared image for OpenAI', {
      path: path.resolve(filePath),
      size,
      mime,
    });
    console.log('image_url preview', `${imageUrl.slice(0, 80)}...`);
  } catch (err) {
    console.error('Failed to prepare image for OpenAI:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { buildDataUrl };
