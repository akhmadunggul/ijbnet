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

export async function savePhoto(
  candidateId: string,
  slot: PhotoSlot,
  inputBuffer: Buffer,
): Promise<{ filePath: string; urlPath: string }> {
  const safe = candidateId.replace(/[^a-zA-Z0-9-]/g, '');
  const dir = path.join(config.UPLOADS_DIR, 'candidates', safe);
  await fs.promises.mkdir(dir, { recursive: true });

  const filename = `${slot}.webp`;
  const filePath = path.join(dir, filename);

  // .rotate() strips EXIF and applies orientation correction
  let pipeline = sharp(inputBuffer).rotate();

  if (slot === 'closeup') {
    pipeline = pipeline.resize(800, 800, { fit: 'cover', position: 'centre' });
  } else {
    pipeline = pipeline.resize(null, 1920, { fit: 'inside', withoutEnlargement: true });
  }

  await pipeline.webp({ quality: 80 }).toFile(filePath);

  const urlPath = `/api/uploads/candidates/${safe}/${filename}`;
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
