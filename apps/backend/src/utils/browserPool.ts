import puppeteer from 'puppeteer-core';
import { resolveChromePath } from './candidatePdf';

const MAX_CONCURRENT  = 3;       // max parallel Chromium processes
const QUEUE_TIMEOUT   = 45_000;  // ms a request may wait for a free slot

// ── Semaphore ─────────────────────────────────────────────────────────────────

class Semaphore {
  private available: number;
  private readonly waiters: Array<{ resolve: () => void; timer: ReturnType<typeof setTimeout> }> = [];

  constructor(max: number) { this.available = max; }

  acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const i = this.waiters.findIndex(w => w.resolve === resolve);
        if (i !== -1) this.waiters.splice(i, 1);
        reject(Object.assign(new Error('PDF_QUEUE_TIMEOUT'), { code: 'PDF_QUEUE_TIMEOUT' as const }));
      }, QUEUE_TIMEOUT);
      this.waiters.push({ resolve, timer });
    });
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve();
    } else {
      this.available++;
    }
  }

  get queueDepth(): number { return this.waiters.length; }
  get activeCount(): number { return MAX_CONCURRENT - this.available; }
}

const pool = new Semaphore(MAX_CONCURRENT);

// ── Public API ────────────────────────────────────────────────────────────────

export interface PdfMargins {
  top: string; bottom: string; left: string; right: string;
}

/**
 * Render an HTML string to an A4 PDF Buffer.
 *
 * - At most MAX_CONCURRENT Chromium processes run in parallel.
 * - Excess requests queue; if a slot does not free within QUEUE_TIMEOUT ms
 *   the promise rejects with { code: 'PDF_QUEUE_TIMEOUT' }.
 * - Rejects with { code: 'CHROME_NOT_FOUND' } if Chromium is absent.
 *
 * Usage in a route:
 *   import { renderPdf, isPdfError } from '../utils/browserPool';
 *   try { const buf = await renderPdf(html, margins); }
 *   catch (err) {
 *     if (isPdfError(err, 'PDF_QUEUE_TIMEOUT')) res.status(503).json({ error: 'PDF_BUSY' });
 *     else if (isPdfError(err, 'CHROME_NOT_FOUND')) res.status(503).json({ error: 'PDF_UNAVAILABLE' });
 *     else throw err;
 *   }
 */
export async function renderPdf(html: string, margins: PdfMargins): Promise<Buffer> {
  const executablePath = resolveChromePath();
  if (!executablePath) {
    throw Object.assign(new Error('Chromium not found on host'), { code: 'CHROME_NOT_FOUND' as const });
  }

  await pool.acquire();

  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: margins });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
    pool.release();
  }
}

/** Type-safe check for errors thrown by renderPdf. */
export function isPdfError(err: unknown, code: 'CHROME_NOT_FOUND' | 'PDF_QUEUE_TIMEOUT'): boolean {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === code;
}

/** Current pool state — useful for health endpoints. */
export function poolStats(): { active: number; queued: number; max: number } {
  return { active: pool.activeCount, queued: pool.queueDepth, max: MAX_CONCURRENT };
}
