import { QueryInterface } from 'sequelize';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const BCRYPT_ROUNDS = 12;
const PASSWORD = 'Demo1234!';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    const now = new Date();
    const hash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);

    // ── IDs ──────────────────────────────────────────────────────────────────
    const companyId = uuidv4();
    const lpkId = uuidv4();
    const superAdminId = uuidv4();
    const managerId = uuidv4();
    const adminId = uuidv4();
    const recruiterId = uuidv4();
    const candidate1Id = uuidv4();
    const candidate2Id = uuidv4();
    const candidate3Id = uuidv4();
    const batchId = uuidv4();

    // ── Company (idempotent) ─────────────────────────────────────────────────
    const [existingCompanies] = await queryInterface.sequelize.query(
      `SELECT id FROM companies WHERE name = 'Yamada Corporation' LIMIT 1`,
    );
    let resolvedCompanyId = companyId;
    if ((existingCompanies as { id: string }[]).length === 0) {
      await queryInterface.bulkInsert('companies', [
        {
          id: companyId,
          name: 'Yamada Corporation',
          nameJa: '山田コーポレーション株式会社',
          contactPerson: 'Yamada Taro',
          email: 'info@yamada.co.jp',
          phone: '+81-3-1234-5678',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    } else {
      resolvedCompanyId = (existingCompanies as { id: string }[])[0]!.id;
    }

    // ── LPK ─────────────────────────────────────────────────────────────────
    const [existingLpks] = await queryInterface.sequelize.query(
      `SELECT id FROM lpks WHERE name = 'LPK Maju Bersama' LIMIT 1`,
    );
    let resolvedLpkId = lpkId;
    if ((existingLpks as { id: string }[]).length === 0) {
      await queryInterface.bulkInsert('lpks', [
        {
          id: lpkId,
          name: 'LPK Maju Bersama',
          city: 'Jakarta',
          province: 'DKI Jakarta',
          contactPerson: 'Budi Santoso',
          email: 'info@lpkmajubersama.id',
          phone: '+62-21-1234-5678',
          assignedAdmin: null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    } else {
      resolvedLpkId = (existingLpks as { id: string }[])[0]!.id;
    }

    // ── Users ────────────────────────────────────────────────────────────────
    const upsertUser = async (
      id: string,
      email: string,
      name: string,
      role: string,
      extra: Record<string, unknown> = {},
    ): Promise<string> => {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email = '${email}' LIMIT 1`,
      );
      if ((existing as { id: string }[]).length === 0) {
        await queryInterface.bulkInsert('users', [
          { id, email, name, role, passwordHash: hash, isActive: true, createdAt: now, updatedAt: now, ...extra },
        ]);
        return id;
      }
      return (existing as { id: string }[])[0]!.id;
    };

    const resolvedSuperAdminId = await upsertUser(superAdminId, 'superadmin@ijbnet.org', 'Super Admin', 'super_admin');
    const resolvedManagerId = await upsertUser(managerId, 'manager@ijbnet.org', 'Manager IJBNet', 'manager');
    const resolvedAdminId = await upsertUser(adminId, 'admin@ijbnet.org', 'Admin LPK', 'admin', { lpkId: resolvedLpkId });
    const resolvedRecruiterId = await upsertUser(recruiterId, 'recruiter@yamada.co.jp', 'Recruiter Yamada', 'recruiter', { companyId: resolvedCompanyId });

    // Update LPK's assignedAdmin if not set
    await queryInterface.sequelize.query(
      `UPDATE lpks SET assignedAdmin = '${resolvedAdminId}' WHERE id = '${resolvedLpkId}' AND assignedAdmin IS NULL`,
    );

    // ── Candidates ───────────────────────────────────────────────────────────
    const upsertCandidate = async (
      id: string,
      code: string,
      fullName: string,
      extra: Record<string, unknown> = {},
    ): Promise<string> => {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM candidates WHERE candidateCode = '${code}' LIMIT 1`,
      );
      if ((existing as { id: string }[]).length === 0) {
        await queryInterface.bulkInsert('candidates', [
          {
            id,
            candidateCode: code,
            lpkId: resolvedLpkId,
            profileStatus: 'approved',
            isLocked: false,
            consentGiven: true,
            consentGivenAt: now,
            fullName,
            childrenCount: 0,
            accompany: 'none',
            createdAt: now,
            updatedAt: now,
            ...extra,
          },
        ]);
        return id;
      }
      return (existing as { id: string }[])[0]!.id;
    };

    const resolvedC1Id = await upsertCandidate(candidate1Id, 'CDT-0142', 'Ahmad Fauzi', {
      gender: 'M',
      dateOfBirth: new Date('1997-05-12'),
      birthPlace: 'Surabaya',
      sswKubun: 'SSW1',
      sswSectorId: 'Manufaktur',
      sswFieldId: 'Pemesinan',
      sswSectorJa: '製造業',
      sswFieldJa: '機械加工',
      jpStudyDuration: '18 bulan',
      jobCategory: 'Machining',
      interviewStatus: null,
    });

    const resolvedC2Id = await upsertCandidate(candidate2Id, 'CDT-0181', 'Hendra Kusuma', {
      gender: 'M',
      dateOfBirth: new Date('1995-08-23'),
      birthPlace: 'Bandung',
      sswKubun: 'SSW2',
      sswSectorId: 'Konstruksi',
      sswFieldId: 'Pengelasan',
      sswSectorJa: '建設業',
      sswFieldJa: '溶接',
      jpStudyDuration: '24 bulan',
      jobCategory: 'Welding',
      interviewStatus: null,
    });

    const resolvedC3Id = await upsertCandidate(candidate3Id, 'CDT-0138', 'Budi Santoso', {
      gender: 'M',
      dateOfBirth: new Date('1998-02-07'),
      birthPlace: 'Yogyakarta',
      sswKubun: 'SSW1',
      sswSectorId: 'Perawatan',
      sswFieldId: 'Perawatan Lansia',
      sswSectorJa: '介護',
      sswFieldJa: '介護福祉',
      jpStudyDuration: '12 bulan',
      jobCategory: 'Kaigo',
      interviewStatus: null,
    });

    // Japanese test scores
    const testData = [
      { id: uuidv4(), candidateId: resolvedC1Id, testName: 'JLPT N3', score: 78, pass: true, testDate: new Date('2024-07-01') },
      { id: uuidv4(), candidateId: resolvedC2Id, testName: 'JLPT N1', score: 94, pass: true, testDate: new Date('2024-01-15') },
      { id: uuidv4(), candidateId: resolvedC3Id, testName: 'JLPT N4', score: 72, pass: true, testDate: new Date('2024-12-01') },
    ];
    for (const t of testData) {
      const [ex] = await queryInterface.sequelize.query(
        `SELECT id FROM candidate_japanese_tests WHERE candidateId = '${t.candidateId}' AND testName = '${t.testName}' LIMIT 1`,
      );
      if ((ex as unknown[]).length === 0) {
        await queryInterface.bulkInsert('candidate_japanese_tests', [{ ...t, createdAt: now }]);
      }
    }

    // ── Tools Dictionary ────────────────────────────────────────────────────
    const tools = [
      { nameId: 'Mesin Bubut', nameJa: '旋盤', category: 'Mesin' },
      { nameId: 'Mesin Frais', nameJa: 'フライス盤', category: 'Mesin' },
      { nameId: 'Mesin Gerinda', nameJa: '研削盤', category: 'Mesin' },
      { nameId: 'Las MIG', nameJa: 'MIG溶接', category: 'Pengelasan' },
      { nameId: 'Las TIG', nameJa: 'TIG溶接', category: 'Pengelasan' },
      { nameId: 'Las SMAW', nameJa: '被覆アーク溶接', category: 'Pengelasan' },
      { nameId: 'AutoCAD', nameJa: 'AutoCAD', category: 'Desain' },
      { nameId: 'SolidWorks', nameJa: 'SolidWorks', category: 'Desain' },
      { nameId: 'PLC Siemens', nameJa: 'シーメンスPLC', category: 'Otomasi' },
      { nameId: 'Forklift', nameJa: 'フォークリフト', category: 'Operasi' },
    ];
    for (const tool of tools) {
      const [ex] = await queryInterface.sequelize.query(
        `SELECT id FROM tools_dictionaries WHERE nameId = '${tool.nameId}' LIMIT 1`,
      );
      if ((ex as unknown[]).length === 0) {
        await queryInterface.bulkInsert('tools_dictionaries', [
          { id: uuidv4(), ...tool, isActive: true, createdAt: now, updatedAt: now },
        ]);
      }
    }

    // ── Batch ────────────────────────────────────────────────────────────────
    const [existingBatch] = await queryInterface.sequelize.query(
      `SELECT id FROM batches WHERE batchCode = 'BATCH-2025-001' LIMIT 1`,
    );
    let resolvedBatchId = batchId;
    if ((existingBatch as { id: string }[]).length === 0) {
      await queryInterface.bulkInsert('batches', [
        {
          id: batchId,
          batchCode: 'BATCH-2025-001',
          name: 'Batch Yamada Q1 2025',
          companyId: resolvedCompanyId,
          quotaTotal: 5,
          interviewCandidateLimit: 5,
          sswFieldFilter: null,
          status: 'active',
          expiryDate: new Date('2025-12-31'),
          createdBy: resolvedSuperAdminId,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    } else {
      resolvedBatchId = (existingBatch as { id: string }[])[0]!.id;
    }

    // ── BatchCandidates ──────────────────────────────────────────────────────
    for (const cid of [resolvedC1Id, resolvedC2Id, resolvedC3Id]) {
      const [ex] = await queryInterface.sequelize.query(
        `SELECT id FROM batch_candidates WHERE batchId = '${resolvedBatchId}' AND candidateId = '${cid}' LIMIT 1`,
      );
      if ((ex as unknown[]).length === 0) {
        await queryInterface.bulkInsert('batch_candidates', [
          {
            id: uuidv4(),
            batchId: resolvedBatchId,
            candidateId: cid,
            allocatedBy: resolvedManagerId,
            allocatedAt: now,
            isSelected: false,
            isConfirmed: false,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      }
    }

    console.log('✓ Demo data seeded successfully.');
    void resolvedSuperAdminId;
    void resolvedManagerId;
    void resolvedAdminId;
    void resolvedRecruiterId;
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    await queryInterface.bulkDelete('batch_candidates', {});
    await queryInterface.bulkDelete('batches', {});
    await queryInterface.bulkDelete('candidate_japanese_tests', {});
    await queryInterface.bulkDelete('candidates', {});
    await queryInterface.bulkDelete('users', {});
    await queryInterface.bulkDelete('lpks', {});
    await queryInterface.bulkDelete('companies', {});
    await queryInterface.bulkDelete('tools_dictionaries', {});
  },
};

