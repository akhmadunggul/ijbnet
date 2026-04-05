import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { config } from '../config';

export type PhotoSlot = 'closeup' | 'fullbody';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export async function validateImageBuffer(buffer: Buffer): Promise<void> {
  if (buffer.length > MAX_SIZE_BYTES) {
    throw new Error('File exceeds 5 MB limit.');
  }

  // Magic-byte check using file-type (ESM v19 — dynamic import required)
  const { fileTypeFromBuffer } = await import('file-type');
  const result = await fileTypeFromBuffer(buffer);
  if (!result || !ALLOWED_MIME_TYPES.has(result.mime)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.');
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
