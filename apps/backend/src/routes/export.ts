import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { renderPdf, isPdfError } from '../utils/browserPool';
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
  CandidateJapaneseTest,
  CandidateCareer,
  CandidateCertification,
  CandidateEducationHistory,
} from '../db/models/index';
import { serializeCandidate } from '../serializers/candidate';
import { AuditLog, GlobalSettings } from '../db/models/index';
import { decryptNullable } from '../utils/crypto';
import { calcCompleteness } from '../utils/completeness';
import { buildCandidatePdfHtml } from '../utils/candidatePdf';
import { buildCandidateCvHtml } from '../utils/candidateCvHtml';
import path from 'path';
import fs from 'fs';
import { config } from '../config';


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

// ── POST /api/export/candidates/batch-cv.pdf ─────────────────────────────────
router.post('/candidates/batch-cv.pdf', wrap(async (req, res) => {
  const { candidateIds } = req.body as { candidateIds?: unknown };

  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    res.status(400).json({ error: 'INVALID_IDS', message: 'candidateIds must be a non-empty array.' });
    return;
  }
  if (candidateIds.length > 50) {
    res.status(400).json({ error: 'TOO_MANY', message: 'Maximum 50 candidates per batch.' });
    return;
  }
  if (!(candidateIds as unknown[]).every((id) => typeof id === 'string' && isUUID(id, 4))) {
    res.status(422).json({ error: 'INVALID_ID_FORMAT' });
    return;
  }

  const candidates = await Candidate.findAll({
    where: { id: candidateIds as string[] },
    include: [
      { model: User,                      as: 'user',             attributes: ['name', 'email'] },
      { model: Lpk,                       as: 'lpk',              attributes: ['name', 'city']  },
      { model: CandidateJapaneseTest,     as: 'tests'             },
      { model: CandidateCareer,           as: 'career',           separate: true, order: [['startDate', 'ASC'] as [string, string]] },
      { model: CandidateBodyCheck,        as: 'bodyCheck'         },
      { model: CandidateCertification,    as: 'certifications'    },
      { model: CandidateEducationHistory, as: 'educationHistory', separate: true, order: [['startDate', 'ASC'] as [string, string]] },
    ],
  });

  if (candidates.length === 0) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  // Fetch layout + font settings once for the whole batch
  const [layoutRow, fontRow] = await Promise.all([
    GlobalSettings.findOne({ where: { key: 'cv_layout' } }),
    GlobalSettings.findOne({ where: { key: 'cv_font'   } }),
  ]);
  const cvLayout = layoutRow ? String((layoutRow.toJSON() as unknown as Record<string, unknown>)['value'] ?? 'layout1') : 'layout1';
  const cvFont   = fontRow   ? String((fontRow.toJSON()   as unknown as Record<string, unknown>)['value'] ?? 'ms-mincho') : 'ms-mincho';

  // Build one HTML per candidate then concatenate with page breaks
  const pages = await Promise.all(candidates.map(async (candidate) => {
    const cj = candidate.toJSON() as unknown as Record<string, unknown>;

    // Embed closeup photo as base64
    let photoBase64: string | null = null;
    try {
      const photoPath = path.join(config.UPLOADS_DIR, 'candidates', candidate.id, 'closeup.webp');
      const photoData = await fs.promises.readFile(photoPath);
      photoBase64 = `data:image/webp;base64,${photoData.toString('base64')}`;
    } catch { /* no photo */ }

    return buildCandidateCvHtml(cj, { font: cvFont, layout: cvLayout, photoBase64 });
  }));

  const mergedHtml = pages.reduce((acc, html, i) => {
    if (i === 0) return html.replace(/<\/body>\s*<\/html>\s*$/i, '');
    const bodyContent = html
      .replace(/^[\s\S]*?<body[^>]*>/i, '')
      .replace(/<\/body>[\s\S]*$/i, '');
    return acc + '\n<div style="page-break-before:always"></div>\n' + bodyContent;
  }, '') + '\n</body></html>';

  try {
    const pdf = await renderPdf(mergedHtml, { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' });

    await Promise.all(candidates.map((candidate) =>
      AuditLog.create({
        userId: req.user!.sub,
        action: 'export_candidate_pdf',
        entityType: 'candidate',
        entityId: candidate.id,
        targetCandidateId: candidate.id,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
        payload: { batch: true, total: candidates.length },
      }),
    ));

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="batch-cv-${timestamp}.pdf"`);
    res.send(pdf);
  } catch (err) {
    if (isPdfError(err, 'CHROME_NOT_FOUND'))  { res.status(503).json({ error: 'PDF_UNAVAILABLE' }); return; }
    if (isPdfError(err, 'PDF_QUEUE_TIMEOUT')) { res.status(503).json({ error: 'PDF_BUSY', message: 'PDF service is busy. Please try again.' }); return; }
    throw err;
  }
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
      { model: User,                      as: 'user',             attributes: ['name', 'email'] },
      { model: Lpk,                       as: 'lpk',              attributes: ['name', 'city']  },
      { model: CandidateJapaneseTest,     as: 'tests'             },
      { model: CandidateCareer,           as: 'career',           separate: true, order: [['startDate', 'ASC'] as [string, string]] },
      { model: CandidateBodyCheck,        as: 'bodyCheck'         },
      { model: CandidateCertification,    as: 'certifications'    },
      { model: CandidateEducationHistory, as: 'educationHistory', separate: true, order: [['startDate', 'ASC'] as [string, string]] },
    ],
  });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  const cj  = candidate.toJSON() as unknown as Record<string, unknown>;
  const nik = decryptNullable(candidate.nikEncrypted ?? null);
  const html = buildCandidatePdfHtml(cj, nik);

  try {
    const pdf = await renderPdf(html, { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' });

    await AuditLog.create({
      userId: req.user!.sub,
      action: 'export_candidate_pdf',
      entityType: 'candidate',
      entityId: id,
      targetCandidateId: id,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      payload: null,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${candidate.candidateCode}-profile.pdf"`);
    res.send(pdf);
  } catch (err) {
    if (isPdfError(err, 'CHROME_NOT_FOUND')) { res.status(503).json({ error: 'PDF_UNAVAILABLE' }); return; }
    if (isPdfError(err, 'PDF_QUEUE_TIMEOUT')) { res.status(503).json({ error: 'PDF_BUSY', message: 'PDF service is busy. Please try again shortly.' }); return; }
    throw err;
  }
}));

export default router;
