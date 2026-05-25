import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1]!, 16), g: parseInt(m[2]!, 16), b: parseInt(m[3]!, 16) }
    : { r: 255, g: 255, b: 255 };
}

async function removeBackground(inputBuffer: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn('/opt/rembg-venv/bin/rembg', ['i', '-m', 'u2netp', '-', '-']);
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (d: Buffer) => console.error('[rembg]', d.toString().trim()));
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`rembg exited with code ${code}`));
      else resolve(Buffer.concat(chunks));
    });
    proc.on('error', reject);
    proc.stdin.write(inputBuffer);
    proc.stdin.end();
  });
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

  // EXIF strip + orientation correction.
  // Flatten any pre-existing alpha to white so rembg always receives a clean RGB PNG.
  // (Uploading a transparent PNG would otherwise send RGBA to rembg which produces
  // undefined behaviour and can cause the transparent regions to composite incorrectly.)
  let workBuffer = await sharp(inputBuffer)
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  if (bgColor) {
    // Resize to final output dimensions BEFORE rembg.
    // u2netp runs inference at 320×320 internally then upscales the alpha mask back to
    // the input size.  Feeding a full 4K phone photo means a 12× mask upscale, which
    // creates wide semi-opaque boundary fringes that keep their original colour
    // (red/pink from warm studio lighting) after flatten.  Pre-resizing caps the upscale
    // at ~2.5× (320 → 800) and eliminates those coloured-fringe artefacts.
    const forRembg = slot === 'closeup'
      ? await sharp(workBuffer).resize(800, 800, { fit: 'cover', position: 'centre' }).png().toBuffer()
      : await sharp(workBuffer).resize(null, 1920, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();

    const noBg = await removeBackground(forRembg);

    // Remove the hairline colour fringe around the subject.  rembg keeps the original
    // photo RGB values for all pixels — boundary pixels are a physical blend of subject
    // and original background.  threshold(230) retains only pixels where rembg had
    // ≥90% foreground confidence; those have ≤10% background colour contamination,
    // imperceptible on a white fill.  Everything below 230 is cut to fully transparent.
    const { width: rw, height: rh } = await sharp(noBg).metadata();
    const cleanAlpha = await sharp(noBg)
      .extractChannel('alpha')
      .threshold(230)
      .raw()
      .toBuffer();
    const cleanNoBg = await sharp(noBg)
      .removeAlpha()
      .joinChannel(cleanAlpha, { raw: { width: rw!, height: rh!, channels: 1 } })
      .png()
      .toBuffer();

    workBuffer = await sharp(cleanNoBg)
      .flatten({ background: hexToRgb(bgColor) })
      .png()
      .toBuffer();

    // No further resize needed — image is already at target dimensions.
    await sharp(workBuffer).webp({ quality: 80 }).toFile(filePath);
  } else {
    let pipeline = sharp(workBuffer);
    if (slot === 'closeup') {
      pipeline = pipeline.resize(800, 800, { fit: 'cover', position: 'centre' });
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
