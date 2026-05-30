import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { config } from '../config';

export type PhotoSlot = 'closeup' | 'fullbody';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// Inline magic-byte detection — avoids ESM/CJS incompatibility with file-type v19
function detectMimeType(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  // WebP: RIFF at 0..3, WEBP at 8..11
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return 'image/webp';
  return null;
}

export function validateImageBuffer(buffer: Buffer): void {
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error('File exceeds 5 MB limit.');
  }
  if (!detectMimeType(buffer)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
  }
}


const IMAGE_PROCESSOR_URL = process.env.IMAGE_PROCESSOR_URL ?? 'http://image-processor:8000';

async function removeBackground(
  inputBuffer: Buffer,
  slot: PhotoSlot,
  bgColor: string,
): Promise<Buffer> {
  const form = new FormData();
  form.append('slot', slot);
  form.append('bg_color', bgColor);
  form.append('file', new Blob([inputBuffer], { type: 'image/png' }), 'image.png');

  const response = await fetch(`${IMAGE_PROCESSOR_URL}/process`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`image-processor returned ${response.status}: ${text}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function savePhoto(
  candidateId: string,
  slot: PhotoSlot,
  inputBuffer: Buffer,
  bgColor?: string,
): Promise<{ filePath: string; urlPath: string }> {
  const safe = candidateId.replace(/[^a-zA-Z0-9-]/g, '');
  const dir = path.join(config.UPLOADS_DIR, 'candidates', safe);
  await fs.promises.mkdir(dir, { recursive: true });

  const filename = `${slot}.webp`;
  const filePath = path.join(dir, filename);

  // EXIF strip only — Python script handles crop, resize, bg removal, and composite.
  const workBuffer = await sharp(inputBuffer)
    .rotate()
    .png()
    .toBuffer();

  if (bgColor) {
    const processed = await removeBackground(workBuffer, slot, bgColor);
    await sharp(processed).webp({ quality: 80 }).toFile(filePath);
  } else {
    let pipeline = sharp(workBuffer);
    if (slot === 'closeup') {
      const meta = await sharp(workBuffer).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      const isSquare = w > 0 && h > 0 && Math.abs(w - h) / Math.max(w, h) <= 0.15;
      // Already square: plain resize preserves the original framing.
      // Non-square: center-crop to square then resize (existing behaviour).
      pipeline = isSquare
        ? pipeline.resize(800, 800, { fit: 'fill' })
        : pipeline.resize(800, 800, { fit: 'cover', position: 'centre' });
    } else {
      pipeline = pipeline.resize(null, 1920, { fit: 'inside', withoutEnlargement: true });
    }
    await pipeline.webp({ quality: 80 }).toFile(filePath);
  }

  const urlPath = `/api/uploads/candidates/${safe}/${filename}?t=${Date.now()}`;
  return { filePath, urlPath };
}

export async function deletePhoto(urlPath: string): Promise<void> {
  if (!urlPath) return;
  const relative = urlPath.replace('/api/uploads/', '');
  const filePath = path.join(config.UPLOADS_DIR, relative);
  await fs.promises.rm(filePath, { force: true });
}

export async function deleteCandidatePhotos(candidateId: string): Promise<void> {
  const safe = candidateId.replace(/[^a-zA-Z0-9-]/g, '');
  const dir = path.join(config.UPLOADS_DIR, 'candidates', safe);
  await fs.promises.rm(dir, { recursive: true, force: true });
}
