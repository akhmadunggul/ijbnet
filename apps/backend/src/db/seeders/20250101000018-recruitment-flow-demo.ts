import { QueryInterface } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

/**
 * Demonstrates the full recruitment request → batch → selection flow in three stages:
 *
 * RQ-2025-001  PENDING   — Recruiter submitted, manager hasn't acted yet
 * RQ-2025-002  CONFIRMED — Manager confirmed + allocated 3 candidates; recruiter yet to select
 * RQ-2025-003  CONFIRMED — Manager confirmed + allocated 2 candidates; recruiter selected 1
 */
module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    // ── Resolve existing FK dependencies ─────────────────────────────────────
    const resolve = async (table: string, col: string, val: string): Promise<string> => {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT id FROM ${table} WHERE ${col} = '${val}' LIMIT 1`,
      );
      const id = (rows as { id: string }[])[0]?.id;
      if (!id) throw new Error(`Seed dependency not found: ${table}.${col}=${val}`);
      return id;
    };

    const companyId   = await resolve('companies', 'name', 'Yamada Corporation');
    const managerId   = await resolve('users', 'email', 'manager@ijbnet.org');
    const recruiterId = await resolve('users', 'email', 'recruiter@yamada.co.jp');
    const adminId     = await resolve('users', 'email', 'admin@ijbnet.org');

    // Resolve candidate IDs we'll use in these scenarios
    const candId = async (code: string) => resolve('candidates', 'candidateCode', code);
    const c142  = await candId('CDT-0142'); // Ahmad Fauzi   — SSW1 Pemesinan
    const c181  = await candId('CDT-0181'); // Hendra Kusuma — SSW2 Pengelasan
    const c138  = await candId('CDT-0138'); // Budi Santoso  — SSW1 Perawatan Lansia
    const c200  = await candId('CDT-0200'); // Rina Wulandari — SSW1 Perawatan Lansia
    const c201  = await candId('CDT-0201'); // Doni Prasetyo — SSW1 Pemesinan
    const c203  = await candId('CDT-0203'); // Agus Setiawan — SSW2 Pengelasan
    const c208  = await candId('CDT-0208'); // Farida Putri  — SSW1 Pemesinan

    // ── Body checks (so pool modal shows meaningful results) ─────────────────
    const bodyChecks = [
      { candidateId: c142,  overallResult: 'pass', checkedDate: daysAgo(30), checkedBy: adminId },
      { candidateId: c201,  overallResult: 'pass', checkedDate: daysAgo(25), checkedBy: adminId },
      { candidateId: c208,  overallResult: 'hold', checkedDate: daysAgo(20), checkedBy: adminId },
      { candidateId: c181,  overallResult: 'pass', checkedDate: daysAgo(35), checkedBy: adminId },
      { candidateId: c203,  overallResult: 'pass', checkedDate: daysAgo(28), checkedBy: adminId },
      { candidateId: c138,  overallResult: 'pass', checkedDate: daysAgo(22), checkedBy: adminId },
      { candidateId: c200,  overallResult: 'pass', checkedDate: daysAgo(15), checkedBy: adminId },
    ];
    for (const bc of bodyChecks) {
      const [ex] = await queryInterface.sequelize.query(
        `SELECT id FROM candidate_body_checks WHERE candidateId = '${bc.candidateId}' LIMIT 1`,
      );
      if ((ex as unknown[]).length === 0) {
        await queryInterface.bulkInsert('candidate_body_checks', [{
          id: uuidv4(),
          candidateId: bc.candidateId,
          overallResult: bc.overallResult,
          checkedDate: bc.checkedDate,
          checkedBy: bc.checkedBy,
          createdAt: now,
          updatedAt: now,
        }]);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // SCENARIO 1 — Pending request: recruiter submitted, manager hasn't acted
    // ────────────────────────────────────────────────────────────────────────
    const [rq1Ex] = await queryInterface.sequelize.query(
      `SELECT id FROM recruitment_requests WHERE requestCode = 'RQ-2025-001' LIMIT 1`,
    );
    if ((rq1Ex as unknown[]).length === 0) {
      await queryInterface.bulkInsert('recruitment_requests', [{
        id: uuidv4(),
        requestCode:    'RQ-2025-001',
        companyId,
        requestedBy:    recruiterId,
        kubun:          'SSW1',
        sswSectorId:    'Perawatan',
        sswSectorJa:    '介護',
        sswFieldId:     'Perawatan Lansia',
        sswFieldJa:     '介護福祉',
        requestedCount: 2,
        allocatedCount: null,
        status:         'pending',
        batchId:        null,
        notes:          'Diutamakan kandidat wanita, sudah lulus JLPT N4/N3, pengalaman merawat lansia minimal 1 tahun.',
        managerNotes:   null,
        confirmedAt:    null,
        createdAt:      daysAgo(3),
        updatedAt:      daysAgo(3),
      }]);
    }

    // ────────────────────────────────────────────────────────────────────────
    // SCENARIO 2 — Confirmed: manager allocated 3 candidates; recruiter yet to select
    // Candidates: CDT-0142, CDT-0201, CDT-0208 (all SSW1 Pemesinan)
    // ────────────────────────────────────────────────────────────────────────
    const [batch2Ex] = await queryInterface.sequelize.query(
      `SELECT id FROM batches WHERE batchCode = 'BATCH-RQ-001' LIMIT 1`,
    );
    let batchRQ1Id: string;
    if ((batch2Ex as { id: string }[]).length === 0) {
      batchRQ1Id = uuidv4();
      await queryInterface.bulkInsert('batches', [{
        id:                     batchRQ1Id,
        batchCode:              'BATCH-RQ-001',
        name:                   'Yamada — Pemesinan (RQ-2025-002)',
        companyId,
        quotaTotal:             2,
        interviewCandidateLimit: 2,
        sswFieldFilter:         'Pemesinan',
        status:                 'active',
        expiryDate:             new Date('2025-12-31'),
        createdBy:              managerId,
        createdAt:              daysAgo(8),
        updatedAt:              daysAgo(8),
      }]);
    } else {
      batchRQ1Id = (batch2Ex as { id: string }[])[0]!.id;
    }

    const [rq2Ex] = await queryInterface.sequelize.query(
      `SELECT id FROM recruitment_requests WHERE requestCode = 'RQ-2025-002' LIMIT 1`,
    );
    if ((rq2Ex as unknown[]).length === 0) {
      await queryInterface.bulkInsert('recruitment_requests', [{
        id: uuidv4(),
        requestCode:    'RQ-2025-002',
        companyId,
        requestedBy:    recruiterId,
        kubun:          'SSW1',
        sswSectorId:    'Manufaktur',
        sswSectorJa:    '製造業',
        sswFieldId:     'Pemesinan',
        sswFieldJa:     '機械加工',
        requestedCount: 2,
        allocatedCount: 3,
        status:         'confirmed',
        batchId:        batchRQ1Id,
        notes:          'Butuh operator mesin CNC. Diutamakan pengalaman min. 2 tahun.',
        managerNotes:   'Telah dipilih 3 kandidat terbaik yang sesuai kualifikasi. Silakan pilih 2 untuk diajukan wawancara.',
        confirmedAt:    daysAgo(7),
        createdAt:      daysAgo(10),
        updatedAt:      daysAgo(7),
      }]);
    }

    // Allocate 3 candidates to BATCH-RQ-001 (none selected yet by recruiter)
    const rq2Candidates = [c142, c201, c208];
    for (let i = 0; i < rq2Candidates.length; i++) {
      const cid = rq2Candidates[i]!;
      const [bcEx] = await queryInterface.sequelize.query(
        `SELECT id FROM batch_candidates WHERE batchId = '${batchRQ1Id}' AND candidateId = '${cid}' LIMIT 1`,
      );
      if ((bcEx as unknown[]).length === 0) {
        await queryInterface.bulkInsert('batch_candidates', [{
          id:          uuidv4(),
          batchId:     batchRQ1Id,
          candidateId: cid,
          allocatedBy: managerId,
          allocatedAt: daysAgo(7),
          isSelected:  false,
          selectedAt:  null,
          isConfirmed: false,
          confirmedAt: null,
          createdAt:   daysAgo(7),
          updatedAt:   daysAgo(7),
        }]);
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // SCENARIO 3 — Confirmed: recruiter has selected 1 of 2 allocated candidates
    // Candidates: CDT-0181 (selected ✓), CDT-0203 (not selected)
    // ────────────────────────────────────────────────────────────────────────
    const [batch3Ex] = await queryInterface.sequelize.query(
      `SELECT id FROM batches WHERE batchCode = 'BATCH-RQ-002' LIMIT 1`,
    );
    let batchRQ2Id: string;
    if ((batch3Ex as { id: string }[]).length === 0) {
      batchRQ2Id = uuidv4();
      await queryInterface.bulkInsert('batches', [{
        id:                     batchRQ2Id,
        batchCode:              'BATCH-RQ-002',
        name:                   'Yamada — Pengelasan (RQ-2025-003)',
        companyId,
        quotaTotal:             1,
        interviewCandidateLimit: 1,
        sswFieldFilter:         'Pengelasan',
        status:                 'active',
        expiryDate:             new Date('2025-12-31'),
        createdBy:              managerId,
        createdAt:              daysAgo(15),
        updatedAt:              daysAgo(15),
      }]);
    } else {
      batchRQ2Id = (batch3Ex as { id: string }[])[0]!.id;
    }

    const [rq3Ex] = await queryInterface.sequelize.query(
      `SELECT id FROM recruitment_requests WHERE requestCode = 'RQ-2025-003' LIMIT 1`,
    );
    if ((rq3Ex as unknown[]).length === 0) {
      await queryInterface.bulkInsert('recruitment_requests', [{
        id: uuidv4(),
        requestCode:    'RQ-2025-003',
        companyId,
        requestedBy:    recruiterId,
        kubun:          'SSW2',
        sswSectorId:    'Konstruksi',
        sswSectorJa:    '建設業',
        sswFieldId:     'Pengelasan',
        sswFieldJa:     '溶接',
        requestedCount: 1,
        allocatedCount: 2,
        status:         'confirmed',
        batchId:        batchRQ2Id,
        notes:          'Dibutuhkan juru las bersertifikat BNSP untuk proyek konstruksi di Osaka.',
        managerNotes:   'Dua kandidat pengelasan berpengalaman telah dipilih. Silakan tentukan 1 kandidat final.',
        confirmedAt:    daysAgo(13),
        createdAt:      daysAgo(16),
        updatedAt:      daysAgo(13),
      }]);
    }

    // Allocate 2 candidates to BATCH-RQ-002
    // CDT-0181 Hendra Kusuma → isSelected=true (recruiter chose him)
    // CDT-0203 Agus Setiawan → isSelected=false
    const rq3Candidates = [
      { cid: c181, isSelected: true,  selectedAt: daysAgo(5) },
      { cid: c203, isSelected: false, selectedAt: null },
    ];
    const rq3BcIds: string[] = [];
    for (const { cid, isSelected, selectedAt } of rq3Candidates) {
      const [bcEx] = await queryInterface.sequelize.query(
        `SELECT id FROM batch_candidates WHERE batchId = '${batchRQ2Id}' AND candidateId = '${cid}' LIMIT 1`,
      );
      let bcId: string;
      if ((bcEx as { id: string }[]).length === 0) {
        bcId = uuidv4();
        await queryInterface.bulkInsert('batch_candidates', [{
          id:          bcId,
          batchId:     batchRQ2Id,
          candidateId: cid,
          allocatedBy: managerId,
          allocatedAt: daysAgo(13),
          isSelected,
          selectedAt,
          isConfirmed: false,
          confirmedAt: null,
          createdAt:   daysAgo(13),
          updatedAt:   selectedAt ?? daysAgo(13),
        }]);
      } else {
        bcId = (bcEx as { id: string }[])[0]!.id;
      }
      rq3BcIds.push(bcId);
    }

    // Interview proposal for CDT-0181 (recruiter proposed dates; pending manager finalization)
    const hendra_bcId = rq3BcIds[0]!;
    const [ipEx] = await queryInterface.sequelize.query(
      `SELECT id FROM interview_proposals WHERE batchCandidateId = '${hendra_bcId}' LIMIT 1`,
    );
    if ((ipEx as unknown[]).length === 0) {
      await queryInterface.bulkInsert('interview_proposals', [{
        id:               uuidv4(),
        batchCandidateId: hendra_bcId,
        proposedBy:       recruiterId,
        proposedDates:    JSON.stringify(['2025-06-10T09:00:00.000Z', '2025-06-12T10:00:00.000Z', '2025-06-15T09:00:00.000Z']),
        finalDate:        null,
        status:           'proposed',
        createdAt:        daysAgo(3),
        updatedAt:        daysAgo(3),
      }]);
    }

    // Also add body check for CDT-0138 and CDT-0200 so the pending pool (RQ-2025-001) looks rich
    // (already handled above in the body checks array)

    console.log('✓ Recruitment flow demo data seeded (3 scenarios: pending / confirmed-unselected / confirmed-selected).');
    void recruiterId;
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    // Remove interview proposals for demo batches
    for (const code of ['BATCH-RQ-001', 'BATCH-RQ-002']) {
      const [bRows] = await queryInterface.sequelize.query(
        `SELECT id FROM batches WHERE batchCode = '${code}' LIMIT 1`,
      );
      const bId = (bRows as { id: string }[])[0]?.id;
      if (bId) {
        const [bcRows] = await queryInterface.sequelize.query(
          `SELECT id FROM batch_candidates WHERE batchId = '${bId}'`,
        );
        for (const { id: bcId } of bcRows as { id: string }[]) {
          await queryInterface.sequelize.query(
            `DELETE FROM interview_proposals WHERE batchCandidateId = '${bcId}'`,
          );
        }
        await queryInterface.sequelize.query(`DELETE FROM batch_candidates WHERE batchId = '${bId}'`);
        await queryInterface.sequelize.query(`DELETE FROM batches WHERE id = '${bId}'`);
      }
    }

    for (const code of ['RQ-2025-001', 'RQ-2025-002', 'RQ-2025-003']) {
      await queryInterface.sequelize.query(
        `DELETE FROM recruitment_requests WHERE requestCode = '${code}'`,
      );
    }

    for (const candCode of ['CDT-0142', 'CDT-0181', 'CDT-0138', 'CDT-0200', 'CDT-0201', 'CDT-0203', 'CDT-0208']) {
      const [cRows] = await queryInterface.sequelize.query(
        `SELECT id FROM candidates WHERE candidateCode = '${candCode}' LIMIT 1`,
      );
      const cId = (cRows as { id: string }[])[0]?.id;
      if (cId) {
        await queryInterface.sequelize.query(
          `DELETE FROM candidate_body_checks WHERE candidateId = '${cId}'`,
        );
      }
    }

    console.log('✓ Recruitment flow demo data removed.');
  },
};
