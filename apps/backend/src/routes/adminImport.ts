import { Router, Request, Response } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';
import nodeCrypto from 'crypto';
import { authenticate, requireRole } from '../middleware/auth';
import {
  User,
  Candidate,
  CandidateEducationHistory,
  CandidateCareer,
  CandidateJapaneseTest,
  SswSectorField,
} from '../db/models/index';
import { autoSubmitIfComplete } from '../utils/autoSubmit';

const router = Router();
router.use(authenticate, requireRole('admin'));

const xlsxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file .xlsx yang diterima'));
    }
  },
});

async function getAdminLpkId(adminUserId: string): Promise<string | null> {
  const user = await User.findByPk(adminUserId, { attributes: ['lpkId'] });
  return user?.lpkId ?? null;
}

async function generateCandidateCode(): Promise<string> {
  let code: string;
  let exists: Candidate | null;
  do {
    code = `CDT-${nodeCrypto.randomBytes(4).toString('hex').toUpperCase()}`;
    exists = await Candidate.findOne({ where: { candidateCode: code } });
  } while (exists);
  return code;
}

function styleHeader(ws: ExcelJS.Worksheet): void {
  const row = ws.getRow(1);
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle' };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function parseCellValue(cell: ExcelJS.CellValue): string {
  if (cell == null) return '';
  if (cell instanceof Date) return cell.toISOString().split('T')[0]!;
  if (typeof cell === 'object' && 'richText' in (cell as object)) {
    return (cell as ExcelJS.CellRichTextValue).richText
      .map((r) => r.text)
      .join('')
      .trim();
  }
  return String(cell).trim();
}

function sheetToRows(ws: ExcelJS.Worksheet): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  let headers: string[] = [];
  ws.eachRow((row, rowNum) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1);
    if (rowNum === 1) {
      headers = values.map((v) => parseCellValue(v));
      return;
    }
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = parseCellValue(values[i] ?? null); });
    if (Object.values(obj).every((v) => v === '')) return;
    rows.push(obj);
  });
  return rows;
}

// ── GET /api/admin/candidates/import/template ─────────────────────────────────
router.get('/candidates/import/template', async (req: Request, res: Response): Promise<void> => {
  const lpkId = await getAdminLpkId(req.user!.sub);
  if (!lpkId) { res.status(403).json({ error: 'FORBIDDEN' }); return; }

  const sswFields = await SswSectorField.findAll({
    where: { isActive: true },
    order: [['kubun', 'ASC'], ['sortOrder', 'ASC']],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'IJBNet';

  // ── Sheet 1: Kandidat ──────────────────────────────────────────────────────
  const wsK = wb.addWorksheet('Kandidat');
  wsK.columns = [
    { header: 'email*',              key: 'email',               width: 32 },
    { header: 'nama_lengkap*',       key: 'nama_lengkap',        width: 28 },
    { header: 'nama_katakana',       key: 'nama_katakana',       width: 22 },
    { header: 'jenis_kelamin',       key: 'jenis_kelamin',       width: 15 },
    { header: 'tanggal_lahir',       key: 'tanggal_lahir',       width: 15 },
    { header: 'tempat_lahir',        key: 'tempat_lahir',        width: 20 },
    { header: 'agama',               key: 'agama',               width: 13 },
    { header: 'golongan_darah',      key: 'golongan_darah',      width: 14 },
    { header: 'status_perkawinan',   key: 'status_perkawinan',   width: 18 },
    { header: 'jumlah_anak',         key: 'jumlah_anak',         width: 13 },
    { header: 'tinggi_badan',        key: 'tinggi_badan',        width: 13 },
    { header: 'berat_badan',         key: 'berat_badan',         width: 12 },
    { header: 'pernah_ke_jepang',    key: 'pernah_ke_jepang',   width: 17 },
    { header: 'punya_paspor',        key: 'punya_paspor',        width: 14 },
    { header: 'telepon',             key: 'telepon',             width: 18 },
    { header: 'alamat',              key: 'alamat',              width: 45 },
    { header: 'hobi',                key: 'hobi',                width: 30 },
    { header: 'lama_belajar_jepang', key: 'lama_belajar_jepang', width: 20 },
    { header: 'program',             key: 'program',             width: 10 },
    { header: 'bidang_ssw',          key: 'bidang_ssw',          width: 25 },
    { header: 'skill',               key: 'skill',               width: 45 },
    { header: 'motivasi',            key: 'motivasi',            width: 45 },
    { header: 'promosi_diri',        key: 'promosi_diri',        width: 45 },
  ];
  styleHeader(wsK);

  wsK.addRow({
    email: 'kandidat@gmail.com',
    nama_lengkap: 'BUDI SANTOSO',
    nama_katakana: 'ブディ サントソ',
    jenis_kelamin: 'M',
    tanggal_lahir: '2000-01-15',
    tempat_lahir: 'JAKARTA',
    agama: 'Islam',
    golongan_darah: 'A',
    status_perkawinan: 'single',
    jumlah_anak: 0,
    tinggi_badan: 170,
    berat_badan: 65,
    pernah_ke_jepang: 'Tidak',
    punya_paspor: 'Tidak',
    telepon: '081234567890',
    alamat: 'JL. CONTOH NO. 1, JAKARTA SELATAN',
    hobi: 'MEMBACA, OLAHRAGA',
    lama_belajar_jepang: '6 bulan',
    program: 'SSW1',
    bidang_ssw: 'Pertanian',
    skill: 'Berpengalaman dalam pertanian selama 3 tahun',
    motivasi: 'Ingin bekerja di Jepang untuk meningkatkan kemampuan',
    promosi_diri: 'Saya adalah pekerja keras yang disiplin dan bertanggung jawab',
  });

  // Dropdown validations (rows 2-500)
  const DV: [string, string][] = [
    ['D', '"M,F"'],
    ['G', '"Islam,Kristen,Katolik,Budha,Hindu,Lainnya"'],
    ['H', '"A,B,AB,O,Unknown"'],
    ['I', '"single,married,divorced,widowed"'],
    ['M', '"Ya,Tidak"'],
    ['N', '"Ya,Tidak"'],
    ['S', '"SSW1,SSW2,Trainee"'],
  ];
  for (let r = 2; r <= 500; r++) {
    DV.forEach(([col, formulae]) => {
      wsK.getCell(`${col}${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [formulae],
      };
    });
  }

  // ── Sheet 2: Pendidikan ────────────────────────────────────────────────────
  const wsP = wb.addWorksheet('Pendidikan');
  wsP.columns = [
    { header: 'email*',          key: 'email',          width: 32 },
    { header: 'nama_sekolah*',   key: 'nama_sekolah',   width: 38 },
    { header: 'jurusan',         key: 'jurusan',        width: 28 },
    { header: 'tanggal_mulai',   key: 'tanggal_mulai',  width: 16 },
    { header: 'tanggal_selesai', key: 'tanggal_selesai', width: 18 },
    { header: 'status',          key: 'status',         width: 20 },
  ];
  styleHeader(wsP);
  wsP.addRow({
    email: 'kandidat@gmail.com',
    nama_sekolah: 'SMA NEGERI 1 JAKARTA',
    jurusan: 'IPA',
    tanggal_mulai: '2015-07',
    tanggal_selesai: '2018-06',
    status: 'Lulus',
  });
  for (let r = 2; r <= 1000; r++) {
    wsP.getCell(`F${r}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: ['"Lulus,Drop Out,Masih Belajar"'],
    };
  }

  // ── Sheet 3: Pengalaman_Kerja ──────────────────────────────────────────────
  const wsC = wb.addWorksheet('Pengalaman_Kerja');
  wsC.columns = [
    { header: 'email*',          key: 'email',           width: 32 },
    { header: 'nama_perusahaan*', key: 'nama_perusahaan', width: 38 },
    { header: 'divisi',          key: 'divisi',          width: 28 },
    { header: 'tanggal_mulai',   key: 'tanggal_mulai',   width: 16 },
    { header: 'tanggal_selesai', key: 'tanggal_selesai', width: 18 },
    { header: 'deskripsi_tugas', key: 'deskripsi_tugas', width: 55 },
  ];
  styleHeader(wsC);
  wsC.addRow({
    email: 'kandidat@gmail.com',
    nama_perusahaan: 'PT CONTOH INDONESIA',
    divisi: 'Pertanian',
    tanggal_mulai: '2018-08',
    tanggal_selesai: '2023-12',
    deskripsi_tugas: 'Bertanggung jawab dalam proses penanaman dan pemanenan padi',
  });

  // ── Sheet 4: Tes_JP ────────────────────────────────────────────────────────
  const wsT = wb.addWorksheet('Tes_JP');
  wsT.columns = [
    { header: 'email*',      key: 'email',       width: 32 },
    { header: 'nama_tes*',   key: 'nama_tes',    width: 22 },
    { header: 'skor',        key: 'skor',        width: 10 },
    { header: 'lulus',       key: 'lulus',       width: 10 },
    { header: 'tanggal_tes', key: 'tanggal_tes', width: 16 },
  ];
  styleHeader(wsT);
  wsT.addRow({
    email: 'kandidat@gmail.com',
    nama_tes: 'JLPT',
    skor: null,
    lulus: 'Ya',
    tanggal_tes: '2024-01-15',
  });
  for (let r = 2; r <= 1000; r++) {
    wsT.getCell(`D${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: ['"Ya,Tidak"'],
    };
  }

  // ── Sheet 5: Referensi Bidang SSW (read-only reference) ───────────────────
  const wsRef = wb.addWorksheet('Referensi_Bidang_SSW');
  wsRef.columns = [
    { header: 'program',       key: 'kubun',   width: 12 },
    { header: 'bidang_ssw',    key: 'fieldId', width: 40 },
    { header: 'bidang_ssw_jp', key: 'fieldJa', width: 40 },
  ];
  styleHeader(wsRef);
  sswFields.forEach((f) => wsRef.addRow({ kubun: f.kubun, fieldId: f.fieldId, fieldJa: f.fieldJa }));
  wsRef.protect('ijbnet-readonly', { selectLockedCells: true, selectUnlockedCells: true });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="template-import-kandidat.xlsx"',
  );
  await wb.xlsx.write(res);
});

// ── POST /api/admin/candidates/import ─────────────────────────────────────────
router.post(
  '/candidates/import',
  xlsxUpload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const lpkId = await getAdminLpkId(req.user!.sub);
    if (!lpkId) { res.status(403).json({ error: 'FORBIDDEN' }); return; }

    if (!req.file) {
      res.status(400).json({ error: 'NO_FILE', message: 'File .xlsx tidak ditemukan' });
      return;
    }

    const wb = new ExcelJS.Workbook();
    try {
      // ExcelJS type declares `Buffer` from old @types/node; cast through unknown to satisfy tsc
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(req.file.buffer as any);
    } catch {
      res.status(400).json({ error: 'INVALID_FILE', message: 'File tidak dapat dibaca. Pastikan format .xlsx valid.' });
      return;
    }

    const wsK = wb.getWorksheet('Kandidat');
    if (!wsK) {
      res.status(400).json({ error: 'INVALID_FORMAT', message: 'Sheet "Kandidat" tidak ditemukan' });
      return;
    }

    const kandidatRows = sheetToRows(wsK);
    const pendidikanMap = groupByEmail(sheetToRows(wb.getWorksheet('Pendidikan') ?? emptySheet(wb)));
    const karirMap     = groupByEmail(sheetToRows(wb.getWorksheet('Pengalaman_Kerja') ?? emptySheet(wb)));
    const tesMap       = groupByEmail(sheetToRows(wb.getWorksheet('Tes_JP') ?? emptySheet(wb)));

    // Pre-load SSW fields for O(1) lookup
    const sswFields = await SswSectorField.findAll({ where: { isActive: true } });
    const sswByField = new Map(sswFields.map((f) => [f.fieldId.toLowerCase(), f]));

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { row: number; email: string; error: string }[],
    };

    for (let idx = 0; idx < kandidatRows.length; idx++) {
      const row = kandidatRows[idx]!;
      const rowNum = idx + 2;
      const email    = (row['email'] ?? '').toLowerCase().trim();
      const fullName = (row['nama_lengkap'] ?? '').toUpperCase().trim();

      if (!email || !email.includes('@')) {
        results.errors.push({ row: rowNum, email, error: 'email tidak valid' });
        continue;
      }
      if (!fullName) {
        results.errors.push({ row: rowNum, email, error: 'nama_lengkap wajib diisi' });
        continue;
      }

      try {
        // User: find-or-create by email
        const [user, userCreated] = await User.findOrCreate({
          where: { email },
          defaults: {
            id: uuidv4(),
            email,
            name: fullName,
            role: 'candidate' as const,
            lpkId,
            isActive: true,
            googleId: null,
          },
        });

        if (!userCreated && user.role !== 'candidate') {
          results.errors.push({ row: rowNum, email, error: 'email sudah dipakai akun non-kandidat' });
          continue;
        }

        // Candidate: find-or-create by userId
        let candidate = await Candidate.findOne({ where: { userId: user.id } });
        const isNew = !candidate;

        // SSW field lookup
        const bidangKey = (row['bidang_ssw'] ?? '').toLowerCase().trim();
        const sswRec    = bidangKey ? sswByField.get(bidangKey) : null;

        const fields: Record<string, unknown> = {
          lpkId,
          fullName,
          ...str(row, 'nama_katakana',    'nameKatakana'),
          ...str(row, 'jenis_kelamin',    'gender'),
          ...date(row, 'tanggal_lahir',   'dateOfBirth'),
          ...upper(row, 'tempat_lahir',   'birthPlace'),
          ...str(row, 'agama',            'religion'),
          ...str(row, 'golongan_darah',   'bloodType'),
          ...str(row, 'status_perkawinan','maritalStatus'),
          ...num(row, 'jumlah_anak',      'childrenCount'),
          ...num(row, 'tinggi_badan',     'selfReportedHeight'),
          ...num(row, 'berat_badan',      'selfReportedWeight'),
          ...bool(row, 'pernah_ke_jepang','hasVisitedJapan'),
          ...bool(row, 'punya_paspor',    'hasPassport'),
          ...str(row, 'telepon',          'phone'),
          ...upper(row, 'alamat',         'address'),
          ...upper(row, 'hobi',           'hobbies'),
          ...str(row, 'lama_belajar_jepang','jpStudyDuration'),
          ...str(row, 'program',          'sswKubun'),
          ...(sswRec ? {
            sswFieldId:  sswRec.fieldId,
            sswFieldJa:  sswRec.fieldJa,
            sswSectorId: sswRec.sectorId,
            sswSectorJa: sswRec.sectorJa,
          } : {}),
          ...str(row, 'skill',        'selfPrId'),
          ...str(row, 'motivasi',     'motivationId'),
          ...str(row, 'promosi_diri', 'selfIntroId'),
        };

        if (isNew) {
          candidate = await Candidate.create({
            id: uuidv4(),
            userId: user.id,
            candidateCode: await generateCandidateCode(),
            profileStatus: 'incomplete',
            isLocked: false,
            consentGiven: false,
            fullName,
            ...fields,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        } else {
          await candidate!.update(fields);
        }

        const candidateId = candidate!.id;

        // Education — replace on import
        const eduRows = pendidikanMap.get(email) ?? [];
        if (eduRows.length > 0) {
          await CandidateEducationHistory.destroy({ where: { candidateId } });
          await CandidateEducationHistory.bulkCreate(
            eduRows
              .filter((e) => e['nama_sekolah'])
              .map((e, i) => ({
                id: uuidv4(),
                candidateId,
                schoolName: (e['nama_sekolah'] ?? '').toUpperCase(),
                major:     e['jurusan'] ? e['jurusan'].toUpperCase() : null,
                startDate: e['tanggal_mulai'] || null,
                endDate:   e['tanggal_selesai'] || null,
                status:    e['status'] || null,
                sortOrder: i,
              })),
          );
        }

        // Career — replace on import
        const careerRows = karirMap.get(email) ?? [];
        if (careerRows.length > 0) {
          await CandidateCareer.destroy({ where: { candidateId } });
          await CandidateCareer.bulkCreate(
            careerRows
              .filter((c) => c['nama_perusahaan'])
              .map((c, i) => ({
                id: uuidv4(),
                candidateId,
                companyName: (c['nama_perusahaan'] ?? '').toUpperCase(),
                division:    c['divisi'] ? c['divisi'].toUpperCase() : null,
                startDate:   c['tanggal_mulai'] || null,
                endDate:     c['tanggal_selesai'] || null,
                dutiesId:    c['deskripsi_tugas'] || null,
                sortOrder:   i,
              })),
          );
        }

        // Japanese tests — replace on import
        const testRows = tesMap.get(email) ?? [];
        if (testRows.length > 0) {
          await CandidateJapaneseTest.destroy({ where: { candidateId } });
          await CandidateJapaneseTest.bulkCreate(
            testRows
              .filter((t) => t['nama_tes'])
              .map((t) => ({
                id:       uuidv4(),
                candidateId,
                testName: t['nama_tes'] || null,
                score:    t['skor'] && !isNaN(Number(t['skor'])) ? Number(t['skor']) : null,
                pass:     parseYaTidak(t['lulus'] ?? ''),
                testDate: t['tanggal_tes'] && /^\d{4}-\d{2}-\d{2}$/.test(t['tanggal_tes'])
                  ? new Date(t['tanggal_tes']) : null,
              })),
          );
        }

        await autoSubmitIfComplete(candidateId, req.user!.sub, 'admin');

        if (isNew) results.created++;
        else results.updated++;
      } catch (err) {
        results.errors.push({ row: rowNum, email, error: (err as Error).message });
      }
    }

    res.json({ ...results, total: kandidatRows.length });
  },
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByEmail(rows: Record<string, string>[]): Map<string, Record<string, string>[]> {
  const map = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    const key = (r['email'] ?? '').toLowerCase().trim();
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

function emptySheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet {
  const name = `__empty_${Date.now()}`;
  return wb.addWorksheet(name);
}

function parseYaTidak(v: string): boolean | null {
  const lv = v.toLowerCase();
  if (lv === 'ya') return true;
  if (lv === 'tidak') return false;
  return null;
}

function str(row: Record<string, string>, col: string, field: string): Record<string, string> {
  const v = row[col];
  return v ? { [field]: v } : {};
}
function upper(row: Record<string, string>, col: string, field: string): Record<string, string> {
  const v = row[col];
  return v ? { [field]: v.toUpperCase() } : {};
}
function date(row: Record<string, string>, col: string, field: string): Record<string, string> {
  const v = row[col];
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? { [field]: v } : {};
}
function num(
  row: Record<string, string>, col: string, field: string,
): Record<string, number> {
  const v = row[col];
  if (v === '' || v == null) return {};
  const n = Number(v);
  return isNaN(n) ? {} : { [field]: n };
}
function bool(
  row: Record<string, string>, col: string, field: string,
): Record<string, boolean | null> {
  const v = row[col];
  const b = parseYaTidak(v ?? '');
  return b != null ? { [field]: b } : {};
}

export default router;
