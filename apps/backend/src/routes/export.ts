import { Router, Request, Response } from 'express';
import fs from 'fs';
import ExcelJS from 'exceljs';
import puppeteer from 'puppeteer-core';
import { isUUID } from 'validator';
import { authenticate, requireRole } from '../middleware/auth';
import {
  sequelize,
  Candidate,
  Batch,
  BatchCandidate,
  User,
  Lpk,
  Company,
  CandidateBodyCheck,
} from '../db/models/index';
import { serializeCandidate } from '../serializers/candidate';
import { AuditLog } from '../db/models/index';
import { decryptNullable } from '../utils/crypto';
import { calcCompleteness } from '../utils/completeness';

function resolveChromePath(): string | null {
  if (process.env['CHROME_PATH']) return process.env['CHROME_PATH'];
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          `${process.env['LOCALAPPDATA'] ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
        ]
      : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : [
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
        ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    fn(req, res).catch(next);
  };
}

const router = Router();
router.use(authenticate, requireRole('super_admin', 'manager'));

const HEADER_COLOR = '1E3A5F';

function styleHeader(ws: ExcelJS.Worksheet, cols: { header: string; key: string; width: number }[]) {
  ws.columns = cols;
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + HEADER_COLOR } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle' };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

const STATUS_COLORS: Record<string, string> = {
  incomplete:     'FFFCE4D6',
  submitted:      'FFDEEBF7',
  under_review:   'FFFFF2CC',
  approved:       'FFE2EFDA',
  rejected:       'FFFFCCCC',
  placed:         'FFD9D9D9',
};

// ── GET /api/export/candidates.xlsx ──────────────────────────────────────────
router.get('/candidates.xlsx', wrap(async (req, res) => {
  const { lpkId, status } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (lpkId && isUUID(lpkId)) where['lpkId'] = lpkId;
  if (status) where['profileStatus'] = status;

  const candidates = await Candidate.findAll({
    where,
    include: [
      { model: User, as: 'user', attributes: ['name', 'email'] },
      { model: Lpk, as: 'lpk', attributes: ['name'] },
      { model: CandidateBodyCheck, as: 'bodyCheck' },
    ],
    order: [['createdAt', 'ASC']],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IJBNet';
  wb.created = new Date();

  const ws = wb.addWorksheet('Candidates');
  styleHeader(ws, [
    { header: 'Code', key: 'code', width: 14 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Gender', key: 'gender', width: 8 },
    { header: 'LPK', key: 'lpk', width: 22 },
    { header: 'SSW Field', key: 'sswField', width: 18 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Completeness', key: 'completeness', width: 14 },
    { header: 'Consent', key: 'consent', width: 10 },
    { header: 'Created At', key: 'createdAt', width: 20 },
  ]);

  for (const c of candidates) {
    const j = c.toJSON() as unknown as Record<string, unknown>;
    const user = j['user'] as Record<string, string> | null;
    const lpk = j['lpk'] as Record<string, string> | null;
    const row = ws.addRow({
      code: c.candidateCode,
      name: user?.['name'] ?? '',
      email: user?.['email'] ?? '',
      gender: c.gender,
      lpk: lpk?.['name'] ?? '',
      sswField: c.sswFieldId ?? c.sswFieldJa ?? '',
      status: c.profileStatus,
      completeness: calcCompleteness(j).pct,
      consent: c.consentGiven ? 'Yes' : 'No',
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : '',
    });
    const fillColor = STATUS_COLORS[c.profileStatus ?? ''] ?? 'FFFFFFFF';
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } };
    });
  }

  // Audit
  await AuditLog.create({
    userId: req.user!.sub,
    action: 'export_candidates_excel',
    entityType: 'candidate',
    ipAddress: req.ip ?? null,
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="candidates.xlsx"');
  await wb.xlsx.write(res);
  res.end();
}));

// ── GET /api/export/batch/:batchId.xlsx ──────────────────────────────────────
router.get('/batch/:batchId.xlsx', wrap(async (req, res) => {
  const batchId = req.params['batchId'];
  if (!batchId || !isUUID(batchId)) {
    res.status(400).json({ error: 'INVALID_PARAM', message: 'Invalid batchId.' });
    return;
  }

  const batch = await Batch.findByPk(batchId, {
    include: [{ model: Company, as: 'company', attributes: ['name'] }],
  });
  if (!batch) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const allocations = await BatchCandidate.findAll({
    where: { batchId },
    include: [
      {
        model: Candidate,
        as: 'candidate',
        include: [
          { model: User, as: 'user', attributes: ['name', 'email'] },
          { model: Lpk, as: 'lpk', attributes: ['name'] },
        ],
      },
    ],
    order: [['createdAt', 'ASC']],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IJBNet';
  wb.created = new Date();

  const batchJ = batch.toJSON() as unknown as Record<string, unknown>;
  const companyName = (batchJ['company'] as Record<string, string> | null)?.['name'] ?? '';
  const ws = wb.addWorksheet(`Batch ${batch.batchCode}`);

  // Info rows
  ws.addRow(['Batch Code', batch.batchCode]);
  ws.addRow(['Company', companyName]);
  ws.addRow(['SSW Field', batch.sswFieldFilter ?? '']);
  ws.addRow(['Quota', batch.quotaTotal]);
  ws.addRow(['Status', batch.status]);
  ws.addRow([]);

  styleHeader(ws, [
    { header: 'Code', key: 'code', width: 14 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'LPK', key: 'lpk', width: 22 },
    { header: 'Gender', key: 'gender', width: 8 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Interview Status', key: 'interviewStatus', width: 18 },
    { header: 'Selected At', key: 'selectedAt', width: 20 },
  ]);

  for (const alloc of allocations) {
    const aj = alloc.toJSON() as unknown as Record<string, unknown>;
    const cand = aj['candidate'] as Record<string, unknown> | null;
    const candUser = cand?.['user'] as Record<string, string> | null;
    const candLpk = cand?.['lpk'] as Record<string, string> | null;
    const proposal = aj['proposal'] as Record<string, unknown> | null;
    ws.addRow({
      code: cand?.['candidateCode'] ?? '',
      name: candUser?.['name'] ?? '',
      lpk: candLpk?.['name'] ?? '',
      gender: cand?.['gender'] ?? '',
      status: cand?.['profileStatus'] ?? '',
      interviewStatus: proposal?.['status'] ?? 'none',
      selectedAt: alloc.createdAt ? new Date(alloc.createdAt).toISOString() : '',
    });
  }

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'export_batch_excel',
    entityType: 'batch',
    entityId: batchId,
    ipAddress: req.ip ?? null,
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  const safeBatchCode = (batch.batchCode ?? 'batch').replace(/[^a-zA-Z0-9\-_]/g, '_');
  res.setHeader('Content-Disposition', `attachment; filename="batch-${safeBatchCode}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

// ── GET /api/export/candidates/:id/profile.pdf ────────────────────────────────
router.get('/candidates/:id/profile.pdf', wrap(async (req, res) => {
  const { id } = req.params;
  if (!id || !isUUID(id)) {
    res.status(400).json({ error: 'INVALID_PARAM', message: 'Invalid candidate id.' });
    return;
  }

  const candidate = await Candidate.findByPk(id, {
    include: [
      { model: User, as: 'user', attributes: ['name', 'email'] },
      { model: Lpk, as: 'lpk', attributes: ['name'] },
      { model: CandidateBodyCheck, as: 'bodyCheck' },
    ],
  });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const cj = candidate.toJSON() as unknown as Record<string, unknown>;
  const user = cj['user'] as Record<string, string> | null;
  const lpk = cj['lpk'] as Record<string, string> | null;
  const bodyCheck = cj['bodyCheck'] as Record<string, unknown> | null;

  const nik = decryptNullable(candidate.nikEncrypted ?? null);

  const he = (v: unknown): string =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <style>
    * { font-family: 'Helvetica Neue', Arial, sans-serif; box-sizing: border-box; }
    body { margin: 0; padding: 32px; color: #1a1a1a; }
    h1 { color: #1E3A5F; font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 13px; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: bold; background: #1E3A5F; color: #fff; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #1E3A5F; color: #fff; text-align: left; padding: 8px 12px; font-size: 12px; }
    td { padding: 7px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
    tr:nth-child(even) td { background: #f8f9fb; }
    .section { font-size: 14px; font-weight: bold; color: #1E3A5F; margin: 20px 0 8px; }
    .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <h1>${he(user?.['name'] ?? 'Candidate Profile')}</h1>
  <div class="subtitle">${he(candidate.candidateCode)} &nbsp;•&nbsp; ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  <span class="badge">${he(candidate.profileStatus)}</span>

  <div class="section">Informasi Pribadi</div>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Email</td><td>${he(user?.['email'])}</td></tr>
    <tr><td>NIK</td><td>${he(nik)}</td></tr>
    <tr><td>Gender</td><td>${candidate.gender === 'M' ? 'Laki-laki' : 'Perempuan'}</td></tr>
    <tr><td>Tanggal Lahir</td><td>${he(candidate.dateOfBirth)}</td></tr>
    <tr><td>LPK</td><td>${he(lpk?.['name'])}</td></tr>
    <tr><td>SSW Field</td><td>${he(candidate.sswFieldId ?? candidate.sswFieldJa)}</td></tr>
    <tr><td>Completeness</td><td>${calcCompleteness(cj).pct}%</td></tr>
  </table>

  ${bodyCheck ? `
  <div class="section">Body Check</div>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Tinggi Badan</td><td>${he(bodyCheck['height'])} cm</td></tr>
    <tr><td>Berat Badan</td><td>${he(bodyCheck['weight'])} kg</td></tr>
    <tr><td>Golongan Darah</td><td>${he(bodyCheck['bloodType'])}</td></tr>
    <tr><td>Tekanan Darah</td><td>${he(bodyCheck['bloodPressure'])}</td></tr>
  </table>
  ` : ''}

  <div class="footer">Generated by IJBNet &bull; ${new Date().toISOString()}</div>
</body>
</html>`;

  const executablePath = resolveChromePath();
  if (!executablePath) {
    res.status(503).json({ error: 'PDF_UNAVAILABLE', message: 'Chrome not found. Set CHROME_PATH in environment.' });
    return;
  }
  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '10mm', bottom: '10mm', left: '12mm', right: '12mm' } });

    await AuditLog.create({
      userId: req.user!.sub,
      action: 'export_candidate_pdf',
      entityType: 'candidate',
      entityId: id,
      targetCandidateId: id,
      ipAddress: req.ip ?? null,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${candidate.candidateCode}-profile.pdf"`);
    res.send(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
}));

export default router;
