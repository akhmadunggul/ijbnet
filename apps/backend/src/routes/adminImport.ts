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

// ── DB helpers ────────────────────────────────────────────────────────────────

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

// ── Excel helpers ─────────────────────────────────────────────────────────────

function parseCellValue(cell: ExcelJS.CellValue): string {
  if (cell == null) return '';
  if (cell instanceof Date) return cell.toISOString().split('T')[0]!;
  if (typeof cell === 'object' && 'richText' in (cell as object)) {
    return (cell as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('').trim();
  }
  return String(cell).trim();
}

/**
 * Convert a worksheet to an array of plain-object rows.
 * Row 1 is treated as the header; `*` suffixes are stripped so that
 * `email*` → `email`, `nama_lengkap*` → `nama_lengkap`, etc.
 * Completely empty rows are skipped.
 */
function sheetToRows(ws: ExcelJS.Worksheet): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  let headers: string[] = [];
  ws.eachRow((row, rowNum) => {
    const values = (row.values as ExcelJS.CellValue[]).slice(1);
    if (rowNum === 1) {
      // Normalise: strip asterisk markers used in template headers
      headers = values.map((v) => parseCellValue(v).replace(/\*/g, '').trim());
      return;
    }
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = parseCellValue(values[i] ?? null); });
    if (Object.values(obj).every((v) => v === '')) return; // skip blank rows
    rows.push(obj);
  });
  return rows;
}

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
  return wb.addWorksheet(`__empty_${Date.now()}`);
}

// ── Template styling helpers ──────────────────────────────────────────────────

const NAVY  = 'FF1E3A5F';
const GOLD  = 'FFC9A84C';
const WHITE = 'FFFFFFFF';
const LIGHT = 'FFF5F7FA';
const GRAY  = 'FFD0D5DD';
const RED   = 'FFCC0000';
const GREEN_BG = 'FFE8F5E9';

function styleDataHeader(ws: ExcelJS.Worksheet, requiredCols: number[]): void {
  const row = ws.getRow(1);
  row.height = 22;
  row.eachCell((cell, colNum) => {
    const isReq = requiredCols.includes(colNum);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isReq ? NAVY : 'FF2E4A6A' } };
    cell.font = { bold: true, color: { argb: WHITE }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = { bottom: { style: 'medium', color: { argb: GOLD } } };
  });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function addExampleLabel(ws: ExcelJS.Worksheet, rowNum: number): void {
  const cell = ws.getCell(rowNum, 1);
  cell.note = { texts: [{ text: 'Baris ini adalah contoh — hapus sebelum upload' }] };
}

function styleExampleRow(ws: ExcelJS.Worksheet, rowNum: number, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    const cell = ws.getCell(rowNum, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_BG } };
    cell.font = { italic: true, color: { argb: 'FF2E7D32' }, size: 9 };
  }
}

// Petunjuk (instructions) sheet ───────────────────────────────────────────────

function buildPetunjukSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Petunjuk', { properties: { tabColor: { argb: GOLD } } });
  ws.columns = [
    { width: 22 }, // Kolom
    { width: 8  }, // Wajib
    { width: 45 }, // Format / Nilai Valid
    { width: 35 }, // Contoh
    { width: 40 }, // Keterangan
  ];

  let r = 1;

  // ── Title ──────────────────────────────────────────────────────────────────
  ws.mergeCells(`A${r}:E${r}`);
  const titleCell = ws.getCell(`A${r}`);
  titleCell.value  = 'PANDUAN IMPORT KANDIDAT — IJBNET';
  titleCell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titleCell.font   = { bold: true, color: { argb: WHITE }, size: 14 };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(r).height = 30;
  r++;

  ws.addRow([]); r++;

  // ── Cara Penggunaan ────────────────────────────────────────────────────────
  addSectionTitle(ws, r, 'CARA PENGGUNAAN'); r++;

  const steps = [
    '1. Isi sheet "Kandidat" — satu baris per kandidat. Kolom email dan nama_lengkap WAJIB.',
    '2. Isi sheet "Pendidikan" — satu baris per riwayat pendidikan. Satu kandidat boleh banyak baris.',
    '3. Isi sheet "Pengalaman_Kerja" — satu baris per pekerjaan.',
    '4. Isi sheet "Tes_JP" — satu baris per hasil tes bahasa Jepang.',
    '5. Gunakan kolom email yang SAMA di semua sheet sebagai penghubung antar sheet.',
    '6. Upload file ini lewat menu "Import Kandidat" di portal Admin.',
    '7. Kandidat baru: profil dibuat otomatis. Kandidat lama (email sama): data diperbarui.',
    '8. Ketika kandidat login via Google dengan email yang sama, profil ini terhubung otomatis.',
  ];
  for (const s of steps) {
    ws.mergeCells(`A${r}:E${r}`);
    const cell = ws.getCell(`A${r}`);
    cell.value = s;
    cell.font  = { size: 9, color: { argb: 'FF333333' } };
    cell.alignment = { wrapText: true };
    ws.getRow(r).height = 16;
    r++;
  }

  ws.addRow([]); r++;

  // ── Aturan penting ─────────────────────────────────────────────────────────
  addSectionTitle(ws, r, 'ATURAN PENTING'); r++;

  const rules = [
    '• Kolom bertanda (*) wajib diisi — baris akan ditolak jika kosong.',
    '• Format tanggal lengkap: YYYY-MM-DD (mis. 2000-01-15). Format bulan-tahun: YYYY-MM (mis. 2015-07).',
    '• bidang_ssw harus cocok persis (huruf, spasi) dengan daftar di sheet "Referensi_Bidang_SSW".',
    '• Teks nama, alamat, hobi akan dikonversi otomatis ke HURUF KAPITAL oleh sistem.',
    '• Hapus baris contoh (warna hijau) sebelum upload, atau biarkan — sistem mengabaikan baris tanpa email valid.',
    '• Maksimal ukuran file: 10 MB.',
  ];
  for (const rule of rules) {
    ws.mergeCells(`A${r}:E${r}`);
    const cell = ws.getCell(`A${r}`);
    cell.value = rule;
    cell.font  = { size: 9, color: { argb: 'FF1E3A5F' } };
    cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
    cell.alignment = { wrapText: true };
    ws.getRow(r).height = 16;
    r++;
  }

  ws.addRow([]); r++;

  // ── Column tables per sheet ────────────────────────────────────────────────
  const kandidatCols: ColDef[] = [
    ['email *',            'Ya',    'Email aktif kandidat (akan dipakai untuk login Google)',       'budi.santoso@gmail.com'],
    ['nama_lengkap *',     'Ya',    'Nama lengkap sesuai KTP',                                     'BUDI SANTOSO'],
    ['nama_katakana',      'Tidak', 'Nama dalam huruf katakana Jepang',                            'ブディ サントソ'],
    ['jenis_kelamin',      'Tidak', 'M  =  Laki-laki     |     F  =  Perempuan',                  'M'],
    ['tanggal_lahir',      'Tidak', 'Format: YYYY-MM-DD',                                          '2000-01-15'],
    ['tempat_lahir',       'Tidak', 'Nama kota/kabupaten tempat lahir',                            'JAKARTA'],
    ['agama',              'Tidak', 'Islam / Kristen / Katolik / Budha / Hindu / Lainnya',         'Islam'],
    ['golongan_darah',     'Tidak', 'A / B / AB / O / Unknown',                                    'A'],
    ['status_perkawinan',  'Tidak', 'single / married / divorced / widowed',                       'single'],
    ['jumlah_anak',        'Tidak', 'Angka bilangan bulat (0 jika belum punya anak)',              '0'],
    ['tinggi_badan',       'Tidak', 'Angka dalam cm (tanpa satuan)',                               '170'],
    ['berat_badan',        'Tidak', 'Angka dalam kg (tanpa satuan)',                               '65'],
    ['pernah_ke_jepang',   'Tidak', 'Ya / Tidak',                                                  'Tidak'],
    ['punya_paspor',       'Tidak', 'Ya / Tidak',                                                  'Tidak'],
    ['telepon',            'Tidak', 'Nomor telepon aktif (tanpa spasi/tanda hubung)',              '081234567890'],
    ['alamat',             'Tidak', 'Alamat lengkap tempat tinggal saat ini',                      'JL. CONTOH NO. 1, JAKARTA'],
    ['hobi',               'Tidak', 'Daftar hobi dipisah koma',                                   'MEMBACA, OLAHRAGA'],
    ['lama_belajar_jepang','Tidak', 'Durasi belajar bahasa Jepang (teks bebas)',                  '6 bulan'],
    ['program',            'Tidak', 'SSW1 / SSW2 / Trainee',                                       'SSW1'],
    ['bidang_ssw',         'Tidak', 'Lihat sheet Referensi_Bidang_SSW untuk daftar nilai valid',   'Pertanian'],
    ['skill',              'Tidak', 'Keahlian/keterampilan (maks 300 karakter)',                   'Pengalaman pertanian 3 tahun'],
    ['motivasi',           'Tidak', 'Alasan dan motivasi bekerja di Jepang',                       'Ingin meningkatkan kemampuan'],
    ['promosi_diri',       'Tidak', 'Promosi diri / perkenalan singkat (maks 400 karakter)',       'Saya pekerja keras dan disiplin'],
  ];

  addColumnTable(ws, r, 'SHEET: Kandidat', kandidatCols); r += kandidatCols.length + 4;

  const pendidikanCols: ColDef[] = [
    ['email *',          'Ya',    'Harus sama dengan email di sheet Kandidat',         'budi.santoso@gmail.com'],
    ['nama_sekolah *',   'Ya',    'Nama sekolah/perguruan tinggi (huruf kapital)',     'SMA NEGERI 1 JAKARTA'],
    ['jurusan',          'Tidak', 'Jurusan atau program studi',                        'IPA'],
    ['tanggal_mulai',    'Tidak', 'Format: YYYY-MM (tahun-bulan masuk)',               '2015-07'],
    ['tanggal_selesai',  'Tidak', 'Format: YYYY-MM. Kosongkan jika masih belajar',    '2018-06'],
    ['status',           'Tidak', 'Lulus / Drop Out / Masih Belajar',                 'Lulus'],
  ];

  addColumnTable(ws, r, 'SHEET: Pendidikan  (satu baris per riwayat pendidikan)', pendidikanCols);
  r += pendidikanCols.length + 4;

  const karirCols: ColDef[] = [
    ['email *',           'Ya',    'Harus sama dengan email di sheet Kandidat',          'budi.santoso@gmail.com'],
    ['nama_perusahaan *', 'Ya',    'Nama perusahaan/instansi tempat bekerja',            'PT CONTOH INDONESIA'],
    ['divisi',            'Tidak', 'Divisi, departemen, atau bidang pekerjaan',          'Pertanian'],
    ['tanggal_mulai',     'Tidak', 'Format: YYYY-MM',                                    '2018-08'],
    ['tanggal_selesai',   'Tidak', 'Format: YYYY-MM. Kosongkan jika masih bekerja',     '2023-12'],
    ['deskripsi_tugas',   'Tidak', 'Uraian tugas dan tanggung jawab',                    'Bertanggung jawab dalam pemanenan'],
  ];

  addColumnTable(ws, r, 'SHEET: Pengalaman_Kerja  (satu baris per pekerjaan)', karirCols);
  r += karirCols.length + 4;

  const tesCols: ColDef[] = [
    ['email *',      'Ya',    'Harus sama dengan email di sheet Kandidat',  'budi.santoso@gmail.com'],
    ['nama_tes *',   'Ya',    'Nama tes bahasa Jepang',                     'JLPT / NAT-TEST / J-TEST / JFT-Basic'],
    ['skor',         'Tidak', 'Nilai/skor tes dalam angka (jika ada)',      '350'],
    ['lulus',        'Tidak', 'Ya / Tidak',                                 'Ya'],
    ['tanggal_tes',  'Tidak', 'Format: YYYY-MM-DD',                        '2024-01-15'],
  ];

  addColumnTable(ws, r, 'SHEET: Tes_JP  (satu baris per hasil tes)', tesCols);
}

type ColDef = [string, string, string, string];

function addSectionTitle(ws: ExcelJS.Worksheet, rowNum: number, title: string): void {
  ws.mergeCells(`A${rowNum}:E${rowNum}`);
  const cell = ws.getCell(`A${rowNum}`);
  cell.value = title;
  cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  cell.font  = { bold: true, color: { argb: WHITE }, size: 10 };
  cell.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(rowNum).height = 20;
}

function addColumnTable(
  ws: ExcelJS.Worksheet,
  startRow: number,
  sectionTitle: string,
  cols: ColDef[],
): void {
  let r = startRow;

  // Section header
  addSectionTitle(ws, r, sectionTitle); r++;

  // Table header row
  const hdr = ws.getRow(r);
  hdr.values = ['', 'Kolom', 'Wajib', 'Format / Nilai Valid', 'Contoh'];
  hdr.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } };
    cell.font = { bold: true, size: 9, color: { argb: 'FF1E3A5F' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: GRAY } } };
  });
  hdr.height = 16; r++;

  // Data rows
  cols.forEach(([col, wajib, format, contoh], i) => {
    const row = ws.getRow(r);
    row.values = ['', col, wajib, format, contoh];
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
    row.getCell(2).font = { bold: wajib === 'Ya', size: 9, color: { argb: 'FF1E3A5F' } };
    row.getCell(3).font = { bold: wajib === 'Ya', size: 9, color: { argb: wajib === 'Ya' ? RED : 'FF555555' } };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).font = { size: 9, color: { argb: 'FF333333' } };
    row.getCell(4).alignment = { wrapText: true };
    row.getCell(5).font = { size: 9, color: { argb: 'FF2E7D32' } };
    const bg = i % 2 === 0 ? 'FFFFFFFF' : LIGHT;
    for (let c = 2; c <= 5; c++) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    }
    row.height = 18;
    r++;
  });

  ws.addRow([]); // spacer
}

// ── Data sheets ───────────────────────────────────────────────────────────────

function buildKandidatSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Kandidat', { properties: { tabColor: { argb: NAVY } } });
  ws.columns = [
    { header: 'email *',              key: 'email',                width: 32 },
    { header: 'nama_lengkap *',       key: 'nama_lengkap',         width: 26 },
    { header: 'nama_katakana',        key: 'nama_katakana',        width: 22 },
    { header: 'jenis_kelamin',        key: 'jenis_kelamin',        width: 14 },
    { header: 'tanggal_lahir',        key: 'tanggal_lahir',        width: 15 },
    { header: 'tempat_lahir',         key: 'tempat_lahir',         width: 18 },
    { header: 'agama',                key: 'agama',                width: 12 },
    { header: 'golongan_darah',       key: 'golongan_darah',       width: 14 },
    { header: 'status_perkawinan',    key: 'status_perkawinan',    width: 18 },
    { header: 'jumlah_anak',          key: 'jumlah_anak',          width: 12 },
    { header: 'tinggi_badan',         key: 'tinggi_badan',         width: 12 },
    { header: 'berat_badan',          key: 'berat_badan',          width: 12 },
    { header: 'pernah_ke_jepang',     key: 'pernah_ke_jepang',     width: 17 },
    { header: 'punya_paspor',         key: 'punya_paspor',         width: 14 },
    { header: 'telepon',              key: 'telepon',              width: 18 },
    { header: 'alamat',               key: 'alamat',               width: 45 },
    { header: 'hobi',                 key: 'hobi',                 width: 28 },
    { header: 'lama_belajar_jepang',  key: 'lama_belajar_jepang',  width: 20 },
    { header: 'program',              key: 'program',              width: 10 },
    { header: 'bidang_ssw',           key: 'bidang_ssw',           width: 24 },
    { header: 'skill',                key: 'skill',                width: 40 },
    { header: 'motivasi',             key: 'motivasi',             width: 40 },
    { header: 'promosi_diri',         key: 'promosi_diri',         width: 40 },
  ];

  // Required columns: 1=email, 2=nama_lengkap
  styleDataHeader(ws, [1, 2]);

  // Example row 1
  ws.addRow({
    email: 'budi.santoso@gmail.com',
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
  styleExampleRow(ws, 2, 23);
  addExampleLabel(ws, 2);

  // Example row 2
  ws.addRow({
    email: 'siti.rahayu@gmail.com',
    nama_lengkap: 'SITI RAHAYU',
    nama_katakana: 'シティ ラハユ',
    jenis_kelamin: 'F',
    tanggal_lahir: '1998-05-20',
    tempat_lahir: 'SURABAYA',
    agama: 'Islam',
    golongan_darah: 'B',
    status_perkawinan: 'married',
    jumlah_anak: 1,
    tinggi_badan: 158,
    berat_badan: 52,
    pernah_ke_jepang: 'Tidak',
    punya_paspor: 'Ya',
    telepon: '085678901234',
    alamat: 'JL. MELATI NO. 5, SURABAYA',
    hobi: 'MEMASAK, MENJAHIT',
    lama_belajar_jepang: '1 tahun',
    program: 'Trainee',
    bidang_ssw: 'Industri Pangan',
    skill: 'Pengalaman 2 tahun di industri makanan dan minuman',
    motivasi: 'Ingin menambah pengalaman dan meningkatkan taraf hidup keluarga',
    promosi_diri: 'Saya tekun, cepat belajar, dan mampu bekerja dalam tim',
  });
  styleExampleRow(ws, 3, 23);
  addExampleLabel(ws, 3);

  // Dropdown validations for data rows (rows 2 onward)
  const dropdowns: [string, string][] = [
    ['D', '"M,F"'],
    ['G', '"Islam,Kristen,Katolik,Budha,Hindu,Lainnya"'],
    ['H', '"A,B,AB,O,Unknown"'],
    ['I', '"single,married,divorced,widowed"'],
    ['M', '"Ya,Tidak"'],
    ['N', '"Ya,Tidak"'],
    ['S', '"SSW1,SSW2,Trainee"'],
  ];
  for (let r = 2; r <= 500; r++) {
    dropdowns.forEach(([col, formulae]) => {
      ws.getCell(`${col}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formulae] };
    });
  }

  // Add header notes for enum columns
  const notes: [string, string][] = [
    ['D1', 'M = Laki-laki\nF = Perempuan'],
    ['G1', 'Islam\nKristen\nKatolik\nBudha\nHindu\nLainnya'],
    ['H1', 'A / B / AB / O / Unknown'],
    ['I1', 'single = Belum menikah\nmarried = Menikah\ndivorced = Cerai\nwidowed = Janda/Duda'],
    ['M1', 'Ya / Tidak'],
    ['N1', 'Ya / Tidak'],
    ['S1', 'SSW1 = Specified Skilled Worker 1\nSSW2 = Specified Skilled Worker 2\nTrainee = Magang'],
    ['T1', 'Harus cocok persis dengan kolom "bidang_ssw"\ndi sheet Referensi_Bidang_SSW'],
    ['E1', 'Format: YYYY-MM-DD\nContoh: 2000-01-15'],
  ];
  notes.forEach(([ref, text]) => {
    ws.getCell(ref).note = { texts: [{ text }] };
  });
}

function buildPendidikanSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Pendidikan', { properties: { tabColor: { argb: 'FF4CAF50' } } });
  ws.columns = [
    { header: 'email *',          key: 'email',          width: 32 },
    { header: 'nama_sekolah *',   key: 'nama_sekolah',   width: 38 },
    { header: 'jurusan',          key: 'jurusan',        width: 26 },
    { header: 'tanggal_mulai',    key: 'tanggal_mulai',  width: 15 },
    { header: 'tanggal_selesai',  key: 'tanggal_selesai', width: 17 },
    { header: 'status',           key: 'status',         width: 18 },
  ];
  styleDataHeader(ws, [1, 2]);

  const examples = [
    { email: 'budi.santoso@gmail.com', nama_sekolah: 'SD NEGERI 01 JAKARTA', jurusan: '', tanggal_mulai: '2006-07', tanggal_selesai: '2012-06', status: 'Lulus' },
    { email: 'budi.santoso@gmail.com', nama_sekolah: 'SMP NEGERI 5 JAKARTA',  jurusan: '', tanggal_mulai: '2012-07', tanggal_selesai: '2015-06', status: 'Lulus' },
    { email: 'budi.santoso@gmail.com', nama_sekolah: 'SMA NEGERI 1 JAKARTA',  jurusan: 'IPA', tanggal_mulai: '2015-07', tanggal_selesai: '2018-06', status: 'Lulus' },
    { email: 'siti.rahayu@gmail.com',  nama_sekolah: 'SMK NEGERI 2 SURABAYA', jurusan: 'Tata Boga', tanggal_mulai: '2013-07', tanggal_selesai: '2016-06', status: 'Lulus' },
  ];
  examples.forEach((ex, i) => {
    ws.addRow(ex);
    styleExampleRow(ws, i + 2, 6);
  });

  for (let r = 2; r <= 1000; r++) {
    ws.getCell(`F${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: ['"Lulus,Drop Out,Masih Belajar"'],
    };
  }

  ws.getCell('D1').note = { texts: [{ text: 'Format: YYYY-MM\nContoh: 2015-07' }] };
  ws.getCell('E1').note = { texts: [{ text: 'Format: YYYY-MM\nKosongkan jika masih belajar' }] };
}

function buildKarirSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Pengalaman_Kerja', { properties: { tabColor: { argb: 'FF2196F3' } } });
  ws.columns = [
    { header: 'email *',           key: 'email',           width: 32 },
    { header: 'nama_perusahaan *', key: 'nama_perusahaan', width: 38 },
    { header: 'divisi',            key: 'divisi',          width: 26 },
    { header: 'tanggal_mulai',     key: 'tanggal_mulai',   width: 15 },
    { header: 'tanggal_selesai',   key: 'tanggal_selesai', width: 17 },
    { header: 'deskripsi_tugas',   key: 'deskripsi_tugas', width: 55 },
  ];
  styleDataHeader(ws, [1, 2]);

  const examples = [
    { email: 'budi.santoso@gmail.com', nama_perusahaan: 'PT AGRO NUSANTARA', divisi: 'Pertanian', tanggal_mulai: '2018-08', tanggal_selesai: '2021-12', deskripsi_tugas: 'Penanaman dan pemanenan padi, pengoperasian alat pertanian' },
    { email: 'budi.santoso@gmail.com', nama_perusahaan: 'CV MAJU JAYA',       divisi: 'Produksi',  tanggal_mulai: '2022-01', tanggal_selesai: '',        deskripsi_tugas: 'Pengawasan kualitas hasil panen dan pengemasan produk' },
    { email: 'siti.rahayu@gmail.com',  nama_perusahaan: 'PT FOOD PRIMA',      divisi: 'Produksi',  tanggal_mulai: '2016-08', tanggal_selesai: '2023-06', deskripsi_tugas: 'Produksi makanan ringan, pengendalian mutu dan kebersihan' },
  ];
  examples.forEach((ex, i) => {
    ws.addRow(ex);
    styleExampleRow(ws, i + 2, 6);
  });

  ws.getCell('D1').note = { texts: [{ text: 'Format: YYYY-MM\nContoh: 2018-08' }] };
  ws.getCell('E1').note = { texts: [{ text: 'Format: YYYY-MM\nKosongkan jika masih bekerja' }] };
}

function buildTesjpSheet(wb: ExcelJS.Workbook): void {
  const ws = wb.addWorksheet('Tes_JP', { properties: { tabColor: { argb: 'FFE91E63' } } });
  ws.columns = [
    { header: 'email *',      key: 'email',       width: 32 },
    { header: 'nama_tes *',   key: 'nama_tes',    width: 22 },
    { header: 'skor',         key: 'skor',        width: 10 },
    { header: 'lulus',        key: 'lulus',       width: 10 },
    { header: 'tanggal_tes',  key: 'tanggal_tes', width: 16 },
  ];
  styleDataHeader(ws, [1, 2]);

  const examples = [
    { email: 'budi.santoso@gmail.com', nama_tes: 'JLPT',     skor: null, lulus: 'Ya',    tanggal_tes: '2023-07-02' },
    { email: 'budi.santoso@gmail.com', nama_tes: 'NAT-TEST',  skor: 350,  lulus: 'Ya',    tanggal_tes: '2023-10-15' },
    { email: 'siti.rahayu@gmail.com',  nama_tes: 'JFT-Basic', skor: null, lulus: 'Tidak', tanggal_tes: '2024-02-18' },
  ];
  examples.forEach((ex, i) => {
    ws.addRow(ex);
    styleExampleRow(ws, i + 2, 5);
  });

  for (let r = 2; r <= 500; r++) {
    ws.getCell(`D${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Ya,Tidak"'] };
  }

  ws.getCell('C1').note = { texts: [{ text: 'Angka skor tes (opsional)\nKosongkan jika tidak ada skor numerik' }] };
  ws.getCell('E1').note = { texts: [{ text: 'Format: YYYY-MM-DD\nContoh: 2024-01-15' }] };
}

function buildReferensiSheet(wb: ExcelJS.Workbook, sswFields: SswSectorField[]): void {
  const ws = wb.addWorksheet('Referensi_Bidang_SSW', { properties: { tabColor: { argb: 'FF9C27B0' } } });
  ws.columns = [
    { header: 'program',       key: 'kubun',   width: 12 },
    { header: 'bidang_ssw',    key: 'fieldId', width: 42 },
    { header: 'bidang_ssw_jp', key: 'fieldJa', width: 42 },
  ];
  styleDataHeader(ws, []);

  sswFields.forEach((f, i) => {
    const row = ws.addRow({ kubun: f.kubun, fieldId: f.fieldId, fieldJa: f.fieldJa });
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : LIGHT } };
      cell.font = { size: 9 };
    });
  });

  ws.protect('ijbnet-readonly', { selectLockedCells: true, selectUnlockedCells: true });
}

// ── GET /api/admin/candidates/import/template ─────────────────────────────────
router.get(
  '/candidates/import/template',
  async (req: Request, res: Response): Promise<void> => {
    const lpkId = await getAdminLpkId(req.user!.sub);
    if (!lpkId) { res.status(403).json({ error: 'FORBIDDEN' }); return; }

    const sswFields = await SswSectorField.findAll({
      where: { isActive: true },
      order: [['kubun', 'ASC'], ['sortOrder', 'ASC']],
    });

    const wb = new ExcelJS.Workbook();
    wb.creator  = 'IJBNet';
    wb.created  = new Date();
    wb.modified = new Date();

    // Sheet order: Petunjuk first, then data sheets, then reference
    buildPetunjukSheet(wb);
    buildKandidatSheet(wb);
    buildPendidikanSheet(wb);
    buildKarirSheet(wb);
    buildTesjpSheet(wb);
    buildReferensiSheet(wb, sswFields);

    // Open on Kandidat sheet by default
    const wsK = wb.getWorksheet('Kandidat');
    if (wsK) wsK.state = 'visible';

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="template-import-kandidat.xlsx"',
    );
    await wb.xlsx.write(res);
  },
);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await wb.xlsx.load(req.file.buffer as any);
    } catch {
      res.status(400).json({
        error: 'INVALID_FILE',
        message: 'File tidak dapat dibaca. Pastikan format .xlsx valid.',
      });
      return;
    }

    const wsK = wb.getWorksheet('Kandidat');
    if (!wsK) {
      res.status(400).json({
        error: 'INVALID_FORMAT',
        message: 'Sheet "Kandidat" tidak ditemukan. Gunakan template yang disediakan.',
      });
      return;
    }

    const kandidatRows  = sheetToRows(wsK);
    const pendidikanMap = groupByEmail(sheetToRows(wb.getWorksheet('Pendidikan')      ?? emptySheet(wb)));
    const karirMap      = groupByEmail(sheetToRows(wb.getWorksheet('Pengalaman_Kerja') ?? emptySheet(wb)));
    const tesMap        = groupByEmail(sheetToRows(wb.getWorksheet('Tes_JP')           ?? emptySheet(wb)));

    // Pre-load all active SSW fields for O(1) lookup
    const sswAll    = await SswSectorField.findAll({ where: { isActive: true } });
    const sswByField = new Map(sswAll.map((f) => [f.fieldId.toLowerCase(), f]));

    const results = {
      created: 0,
      updated: 0,
      errors: [] as { row: number; email: string; error: string }[],
    };

    for (let idx = 0; idx < kandidatRows.length; idx++) {
      const row    = kandidatRows[idx]!;
      const rowNum = idx + 2; // Excel row number (header = 1, first data = 2)
      const email    = (row['email'] ?? '').toLowerCase().trim();
      const fullName = (row['nama_lengkap'] ?? '').toUpperCase().trim();

      if (!email || !email.includes('@') || !email.includes('.')) {
        results.errors.push({ row: rowNum, email, error: 'email tidak valid atau kosong' });
        continue;
      }
      if (!fullName) {
        results.errors.push({ row: rowNum, email, error: 'nama_lengkap wajib diisi' });
        continue;
      }

      try {
        // ── User: find-or-create by email ───────────────────────────────────
        const [user, userCreated] = await User.findOrCreate({
          where: { email },
          defaults: {
            id: uuidv4(), email, name: fullName,
            role: 'candidate' as const, lpkId, isActive: true, googleId: null,
          },
        });

        if (!userCreated && user.role !== 'candidate') {
          results.errors.push({ row: rowNum, email, error: 'email sudah dipakai akun non-kandidat' });
          continue;
        }

        // ── Candidate: find-or-create by userId ────────────────────────────
        let candidate = await Candidate.findOne({ where: { userId: user.id } });
        const isNew   = !candidate;

        // SSW field lookup (case-insensitive)
        const bidangKey = (row['bidang_ssw'] ?? '').toLowerCase().trim();
        const sswRec    = bidangKey ? sswByField.get(bidangKey) : null;

        const fields: Record<string, unknown> = {
          lpkId,
          fullName,
          ...str(row,   'nama_katakana',     'nameKatakana'),
          ...str(row,   'jenis_kelamin',     'gender'),
          ...date(row,  'tanggal_lahir',     'dateOfBirth'),
          ...upper(row, 'tempat_lahir',      'birthPlace'),
          ...str(row,   'agama',             'religion'),
          ...str(row,   'golongan_darah',    'bloodType'),
          ...str(row,   'status_perkawinan', 'maritalStatus'),
          ...num(row,   'jumlah_anak',       'childrenCount'),
          ...num(row,   'tinggi_badan',      'selfReportedHeight'),
          ...num(row,   'berat_badan',       'selfReportedWeight'),
          ...bool(row,  'pernah_ke_jepang',  'hasVisitedJapan'),
          ...bool(row,  'punya_paspor',      'hasPassport'),
          ...str(row,   'telepon',           'phone'),
          ...upper(row, 'alamat',            'address'),
          ...upper(row, 'hobi',              'hobbies'),
          ...str(row,   'lama_belajar_jepang', 'jpStudyDuration'),
          ...str(row,   'program',           'sswKubun'),
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

        // ── Education: replace on import ────────────────────────────────────
        const eduRows = (pendidikanMap.get(email) ?? []).filter((e) => e['nama_sekolah']);
        if (eduRows.length > 0) {
          await CandidateEducationHistory.destroy({ where: { candidateId } });
          await CandidateEducationHistory.bulkCreate(
            eduRows.map((e, i) => ({
              id: uuidv4(), candidateId,
              schoolName: (e['nama_sekolah'] ?? '').toUpperCase(),
              major:      e['jurusan'] ? e['jurusan'].toUpperCase() : null,
              startDate:  e['tanggal_mulai']   || null,
              endDate:    e['tanggal_selesai'] || null,
              status:     e['status']           || null,
              sortOrder: i,
            })),
          );
        }

        // ── Career: replace on import ───────────────────────────────────────
        const careerRows = (karirMap.get(email) ?? []).filter((c) => c['nama_perusahaan']);
        if (careerRows.length > 0) {
          await CandidateCareer.destroy({ where: { candidateId } });
          await CandidateCareer.bulkCreate(
            careerRows.map((c, i) => ({
              id: uuidv4(), candidateId,
              companyName: (c['nama_perusahaan'] ?? '').toUpperCase(),
              division:    c['divisi'] ? c['divisi'].toUpperCase() : null,
              startDate:   c['tanggal_mulai']   || null,
              endDate:     c['tanggal_selesai'] || null,
              dutiesId:    c['deskripsi_tugas'] || null,
              sortOrder: i,
            })),
          );
        }

        // ── Japanese tests: replace on import ──────────────────────────────
        const testRows = (tesMap.get(email) ?? []).filter((t) => t['nama_tes']);
        if (testRows.length > 0) {
          await CandidateJapaneseTest.destroy({ where: { candidateId } });
          await CandidateJapaneseTest.bulkCreate(
            testRows.map((t) => ({
              id: uuidv4(), candidateId,
              testName: t['nama_tes'] || null,
              score:    t['skor'] && !isNaN(Number(t['skor'])) ? Number(t['skor']) : null,
              pass:     parseYaTidak(t['lulus'] ?? ''),
              testDate: /^\d{4}-\d{2}-\d{2}$/.test(t['tanggal_tes'] ?? '')
                ? new Date(t['tanggal_tes']!) : null,
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

// ── Value coercion helpers ────────────────────────────────────────────────────

function parseYaTidak(v: string): boolean | null {
  const lv = v.toLowerCase().trim();
  if (lv === 'ya') return true;
  if (lv === 'tidak') return false;
  return null;
}

function str(row: Record<string, string>, col: string, field: string): Record<string, string> {
  const v = (row[col] ?? '').trim();
  return v ? { [field]: v } : {};
}
function upper(row: Record<string, string>, col: string, field: string): Record<string, string> {
  const v = (row[col] ?? '').trim();
  return v ? { [field]: v.toUpperCase() } : {};
}
function date(row: Record<string, string>, col: string, field: string): Record<string, string> {
  const v = (row[col] ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? { [field]: v } : {};
}
function num(row: Record<string, string>, col: string, field: string): Record<string, number> {
  const v = (row[col] ?? '').trim();
  if (!v) return {};
  const n = Number(v);
  return isNaN(n) ? {} : { [field]: n };
}
function bool(
  row: Record<string, string>, col: string, field: string,
): Record<string, boolean | null> {
  const b = parseYaTidak(row[col] ?? '');
  return b != null ? { [field]: b } : {};
}

export default router;
