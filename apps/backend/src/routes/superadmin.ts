import { Router, Request, Response } from 'express';
import { Op } from 'sequelize';
import { isUUID, isEmail } from 'validator';
import bcrypt from 'bcrypt';
import nodeCrypto from 'crypto';
import multer from 'multer';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
import { authenticate, requireRole } from '../middleware/auth';
import { validateUuidParam } from '../middleware/rbac';
import {
  sequelize,
  User,
  Company,
  Lpk,
  Candidate,
  CandidateBodyCheck,
  Batch,
  BatchCandidate,
  InterviewProposal,
  AuditLog,
  ConsentClause,
  GlobalSettings,
} from '../db/models/index';
import { serializeCandidate, serializeUser } from '../serializers/candidate';
import { calcCompleteness } from '../utils/completeness';
import { deleteCandidatePhotos } from '../utils/storage';
import { decryptNullable } from '../utils/crypto';

const pdfUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function wrap(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: (err?: unknown) => void) => {
    fn(req, res).catch(next);
  };
}

function generatePassword(len = 16): string {
  return nodeCrypto.randomBytes(24).toString('base64').slice(0, len);
}

const router = Router();

// ── GET /api/superadmin/consent-clause/active — PUBLIC (no auth) ──────────────
// Candidates must read the clause before consenting, so this must be unauthenticated.
router.get('/consent-clause/active', wrap(async (_req, res) => {
  const clause = await ConsentClause.findOne({ where: { isActive: true } });
  if (!clause) {
    res.json({ clause: null });
    return;
  }
  const c = clause.toJSON() as unknown as Record<string, unknown>;
  res.json({
    clause: {
      id:          c['id'],
      version:     c['version'],
      content:     c['content'],
      contentJa:   c['contentJa'] ?? null,
      publishedAt: c['publishedAt'] ?? null,
    },
  });
}));

// ── GET /api/superadmin/candidate-tab-config — PUBLIC ────────────────────────
// Candidate portal reads this to know which tabs to display.
router.get('/candidate-tab-config', wrap(async (_req, res) => {
  const row = await GlobalSettings.findOne({ where: { key: 'candidate_tab_config' } });
  const defaultConfig = { tab1: true, tab2: true, tab3: true, tab4: true, tab5: true, tab6: true, tab7: true, tab8: true, tab9: true };
  res.json({ config: row ? (row.toJSON() as unknown as Record<string, unknown>)['value'] : defaultConfig });
}));

router.use(authenticate, requireRole('super_admin'));

// ── System Stats ──────────────────────────────────────────────────────────────
router.get('/system/stats', wrap(async (_req, res) => {
  const [
    totalUsers,
    usersByRoleRaw,
    totalCandidates,
    candidatesByStatusRaw,
    totalBatches,
    batchesByStatusRaw,
    proposedCount,
    scheduledCount,
    completedCount,
    recentAuditRaw,
  ] = await Promise.all([
    User.count(),
    User.findAll({ attributes: ['role', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['role'], raw: true }),
    Candidate.count(),
    Candidate.findAll({ attributes: ['profileStatus', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['profileStatus'], raw: true }),
    Batch.count(),
    Batch.findAll({ attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']], group: ['status'], raw: true }),
    InterviewProposal.count({ where: { status: 'proposed' } }),
    InterviewProposal.count({ where: { status: 'scheduled' } }),
    InterviewProposal.count({ where: { status: 'completed' } }),
    AuditLog.findAll({
      include: [{ model: User, as: 'user', attributes: ['name', 'email', 'role'], required: false }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
  ]);

  const byRole: Record<string, number> = {};
  for (const r of usersByRoleRaw as unknown as Array<{ role: string; count: string }>) {
    byRole[r.role] = parseInt(r.count, 10);
  }

  const byStatus: Record<string, number> = {};
  for (const s of candidatesByStatusRaw as unknown as Array<{ profileStatus: string; count: string }>) {
    byStatus[s.profileStatus] = parseInt(s.count, 10);
  }

  const batchByStatus: Record<string, number> = {};
  let activeBatches = 0;
  for (const b of batchesByStatusRaw as unknown as Array<{ status: string; count: string }>) {
    batchByStatus[b.status] = parseInt(b.count, 10);
    if (b.status === 'active') activeBatches = parseInt(b.count, 10);
  }

  let dbStatus: 'ok' | 'error' = 'ok';
  try { await sequelize.authenticate(); } catch { dbStatus = 'error'; }

  res.json({
    users: { total: totalUsers, byRole },
    candidates: { total: totalCandidates, byStatus },
    batches: { total: totalBatches, active: activeBatches, byStatus: batchByStatus },
    interviews: { proposed: proposedCount, scheduled: scheduledCount, completed: completedCount },
    dbStatus,
    recentAuditEntries: recentAuditRaw.map(e => e.toJSON()),
  });
}));

// ── PUT /api/superadmin/candidate-tab-config ──────────────────────────────────
router.put('/candidate-tab-config', wrap(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const validKeys = ['tab1','tab2','tab3','tab4','tab5','tab6','tab7','tab8','tab9'];
  const config: Record<string, boolean> = {};
  for (const k of validKeys) {
    config[k] = body[k] !== false;
  }

  const [row, created] = await GlobalSettings.findOrCreate({
    where: { key: 'candidate_tab_config' },
    defaults: { key: 'candidate_tab_config', value: config },
  });
  if (!created) {
    await row.update({ value: config });
  }

  res.json({ config });
}));

// ── User Management ───────────────────────────────────────────────────────────
router.get('/users', wrap(async (req, res) => {
  const { role, isActive, search, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (role) where['role'] = role;
  if (isActive !== undefined && isActive !== '') where['isActive'] = isActive === 'true';
  if (search) {
    const s = search.replace(/[%_\\]/g, '\\$&');
    where[Op.or as unknown as string] = [
      { name: { [Op.like]: `%${s}%` } },
      { email: { [Op.like]: `%${s}%` } },
    ];
  }
  const limit = Math.min(parseInt(pageSize, 10), 100);
  const offset = (parseInt(page, 10) - 1) * limit;

  const { count, rows } = await User.findAndCountAll({
    where,
    include: [
      { model: Company, as: 'company', attributes: ['id', 'name'], required: false },
      { model: Lpk, as: 'lpk', attributes: ['id', 'name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  res.json({
    users: rows.map(u => serializeUser(u.toJSON() as unknown as Record<string, unknown>)),
    total: count,
    page: parseInt(page, 10),
    pageSize: limit,
  });
}));

router.post('/users', wrap(async (req, res) => {
  const { email, name, role, password, companyId, lpkId } = req.body as Record<string, string | undefined>;

  if (!email || !isEmail(email)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid email required.' });
    return;
  }
  if (!name) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Name required.' });
    return;
  }
  const VALID_ROLES = ['candidate', 'admin', 'manager', 'recruiter', 'super_admin'];
  if (!role || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Valid role required.' });
    return;
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'CONFLICT', message: 'Email already in use.' });
    return;
  }

  const autoGenerated = !password;
  const rawPassword = password || generatePassword();
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const user = await User.create({
    email,
    name,
    role: role as 'candidate' | 'admin' | 'manager' | 'recruiter' | 'super_admin',
    passwordHash,
    companyId: companyId && isUUID(companyId) ? companyId : null,
    lpkId: lpkId && isUUID(lpkId) ? lpkId : null,
  });

  const resp: Record<string, unknown> = {
    user: serializeUser(user.toJSON() as unknown as Record<string, unknown>),
  };
  if (autoGenerated) resp['tempPassword'] = rawPassword;
  res.status(201).json(resp);
}));

router.get('/users/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const user = await User.findByPk(req.params['id'], {
    include: [
      { model: Company, as: 'company', attributes: ['id', 'name'], required: false },
      { model: Lpk, as: 'lpk', attributes: ['id', 'name'], required: false },
    ],
  });
  if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  res.json({ user: serializeUser(user.toJSON() as unknown as Record<string, unknown>) });
}));

router.put('/users/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const { id } = req.params as { id: string };
  const user = await User.findByPk(id);
  if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const { name, role, companyId, lpkId, isActive } = req.body as Record<string, unknown>;
  type RoleType = 'candidate' | 'admin' | 'manager' | 'recruiter' | 'super_admin';
  const updates: Partial<{ name: string | null; role: RoleType; companyId: string | null; lpkId: string | null; isActive: boolean }> = {};

  if (name !== undefined) updates.name = String(name);
  if (id !== req.user!.sub) {
    if (role !== undefined) updates.role = role as RoleType;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
  }
  if (companyId !== undefined) updates.companyId = companyId && isUUID(String(companyId)) ? String(companyId) : null;
  if (lpkId !== undefined) updates.lpkId = lpkId && isUUID(String(lpkId)) ? String(lpkId) : null;

  await user.update(updates);
  res.json({ user: serializeUser(user.toJSON() as unknown as Record<string, unknown>) });
}));

router.patch('/users/:id/activate', validateUuidParam('id'), wrap(async (req, res) => {
  const user = await User.findByPk(req.params['id']);
  if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  await user.update({ isActive: true, deactivatedAt: null });
  res.json({ user: serializeUser(user.toJSON() as unknown as Record<string, unknown>) });
}));

router.patch('/users/:id/deactivate', validateUuidParam('id'), wrap(async (req, res) => {
  const user = await User.findByPk(req.params['id']);
  if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (user.id === req.user!.sub) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot deactivate your own account.' });
    return;
  }
  await user.update({ isActive: false, deactivatedAt: new Date() });
  res.json({ user: serializeUser(user.toJSON() as unknown as Record<string, unknown>) });
}));

router.patch('/users/:id/reset-password', validateUuidParam('id'), wrap(async (req, res) => {
  const user = await User.findByPk(req.params['id']);
  if (!user) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  const rawPassword = generatePassword();
  const passwordHash = await bcrypt.hash(rawPassword, 12);
  await user.update({ passwordHash });
  res.json({ tempPassword: rawPassword });
}));

// ── Company Management ────────────────────────────────────────────────────────
router.get('/companies', wrap(async (_req, res) => {
  const companies = await Company.findAll({ order: [['name', 'ASC']] });
  const result = await Promise.all(companies.map(async (c) => {
    const recruiterCount = await User.count({ where: { companyId: c.id, role: 'recruiter' } });
    return { ...c.toJSON(), recruiterCount };
  }));
  res.json({ companies: result });
}));

router.post('/companies', wrap(async (req, res) => {
  const { name, nameJa, contactPerson, email, phone } = req.body as Record<string, string | undefined>;
  if (!name) { res.status(400).json({ error: 'BAD_REQUEST', message: 'Name required.' }); return; }
  const company = await Company.create({ name, nameJa: nameJa ?? null, contactPerson: contactPerson ?? null, email: email ?? null, phone: phone ?? null });
  res.status(201).json({ company: company.toJSON() });
}));

router.get('/companies/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const company = await Company.findByPk(req.params['id']);
  if (!company) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  const recruiterCount = await User.count({ where: { companyId: company.id, role: 'recruiter' } });
  res.json({ company: { ...company.toJSON(), recruiterCount } });
}));

router.put('/companies/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const company = await Company.findByPk(req.params['id']);
  if (!company) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  const { name, nameJa, contactPerson, email, phone } = req.body as Record<string, string | undefined>;
  await company.update({
    name: name ?? company.name,
    nameJa: nameJa !== undefined ? (nameJa || null) : company.nameJa,
    contactPerson: contactPerson !== undefined ? (contactPerson || null) : company.contactPerson,
    email: email !== undefined ? (email || null) : company.email,
    phone: phone !== undefined ? (phone || null) : company.phone,
  });
  res.json({ company: company.toJSON() });
}));

router.patch('/companies/:id/deactivate', validateUuidParam('id'), wrap(async (req, res) => {
  const company = await Company.findByPk(req.params['id']);
  if (!company) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  await company.update({ isActive: false });
  res.json({ company: company.toJSON() });
}));

// ── LPK Management ────────────────────────────────────────────────────────────
router.get('/lpks', wrap(async (_req, res) => {
  const lpks = await Lpk.findAll({
    include: [{ model: User, as: 'adminUser', attributes: ['id', 'name', 'email'], required: false }],
    order: [['name', 'ASC']],
  });
  res.json({ lpks: lpks.map(l => l.toJSON()) });
}));

router.post('/lpks', wrap(async (req, res) => {
  const { name, city, province, contactPerson, email, phone, assignedAdmin } = req.body as Record<string, string | undefined>;
  if (!name) { res.status(400).json({ error: 'BAD_REQUEST', message: 'Name required.' }); return; }
  const lpk = await Lpk.create({
    name,
    city: city ?? null,
    province: province ?? null,
    contactPerson: contactPerson ?? null,
    email: email ?? null,
    phone: phone ?? null,
    assignedAdmin: assignedAdmin && isUUID(assignedAdmin) ? assignedAdmin : null,
  });
  res.status(201).json({ lpk: lpk.toJSON() });
}));

router.get('/lpks/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const lpk = await Lpk.findByPk(req.params['id'], {
    include: [{ model: User, as: 'adminUser', attributes: ['id', 'name', 'email'], required: false }],
  });
  if (!lpk) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  res.json({ lpk: lpk.toJSON() });
}));

router.put('/lpks/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const lpk = await Lpk.findByPk(req.params['id']);
  if (!lpk) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  const { name, city, province, contactPerson, email, phone, assignedAdmin } = req.body as Record<string, string | undefined>;
  await lpk.update({
    name: name ?? lpk.name,
    city: city !== undefined ? (city || null) : lpk.city,
    province: province !== undefined ? (province || null) : lpk.province,
    contactPerson: contactPerson !== undefined ? (contactPerson || null) : lpk.contactPerson,
    email: email !== undefined ? (email || null) : lpk.email,
    phone: phone !== undefined ? (phone || null) : lpk.phone,
    assignedAdmin: assignedAdmin !== undefined
      ? (assignedAdmin && isUUID(assignedAdmin) ? assignedAdmin : null)
      : lpk.assignedAdmin,
  });
  res.json({ lpk: lpk.toJSON() });
}));

router.patch('/lpks/:id/deactivate', validateUuidParam('id'), wrap(async (req, res) => {
  const lpk = await Lpk.findByPk(req.params['id']);
  if (!lpk) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  await lpk.update({ isActive: false });
  res.json({ lpk: lpk.toJSON() });
}));

// ── Candidates (super admin view) ─────────────────────────────────────────────
router.get('/candidates', wrap(async (req, res) => {
  const { search, profileStatus, sswKubun, lpkId, page = '1', pageSize = '20' } = req.query as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (profileStatus) where['profileStatus'] = profileStatus;
  if (sswKubun) where['sswKubun'] = sswKubun;
  if (lpkId && isUUID(lpkId)) where['lpkId'] = lpkId;
  if (search) {
    where[Op.or as unknown as string] = [
      { fullName: { [Op.like]: `%${search}%` } },
      { candidateCode: { [Op.like]: `%${search}%` } },
    ];
  }
  const limit = Math.min(parseInt(pageSize, 10), 100);
  const offset = (parseInt(page, 10) - 1) * limit;

  const { count, rows } = await Candidate.findAndCountAll({
    where,
    include: [
      { model: CandidateBodyCheck, as: 'bodyCheck', required: false },
      { model: Lpk, as: 'lpk', attributes: ['id', 'name'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const candidates = rows.map(c => {
    const data = c.toJSON() as unknown as Record<string, unknown>;
    const completeness = calcCompleteness(data);
    return { ...serializeCandidate(data, 'super_admin'), completeness };
  });

  res.json({ candidates, total: count, page: parseInt(page, 10), pageSize: limit });
}));

router.get('/candidates/:id/sensitive', validateUuidParam('id'), wrap(async (req, res) => {
  const { id } = req.params as { id: string };
  const candidate = await Candidate.findByPk(id, {
    include: [{ model: CandidateBodyCheck, as: 'bodyCheck', required: false }],
  });
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  const data = candidate.toJSON() as unknown as Record<string, unknown>;
  const bodyCheck = data['bodyCheck'] as Record<string, unknown> | null;

  const nik = decryptNullable(data['nikEncrypted'] as string | null);
  const bankAccount = decryptNullable(data['bankAccountEncrypted'] as string | null);
  const vision = bodyCheck ? decryptNullable(bodyCheck['visionEncrypted'] as string | null) : null;
  const tattoo = bodyCheck ? decryptNullable(bodyCheck['tattooEncrypted'] as string | null) : null;

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'VIEW_SENSITIVE_DATA',
    entityType: 'candidate',
    entityId: id,
    targetCandidateId: id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: { fields: ['nik', 'bankAccount', 'vision', 'tattoo'] },
  });

  res.json({ nik, bankAccount, vision, tattoo });
}));

router.delete('/candidates/:id', validateUuidParam('id'), wrap(async (req, res) => {
  const { id } = req.params as { id: string };
  const { confirmCode } = req.body as { confirmCode?: string };

  const candidate = await Candidate.findByPk(id);
  if (!candidate) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

  if (!confirmCode || confirmCode !== candidate.candidateCode) {
    res.status(400).json({ error: 'BAD_REQUEST', message: 'Confirmation code does not match candidate code.' });
    return;
  }

  const { candidateCode, fullName, userId } = candidate;

  await AuditLog.create({
    userId: req.user!.sub,
    action: 'CANDIDATE_DELETED',
    entityType: 'candidate',
    entityId: id,
    targetCandidateId: id,
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
    payload: { candidateCode, fullName, requestedBy: req.user!.email },
  });

  await deleteCandidatePhotos(id);
  await candidate.destroy();
  if (userId) {
    await User.destroy({ where: { id: userId } });
  }

  res.json({ deleted: true, candidateCode });
}));

// ── Audit Log ─────────────────────────────────────────────────────────────────
router.get('/audit-logs/actions', wrap(async (_req, res) => {
  const actions = await AuditLog.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('action')), 'action']],
    raw: true,
  });
  res.json({ actions: actions.map(a => (a as unknown as { action: string }).action) });
}));

router.get('/audit-logs', wrap(async (req, res) => {
  const { userId, action, entityType, dateFrom, dateTo, page = '1', pageSize = '50', format } = req.query as Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (userId && isUUID(userId)) where['userId'] = userId;
  if (action) where['action'] = action;
  if (entityType) where['entityType'] = entityType;
  if (dateFrom || dateTo) {
    const dateWhere: Record<string, Date> = {};
    if (dateFrom) dateWhere[Op.gte as unknown as string] = new Date(dateFrom);
    if (dateTo) dateWhere[Op.lte as unknown as string] = new Date(dateTo);
    where['createdAt'] = dateWhere;
  }

  const limit = Math.min(parseInt(pageSize, 10), 200);
  const offset = (parseInt(page, 10) - 1) * limit;

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: 'user', attributes: ['name', 'email', 'role'], required: false }],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  if (format === 'csv') {
    const header = 'Timestamp,User Email,User Role,Action,Entity Type,Entity ID,Target Candidate ID,IP Address';
    const lines = rows.map(r => {
      const j = r.toJSON() as unknown as Record<string, unknown>;
      const u = j['user'] as Record<string, string> | null;
      return [
        r.createdAt?.toISOString() ?? '',
        u?.['email'] ?? '',
        u?.['role'] ?? '',
        r.action,
        r.entityType ?? '',
        r.entityId ?? '',
        r.targetCandidateId ?? '',
        r.ipAddress ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`) .join(',');
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
    res.send([header, ...lines].join('\n'));
    return;
  }

  res.json({ auditLogs: rows.map(r => r.toJSON()), total: count, page: parseInt(page, 10), pageSize: limit });
}));

// ── GET /api/superadmin/consent-clause/history ───────────────────────────────
router.get('/consent-clause/history', wrap(async (req, res) => {
  const page     = Math.max(1, parseInt((req.query['page'] as string) ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt((req.query['pageSize'] as string) ?? '20', 10)));
  const offset   = (page - 1) * pageSize;

  const { count, rows } = await ConsentClause.findAndCountAll({
    include: [
      { model: User, as: 'publisher', attributes: ['name', 'email'], required: false },
      { model: User, as: 'creator',   attributes: ['name', 'email'], required: false },
      { model: ConsentClause, as: 'superseder', attributes: ['version'], required: false },
    ],
    order: [['publishedAt', 'DESC'], ['createdAt', 'DESC']],
    limit:  pageSize,
    offset,
  });

  const items = rows.map((r) => {
    const c = r.toJSON() as unknown as Record<string, unknown>;
    return {
      id:            c['id'],
      version:       c['version'],
      content:       typeof c['content'] === 'string' ? c['content'].slice(0, 200) : null,
      contentJa:     typeof c['contentJa'] === 'string' ? (c['contentJa'] as string).slice(0, 200) : null,
      isActive:      c['isActive'],
      publishedAt:   c['publishedAt'],
      supersededAt:  c['supersededAt'],
      sourceType:    c['sourceType'],
      sourcePdfName: c['sourcePdfName'],
      publisher:     c['publisher'] ?? null,
      creator:       c['creator'] ?? null,
      superseder:    c['superseder'] ? { version: (c['superseder'] as Record<string, unknown>)['version'] } : null,
    };
  });

  res.json({ clauses: items, total: count, page, pageSize, totalPages: Math.ceil(count / pageSize) });
}));

// ── GET /api/superadmin/consent-clause/:id ────────────────────────────────────
router.get('/consent-clause/:id', wrap(async (req, res) => {
  if (!isUUID(req.params['id'] ?? '', 4)) { res.status(400).json({ error: 'INVALID_ID' }); return; }
  const clause = await ConsentClause.findByPk(req.params['id'], {
    include: [
      { model: User, as: 'publisher', attributes: ['name', 'email'], required: false },
      { model: User, as: 'creator',   attributes: ['name', 'email'], required: false },
      { model: ConsentClause, as: 'superseder', attributes: ['version'], required: false },
    ],
  });
  if (!clause) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  res.json({ clause: clause.toJSON() });
}));

// ── POST /api/superadmin/consent-clause ───────────────────────────────────────
router.post('/consent-clause', wrap(async (req, res) => {
  const { content, contentJa, version, sourceType, sourcePdfName } =
    req.body as { content?: string; contentJa?: string; version?: string; sourceType?: string; sourcePdfName?: string };

  if (!content || !version) {
    res.status(422).json({ error: 'MISSING_FIELDS', message: 'content and version are required.' });
    return;
  }
  if (!/^\d+\.\d+$/.test(version)) {
    res.status(422).json({ error: 'INVALID_VERSION', message: 'Version must be in X.Y format.' });
    return;
  }
  const existing = await ConsentClause.findOne({ where: { version } });
  if (existing) {
    res.status(409).json({ error: 'VERSION_EXISTS', message: `Version ${version} already exists.` });
    return;
  }

  const newId = require('uuid').v4() as string;

  await sequelize.transaction(async (t) => {
    const currentActive = await ConsentClause.findOne({ where: { isActive: true }, transaction: t });

    await ConsentClause.create({
      id:            newId,
      version,
      content,
      contentJa:     contentJa ?? null,
      isActive:      true,
      publishedAt:   new Date(),
      publishedBy:   req.user!.sub,
      createdBy:     req.user!.sub,
      sourceType:    (sourceType === 'pdf' ? 'pdf' : 'manual') as 'manual' | 'pdf',
      sourcePdfName: sourcePdfName ?? null,
    }, { transaction: t });

    if (currentActive) {
      await currentActive.update({
        isActive:     false,
        supersededAt: new Date(),
        supersededBy: newId,
      }, { transaction: t });
    }
  });

  const clause = await ConsentClause.findByPk(newId);

  await AuditLog.create({
    userId:     req.user!.sub,
    action:     'CONSENT_CLAUSE_PUBLISHED',
    entityType: 'consent_clause',
    entityId:   newId,
    ipAddress:  req.ip ?? null,
    userAgent:  req.headers['user-agent'] ?? null,
    payload:    { version },
  });

  res.status(201).json({ clause: clause!.toJSON() });
}));

// ── POST /api/superadmin/consent-clause/extract-pdf ──────────────────────────
router.post('/consent-clause/extract-pdf', pdfUpload.single('file'), wrap(async (req, res) => {
  if (!req.file) {
    res.status(422).json({ error: 'NO_FILE', message: 'PDF file is required.' });
    return;
  }
  if (req.file.mimetype !== 'application/pdf') {
    res.status(422).json({ error: 'INVALID_FILE', message: 'File must be a PDF.' });
    return;
  }
  if (!req.file.buffer.slice(0, 5).equals(Buffer.from('%PDF-'))) {
    res.status(422).json({ error: 'INVALID_FILE', message: 'File must be a valid PDF.' });
    return;
  }

  const result = await pdfParse(req.file.buffer);
  res.json({
    extractedText: result.text,
    pageCount:     result.numpages,
    filename:      req.file.originalname,
  });
}));

// ── PATCH /api/superadmin/consent-clause/:id ──────────────────────────────────
router.patch('/consent-clause/:id', wrap(async (req, res) => {
  if (!isUUID(req.params['id'] ?? '', 4)) { res.status(400).json({ error: 'INVALID_ID' }); return; }

  const clause = await ConsentClause.findByPk(req.params['id']);
  if (!clause) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (clause.isActive) {
    res.status(403).json({ error: 'CLAUSE_ACTIVE', message: 'Cannot edit a published/active clause.' });
    return;
  }

  const { content, contentJa } = req.body as { content?: string; contentJa?: string };
  const updates: Partial<{ content: string; contentJa: string }> = {};
  if (content !== undefined) updates.content = content;
  if (contentJa !== undefined) updates.contentJa = contentJa;

  await clause.update(updates);

  await AuditLog.create({
    userId:     req.user!.sub,
    action:     'CONSENT_CLAUSE_UPDATED',
    entityType: 'consent_clause',
    entityId:   clause.id,
    ipAddress:  req.ip ?? null,
    userAgent:  req.headers['user-agent'] ?? null,
    payload:    null,
  });

  res.json({ clause: clause.toJSON() });
}));

// ── POST /api/superadmin/consent-clause/:id/push ──────────────────────────────
// Forces all candidates to re-accept the current active clause by clearing their
// stored consentClauseId (non-destructive — consentGiven history is preserved).
router.post('/consent-clause/:id/push', wrap(async (req, res) => {
  if (!isUUID(req.params['id'] ?? '', 4)) { res.status(400).json({ error: 'INVALID_ID' }); return; }

  const clause = await ConsentClause.findByPk(req.params['id']);
  if (!clause) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
  if (!clause.isActive) {
    res.status(422).json({ error: 'CLAUSE_NOT_ACTIVE', message: 'Only the active clause can be pushed.' });
    return;
  }

  const [affectedCandidates] = await Candidate.update(
    { consentClauseId: null as unknown as string },
    { where: {} },
  );

  await AuditLog.create({
    userId:     req.user!.sub,
    action:     'CONSENT_PUSH',
    entityType: 'consent_clause',
    entityId:   clause.id,
    ipAddress:  req.ip ?? null,
    userAgent:  req.headers['user-agent'] ?? null,
    payload:    null,
  });

  res.json({ message: 'Consent push complete.', affectedCandidates });
}));

export default router;
