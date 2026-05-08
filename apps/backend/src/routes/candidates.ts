import { Router, Request, Response } from 'express';
import fs from 'fs';
import multer from 'multer';
import puppeteer from 'puppeteer-core';
import { authenticate, requireRole } from '../middleware/auth';
import { decryptNullable } from '../utils/crypto';
import {
  Candidate,
  CandidateJapaneseTest,
  CandidateCareer,
  CandidateBodyCheck,
  CandidateWeeklyTest,
  CandidateIntroVideo,
  CandidateCertification,
  CandidateEducationHistory,
  ToolsDictionary,
  AuditLog,
  Notification,
  User,
  Lpk,
  SswSectorField,
  ConsentClause,
} from '../db/models/index';
import { serializeCandidate } from '../serializers/candidate';
import { calcCompleteness } from '../utils/completeness';
import { validateImageBuffer, savePhoto } from '../utils/storage';
import type { PhotoSlot } from '../utils/storage';
import { encrypt } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── GET /api/candidates/ssw-options — SSW sector/field lookup (all auth roles) ─
router.get('/ssw-options', authenticate, async (_req: Request, res: Response): Promise<void> => {
  const rows = await SswSectorField.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC']],
    attributes: ['id', 'kubun', 'sectorId', 'sectorJa', 'fieldId', 'fieldJa', 'sortOrder'],
  });
  res.json(rows.map((r) => r.toJSON()));
});

// ── GET /api/candidates/lpks — public list for onboarding dropdown ────────────
router.get('/lpks', authenticate, requireRole('candidate'), async (_req: Request, res: Response): Promise<void> => {
  const lpks = await Lpk.findAll({
    where: { isActive: true },
    attributes: ['id', 'name', 'city'],
    order: [['name', 'ASC']],
  });
  res.json({ lpks: lpks.map((l) => l.toJSON()) });
});

// All candidate routes require auth + candidate role
router.use(authenticate, requireRole('candidate'));

// ── Helper: find candidate by userId ─────────────────────────────────────────
async function findMyCandidate(userId: string) {
  return Candidate.findOne({
    where: { userId },
    include: [
      { model: CandidateJapaneseTest, as: 'tests', required: false },
      { model: CandidateCareer, as: 'career', required: false },
      { model: CandidateBodyCheck, as: 'bodyCheck', required: false },
      { model: CandidateWeeklyTest, as: 'weeklyTests', required: false },
      { model: CandidateIntroVideo, as: 'videos', required: false },
      { model: ToolsDictionary, as: 'tools', required: false },
      { model: CandidateCertification, as: 'certifications', required: false },
      { model: CandidateEducationHistory, as: 'educationHistory', required: false },
    ],
  });
}

// ── Fields a candidate cannot update themselves ───────────────────────────────
const BLOCKED_FIELDS = new Set([
  'candidateCode', 'userId', 'lpkId', 'profileStatus', 'isLocked',
  'nikEncrypted', 'nik', 'bankAccountEncrypted', 'internalNotes', 'id',
  'createdAt', 'updatedAt',
]);

// ── GET /api/candidates/me ────────────────────────────────────────────────────
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const candidate = await findMyCandidate(req.user!.sub);
  if (!candidate) {
    res.json({ candidate: null, isNewUser: true });
    return;
  }

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const completeness = calcCompleteness(data);

  const activeClause = await ConsentClause.findOne({ where: { isActive: true }, attributes: ['id'] });
  const consentUpToDate =
    candidate.consentGiven === true &&
    activeClause !== null &&
    candidate.consentClauseId === activeClause.id;

  res.json({
    candidate: {
      ...serializeCandidate(data, 'candidate'),
      completeness,
      consentUpToDate,
      activeConsentClauseId: activeClause?.id ?? null,
    },
  });
});

// ── PATCH /api/candidates/me ──────────────────────────────────────────────────
router.patch('/me', async (req: Request, res: Response): Promise<void> => {
  const candidate = await findMyCandidate(req.user!.sub);
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED', message: 'Your profile is locked by a manager.' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (!BLOCKED_FIELDS.has(k)) updates[k] = v;
  }

  // Allow candidate to set lpkId once (only when not yet assigned)
  if (body['lpkId'] && !candidate.lpkId) {
    const lpk = await Lpk.findOne({ where: { id: body['lpkId'] as string, isActive: true } });
    if (lpk) updates['lpkId'] = lpk.id;
  }

  await candidate.update(updates);

  const fresh = await findMyCandidate(req.user!.sub);
  const data = fresh!.toJSON() as unknown as Record<string, unknown>;
  res.json({ candidate: { ...serializeCandidate(data, 'candidate'), completeness: calcCompleteness(data) } });
});

// ── PATCH /api/candidates/me/consent ─────────────────────────────────────────
router.patch('/me/consent', authenticate, requireRole('candidate'), async (req: Request, res: Response): Promise<void> => {
  try {
    const candidate = await findMyCandidate(req.user!.sub);
    if (!candidate) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const { clauseId } = req.body as { clauseId?: string };

    await candidate.update({
      consentGiven: true,
      consentGivenAt: new Date(),
      ...(clauseId ? { consentClauseId: clauseId } : {}),
    });

    await AuditLog.create({
      userId: req.user!.sub,
      action: 'CONSENT_GIVEN',
      entityType: 'candidate',
      entityId: candidate.id,
      targetCandidateId: candidate.id,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      payload: clauseId ? { clauseId } : null,
    });

    res.json({ message: 'Consent recorded.' });
  } catch (err) {
    console.error('[PATCH /me/consent] error:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

// ── PATCH /api/candidates/me/nik ─────────────────────────────────────────────
router.patch('/me/nik', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED', message: 'Your profile is locked by a manager.' });
    return;
  }

  const { nik } = req.body as { nik?: string };
  if (!nik || !/^\d{16}$/.test(nik)) {
    res.status(422).json({ error: 'INVALID_NIK', message: 'NIK must be exactly 16 digits.' });
    return;
  }

  await candidate.update({ nikEncrypted: encrypt(nik) });

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'UPDATE_NIK',
    entityType: 'candidate',
    entityId: candidate.id,
    targetCandidateId: candidate.id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: null,
  });

  res.json({ message: 'NIK updated successfully.' });
});

// ── POST /api/candidates/me/submit ───────────────────────────────────────────
router.post('/me/submit', async (req: Request, res: Response): Promise<void> => {
  const candidate = await findMyCandidate(req.user!.sub);
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  if (!candidate.consentGiven) {
    res.status(422).json({ error: 'CONSENT_REQUIRED', message: 'Consent must be given before submitting.' });
    return;
  }
  if (candidate.profileStatus !== 'incomplete') {
    res.status(422).json({ error: 'INVALID_STATUS', message: 'Profile has already been submitted.' });
    return;
  }

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const { pct } = calcCompleteness(data);
  if (pct < 100) {
    res.status(422).json({ error: 'INCOMPLETE_PROFILE', message: `Profile is only ${pct}% complete.` });
    return;
  }

  await candidate.update({ profileStatus: 'submitted' });

  // Notify all admin + manager users
  const admins = await User.findAll({ where: { role: ['admin', 'manager'], isActive: true } });
  await Notification.bulkCreate(
    admins.map((a) => ({
      id: uuidv4(),
      userId: a.id,
      type: 'PROFILE_SUBMITTED',
      title: `New submission: ${candidate.fullName}`,
      body: `Candidate ${candidate.candidateCode} has submitted their profile.`,
      isRead: false,
      referenceType: 'candidate',
      referenceId: candidate.id,
    })),
  );

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'PROFILE_SUBMITTED',
    entityType: 'candidate',
    entityId: candidate.id,
    targetCandidateId: candidate.id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: null,
  });

  res.json({ message: 'Profile submitted successfully.' });
});

// ── PUT /api/candidates/me/career ─────────────────────────────────────────────
router.put('/me/career', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED' });
    return;
  }

  const { entries } = req.body as { entries: Array<{
    companyName?: string; division?: string; skillGroup?: string; period?: string; sortOrder?: number;
  }> };

  await CandidateCareer.destroy({ where: { candidateId: candidate.id } });

  if (entries?.length) {
    await CandidateCareer.bulkCreate(
      entries.map((e, i) => ({
        id: uuidv4(),
        candidateId: candidate.id,
        companyName: e.companyName ?? null,
        division: e.division ?? null,
        skillGroup: e.skillGroup ?? null,
        period: e.period ?? null,
        sortOrder: e.sortOrder ?? i,
      })),
    );
  }

  const career = await CandidateCareer.findAll({ where: { candidateId: candidate.id }, order: [['sortOrder', 'ASC']] });
  res.json({ career: career.map((c) => c.toJSON()) });
});

// ── PUT /api/candidates/me/certifications ─────────────────────────────────────
router.put('/me/certifications', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED' });
    return;
  }

  const { entries } = req.body as { entries: Array<{
    certName?: string; certLevel?: string; issuedDate?: string; issuedBy?: string;
  }> };

  await CandidateCertification.destroy({ where: { candidateId: candidate.id } });

  if (entries?.length) {
    await CandidateCertification.bulkCreate(
      entries.map((e) => ({
        id: uuidv4(),
        candidateId: candidate.id,
        certName: e.certName ?? '',
        certLevel: e.certLevel ?? null,
        issuedDate: e.issuedDate ?? null,
        issuedBy: e.issuedBy ?? null,
      })),
    );
  }

  const certifications = await CandidateCertification.findAll({
    where: { candidateId: candidate.id },
    order: [['createdAt', 'ASC']],
  });
  res.json({ certifications: certifications.map((c) => c.toJSON()) });
});

// ── PUT /api/candidates/me/education-history ──────────────────────────────────
router.put('/me/education-history', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED' });
    return;
  }

  const { entries } = req.body as { entries: Array<{
    schoolName?: string; major?: string; startDate?: string; endDate?: string; sortOrder?: number;
  }> };

  await CandidateEducationHistory.destroy({ where: { candidateId: candidate.id } });

  if (entries?.length) {
    await CandidateEducationHistory.bulkCreate(
      entries.map((e, i) => ({
        id: uuidv4(),
        candidateId: candidate.id,
        schoolName: e.schoolName ?? '',
        major: e.major ?? null,
        startDate: e.startDate ?? null,
        endDate: e.endDate ?? null,
        sortOrder: e.sortOrder ?? i,
      })),
    );
  }

  const educationHistory = await CandidateEducationHistory.findAll({
    where: { candidateId: candidate.id },
    order: [['sortOrder', 'ASC']],
  });
  res.json({ educationHistory: educationHistory.map((e) => e.toJSON()) });
});

// ── PUT /api/candidates/me/tests ──────────────────────────────────────────────
router.put('/me/tests', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
  if (!candidate) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (candidate.isLocked) {
    res.status(403).json({ error: 'PROFILE_LOCKED' });
    return;
  }

  const { entries } = req.body as { entries: Array<{
    testName?: string; score?: number; pass?: boolean; testDate?: string;
  }> };

  await CandidateJapaneseTest.destroy({ where: { candidateId: candidate.id } });

  if (entries?.length) {
    await CandidateJapaneseTest.bulkCreate(
      entries.map((e) => ({
        id: uuidv4(),
        candidateId: candidate.id,
        testName: e.testName ?? null,
        score: e.score ?? null,
        pass: e.pass ?? null,
        testDate: e.testDate ? new Date(e.testDate) : null,
      })),
    );
  }

  const tests = await CandidateJapaneseTest.findAll({ where: { candidateId: candidate.id }, order: [['testDate', 'DESC']] });
  res.json({ tests: tests.map((t) => t.toJSON()) });
});

// ── POST /api/candidates/me/photos/:slot ──────────────────────────────────────
router.post(
  '/me/photos/:slot',
  upload.single('photo'),
  async (req: Request, res: Response): Promise<void> => {
    const { slot } = req.params as { slot: string };
    if (slot !== 'closeup' && slot !== 'fullbody') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Slot must be closeup or fullbody.' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'No file uploaded.' });
      return;
    }

    const candidate = await Candidate.findOne({ where: { userId: req.user!.sub } });
    if (!candidate) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (candidate.isLocked) {
      res.status(403).json({ error: 'PROFILE_LOCKED' });
      return;
    }

    try {
      validateImageBuffer(req.file.buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid file.';
      res.status(422).json({ error: 'INVALID_FILE', message: msg });
      return;
    }

    let urlPath: string;
    try {
      ({ urlPath } = await savePhoto(candidate.id, slot as PhotoSlot, req.file.buffer));
    } catch (err) {
      console.error('[photo-upload] savePhoto failed:', err);
      res.status(500).json({ error: 'UPLOAD_FAILED', message: 'Failed to process image.' });
      return;
    }

    const updateField = slot === 'closeup' ? 'closeupUrl' : 'fullbodyUrl';
    await candidate.update({ [updateField]: urlPath });

    await AuditLog.create({
      userId: req.user!.sub,
      action: 'UPLOAD_PHOTO',
      entityType: 'candidate',
      entityId: candidate.id,
      targetCandidateId: candidate.id,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      payload: { slot },
    });

    res.json({ url: urlPath });
  },
);

// ── GET /api/candidates/me/export ─────────────────────────────────────────────
router.get('/me/export', async (req: Request, res: Response): Promise<void> => {
  const candidate = await Candidate.findOne({
    where: { userId: req.user!.sub },
    include: [
      { model: User,                    as: 'user',             attributes: ['name', 'email'], required: false },
      { model: Lpk,                     as: 'lpk',              attributes: ['name', 'city'],  required: false },
      { model: CandidateJapaneseTest,   as: 'tests',            required: false },
      { model: CandidateCareer,         as: 'career',           required: false },
      { model: CandidateBodyCheck,      as: 'bodyCheck',        required: false },
      { model: CandidateCertification,  as: 'certifications',   required: false },
      { model: CandidateEducationHistory, as: 'educationHistory', required: false },
    ],
  });
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const executablePath = (() => {
    if (process.env['CHROME_PATH']) return process.env['CHROME_PATH'];
    const paths = process.platform === 'win32'
      ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
      : ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
    return paths.find((p) => fs.existsSync(p)) ?? null;
  })();
  if (!executablePath) {
    res.status(503).json({ error: 'PDF_UNAVAILABLE', message: 'Chrome not found on server.' });
    return;
  }

  const cj        = candidate.toJSON() as unknown as Record<string, unknown>;
  const user       = cj['user']             as Record<string, string>   | null;
  const lpk        = cj['lpk']              as Record<string, string>   | null;
  const bodyCheck  = cj['bodyCheck']        as Record<string, unknown>  | null;
  const career     = (cj['career']          as Record<string, unknown>[] | null) ?? [];
  const tests      = (cj['tests']           as Record<string, unknown>[] | null) ?? [];
  const certs      = (cj['certifications']  as Record<string, unknown>[] | null) ?? [];
  const eduHist    = (cj['educationHistory'] as Record<string, unknown>[] | null) ?? [];
  const nik        = decryptNullable(candidate.nikEncrypted ?? null);
  const today      = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  const row = (label: string, value: unknown) =>
    `<tr><td class="lbl">${label}</td><td>${value ?? '—'}</td></tr>`;

  const careerRows = career.length
    ? career.map((c) => `<tr>
        <td>${c['companyName'] ?? '—'}</td>
        <td>${c['jobTitle'] ?? '—'}</td>
        <td>${c['startDate'] ?? '—'} – ${c['endDate'] ?? 'sekarang'}</td>
        <td>${c['description'] ?? ''}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty">—</td></tr>`;

  const testRows = tests.length
    ? tests.map((t) => `<tr>
        <td>${t['testType'] ?? '—'}</td>
        <td>${t['testDate'] ?? '—'}</td>
        <td>${t['score'] ?? '—'}</td>
        <td>${t['level'] ?? '—'}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty">—</td></tr>`;

  const certRows = certs.length
    ? certs.map((c) => `<tr>
        <td>${c['name'] ?? '—'}</td>
        <td>${c['issuingOrganization'] ?? '—'}</td>
        <td>${c['issueDate'] ?? '—'}</td>
        <td>${c['expiryDate'] ?? '—'}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty">—</td></tr>`;

  const eduHistRows = eduHist.length
    ? eduHist.map((e) => `<tr>
        <td>${e['institutionName'] ?? '—'}</td>
        <td>${e['degree'] ?? '—'}</td>
        <td>${e['major'] ?? '—'}</td>
        <td>${e['startDate'] ?? '—'} – ${e['endDate'] ?? '—'}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" class="empty">—</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<style>
  * { font-family: 'Helvetica Neue', Arial, sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
  body { color: #1a1a1a; padding: 36px 40px; font-size: 12px; line-height: 1.5; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1E3A5F; padding-bottom: 16px; margin-bottom: 20px; }
  .header-left h1 { font-size: 20px; color: #1E3A5F; font-weight: 700; }
  .header-left p { font-size: 12px; color: #555; margin-top: 2px; }
  .header-right { text-align: right; }
  .header-right .code { font-size: 14px; font-weight: 700; color: #1E3A5F; }
  .header-right .date { font-size: 11px; color: #888; margin-top: 2px; }
  .status-badge { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; background: #1E3A5F; color: #fff; text-transform: uppercase; letter-spacing: .5px; }

  .section-title { font-size: 11px; font-weight: 700; color: #fff; background: #1E3A5F; padding: 5px 10px; margin: 18px 0 0; text-transform: uppercase; letter-spacing: .6px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 12px; vertical-align: top; }
  th { background: #f0f4fa; color: #1E3A5F; font-weight: 600; font-size: 11px; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #f8f9fb; }
  .lbl { width: 40%; color: #555; font-weight: 500; }
  .empty { color: #bbb; font-style: italic; text-align: center; padding: 10px; }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  .two-col table { margin-bottom: 0; }

  .footer { margin-top: 32px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #aaa; text-align: center; }
  .privacy { font-size: 10px; color: #999; text-align: center; margin-top: 4px; }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <h1>IJBNet — Data Portofolio Kandidat</h1>
    <p>${user?.['name'] ?? 'Kandidat'}</p>
  </div>
  <div class="header-right">
    <div class="code">${candidate.candidateCode}</div>
    <div class="date">${today}</div>
    <span class="status-badge">${candidate.profileStatus ?? 'incomplete'}</span>
  </div>
</div>

<!-- Data Pribadi -->
<div class="section-title">Data Pribadi</div>
<div class="two-col">
  <table>
    ${row('Nama Lengkap', user?.['name'])}
    ${row('Email', user?.['email'])}
    ${row('Telepon', candidate.phone)}
    ${row('NIK', nik ?? '(terenkripsi)')}
    ${row('Jenis Kelamin', candidate.gender === 'M' ? 'Laki-laki' : candidate.gender === 'F' ? 'Perempuan' : null)}
    ${row('Tanggal Lahir', candidate.dateOfBirth)}
    ${row('Tempat Lahir', candidate.birthPlace)}
    ${row('Status Perkawinan', candidate.maritalStatus)}
  </table>
  <table>
    ${row('Agama', candidate.religion)}
    ${row('Golongan Darah', candidate.bloodType)}
    ${row('Tinggi Badan', candidate.heightCm ? candidate.heightCm + ' cm' : null)}
    ${row('Berat Badan', candidate.weightKg ? candidate.weightKg + ' kg' : null)}
    ${row('Alamat', candidate.address)}
    ${row('LPK', lpk?.['name'])}
    ${row('Punya Paspor', candidate.hasPassport ? 'Ya' : 'Tidak')}
    ${row('Pernah ke Jepang', candidate.hasVisitedJapan ? 'Ya' : 'Tidak')}
  </table>
</div>

<!-- Minat SSW -->
<div class="section-title">Minat SSW</div>
<table>
  ${row('Tipe SSW', candidate.sswKubun)}
  ${row('Bidang (ID)', candidate.sswSectorId)}
  ${row('Bidang (JA)', candidate.sswSectorJa)}
  ${row('Jenis Pekerjaan (ID)', candidate.sswFieldId)}
  ${row('Jenis Pekerjaan (JA)', candidate.sswFieldJa)}
  ${row('Lama Belajar Bahasa Jepang', candidate.jpStudyDuration)}
</table>

<!-- Pendidikan -->
<div class="section-title">Pendidikan Terakhir</div>
<table>
  ${row('Jenjang', candidate.eduLevel)}
  ${row('Nama Sekolah / Institusi', candidate.eduLabel)}
  ${row('Jurusan', candidate.eduMajor)}
</table>

${eduHist.length ? `
<div class="section-title">Riwayat Pendidikan</div>
<table>
  <tr><th>Institusi</th><th>Jenjang</th><th>Jurusan</th><th>Periode</th></tr>
  ${eduHistRows}
</table>` : ''}

<!-- Riwayat Karier -->
<div class="section-title">Riwayat Karier</div>
<table>
  <tr><th>Perusahaan</th><th>Posisi</th><th>Periode</th><th>Deskripsi</th></tr>
  ${careerRows}
</table>

<!-- Bahasa Jepang -->
<div class="section-title">Kemampuan Bahasa Jepang</div>
<table>
  <tr><th>Jenis Tes</th><th>Tanggal</th><th>Nilai</th><th>Level</th></tr>
  ${testRows}
</table>

<!-- Sertifikasi -->
<div class="section-title">Sertifikasi</div>
<table>
  <tr><th>Nama Sertifikat</th><th>Penerbit</th><th>Tanggal Terbit</th><th>Kadaluarsa</th></tr>
  ${certRows}
</table>

${bodyCheck ? `
<div class="section-title">Pemeriksaan Fisik</div>
<div class="two-col">
  <table>
    ${row('Tinggi', bodyCheck['height'] ? bodyCheck['height'] + ' cm' : null)}
    ${row('Berat', bodyCheck['weight'] ? bodyCheck['weight'] + ' kg' : null)}
    ${row('Golongan Darah', bodyCheck['bloodType'])}
    ${row('Tekanan Darah', bodyCheck['bloodPressure'])}
  </table>
  <table>
    ${row('Penglihatan Kiri', bodyCheck['visionLeft'])}
    ${row('Penglihatan Kanan', bodyCheck['visionRight'])}
    ${row('Buta Warna', bodyCheck['colorBlind'] ? 'Ya' : 'Tidak')}
    ${row('Catatan', bodyCheck['notes'])}
  </table>
</div>` : ''}

<div class="footer">Dicetak oleh IJBNet &bull; ${new Date().toISOString()}</div>
<div class="privacy">Dokumen ini bersifat rahasia. Hanya diperuntukkan bagi kandidat yang bersangkutan sesuai UU PDP.</div>

</body>
</html>`;

  const browser = await puppeteer.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });

    await AuditLog.create({
      userId: req.user!.sub,
      action: 'DATA_EXPORT',
      entityType: 'candidate',
      entityId: candidate.id,
      targetCandidateId: candidate.id,
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      payload: null,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${candidate.candidateCode}-data.pdf"`);
    res.send(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
});

export default router;
