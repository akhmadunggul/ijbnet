import { QueryInterface } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    const now = new Date();

    // ── Resolve existing FK dependencies ─────────────────────────────────────
    const [lpkRows] = await queryInterface.sequelize.query(
      `SELECT id FROM lpks WHERE name = 'LPK Maju Bersama' LIMIT 1`,
    );
    const [mgrRows] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'manager@ijbnet.org' LIMIT 1`,
    );
    const [recRows] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'recruiter@yamada.co.jp' LIMIT 1`,
    );
    const [compRows] = await queryInterface.sequelize.query(
      `SELECT id FROM companies WHERE name = 'Yamada Corporation' LIMIT 1`,
    );

    if (
      !(lpkRows as { id: string }[]).length ||
      !(mgrRows as { id: string }[]).length ||
      !(recRows as { id: string }[]).length ||
      !(compRows as { id: string }[]).length
    ) {
      throw new Error(
        'Required seed data (LPK, manager, recruiter, company) not found. Run the base seeder first.',
      );
    }

    const lpkId = (lpkRows as { id: string }[])[0]!.id;
    const managerId = (mgrRows as { id: string }[])[0]!.id;
    const recruiterId = (recRows as { id: string }[])[0]!.id;
    const companyId = (compRows as { id: string }[])[0]!.id;

    // ── New batch ─────────────────────────────────────────────────────────────
    const [existingBatch] = await queryInterface.sequelize.query(
      `SELECT id FROM batches WHERE batchCode = 'BATCH-2025-002' LIMIT 1`,
    );
    let batchId: string;
    if ((existingBatch as { id: string }[]).length === 0) {
      batchId = uuidv4();
      await queryInterface.bulkInsert('batches', [
        {
          id: batchId,
          batchCode: 'BATCH-2025-002',
          name: 'Batch Yamada Q2 2025',
          companyId,
          quotaTotal: 6,
          interviewCandidateLimit: 8,
          sswFieldFilter: null,
          status: 'active',
          expiryDate: new Date('2025-12-31'),
          createdBy: managerId,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    } else {
      batchId = (existingBatch as { id: string }[])[0]!.id;
    }

    // ── Candidate definitions ─────────────────────────────────────────────────
    const candidates = [
      {
        code: 'CDT-0200',
        fullName: 'Rina Wulandari',
        gender: 'F',
        dateOfBirth: new Date('1998-03-14'),
        birthPlace: 'Malang',
        sswKubun: 'SSW1',
        sswSectorId: 'Perawatan',
        sswFieldId: 'Perawatan Lansia',
        sswSectorJa: '介護',
        sswFieldJa: '介護福祉',
        jobCategory: 'Kaigo',
        jpStudyDuration: '18 bulan',
        maritalStatus: 'single',
        heightCm: 158,
        weightKg: 50,
        religion: 'Islam',
        eduLevel: 'D3',
        eduMajor: 'Keperawatan',
        selfIntroId: 'Saya adalah lulusan D3 Keperawatan dengan pengalaman magang di panti jompo selama 6 bulan. Saya memiliki kemampuan komunikasi yang baik dan sabar dalam merawat lansia.',
        motivationId: 'Saya ingin berkontribusi dalam bidang perawatan lansia di Jepang dan mendapatkan pengalaman internasional untuk meningkatkan keahlian saya.',
        selfPrId: 'Saya memiliki jiwa sosial yang tinggi, tekun, dan selalu berusaha memberikan pelayanan terbaik kepada pasien. Saya juga aktif belajar bahasa Jepang selama 18 bulan.',
        applyReasonId: 'Jepang memiliki sistem perawatan lansia terbaik di dunia dan saya ingin belajar langsung dari sumbernya untuk mengembangkan karir saya.',
        test: { testName: 'JLPT N3', score: 82, pass: true, testDate: new Date('2024-06-01') },
      },
      {
        code: 'CDT-0201',
        fullName: 'Doni Prasetyo',
        gender: 'M',
        dateOfBirth: new Date('1996-11-08'),
        birthPlace: 'Semarang',
        sswKubun: 'SSW1',
        sswSectorId: 'Manufaktur',
        sswFieldId: 'Pemesinan',
        sswSectorJa: '製造業',
        sswFieldJa: '機械加工',
        jobCategory: 'Machining',
        jpStudyDuration: '12 bulan',
        maritalStatus: 'single',
        heightCm: 173,
        weightKg: 68,
        religion: 'Kristen',
        eduLevel: 'SMK',
        eduMajor: 'Teknik Pemesinan',
        selfIntroId: 'Saya berpengalaman 3 tahun sebagai operator mesin CNC di perusahaan manufaktur. Menguasai mesin bubut, frais, dan gerinda dengan baik.',
        motivationId: 'Saya ingin mengembangkan keahlian teknik saya di Jepang yang terkenal dengan standar manufaktur tinggi dan presisi.',
        selfPrId: 'Bekerja keras, disiplin, dan detail dalam setiap pekerjaan. Saya mampu bekerja di bawah tekanan dan memenuhi target produksi.',
        applyReasonId: 'Industri manufaktur Jepang adalah yang terbaik di dunia. Pengalaman kerja di sana akan sangat meningkatkan nilai saya sebagai teknisi.',
        test: { testName: 'JLPT N4', score: 68, pass: true, testDate: new Date('2024-07-15') },
      },
      {
        code: 'CDT-0202',
        fullName: 'Siti Rahayu',
        gender: 'F',
        dateOfBirth: new Date('1999-07-22'),
        birthPlace: 'Solo',
        sswKubun: 'SSW1',
        sswSectorId: 'Makanan dan Minuman',
        sswFieldId: 'Pengolahan Makanan',
        sswSectorJa: '食品・飲料製造業',
        sswFieldJa: '食品加工',
        jobCategory: 'Food Processing',
        jpStudyDuration: '12 bulan',
        maritalStatus: 'single',
        heightCm: 155,
        weightKg: 48,
        religion: 'Islam',
        eduLevel: 'SMA',
        eduMajor: 'IPA',
        selfIntroId: 'Saya memiliki pengalaman 2 tahun bekerja di industri pengolahan makanan. Memahami standar kebersihan dan keamanan pangan dengan baik.',
        motivationId: 'Industri pangan Jepang sangat maju dan saya ingin belajar teknologi pengolahan makanan modern yang diterapkan di Jepang.',
        selfPrId: 'Saya orangnya teliti, menjaga kebersihan, dan bertanggung jawab. Saya selalu memastikan kualitas produk sesuai standar yang ditetapkan.',
        applyReasonId: 'Saya ingin mendapatkan pengalaman bekerja di negara yang sangat memperhatikan kualitas dan kebersihan produk makanan.',
        test: { testName: 'JLPT N4', score: 75, pass: true, testDate: new Date('2024-12-10') },
      },
      {
        code: 'CDT-0203',
        fullName: 'Agus Setiawan',
        gender: 'M',
        dateOfBirth: new Date('1994-04-30'),
        birthPlace: 'Surabaya',
        sswKubun: 'SSW2',
        sswSectorId: 'Konstruksi',
        sswFieldId: 'Pengelasan',
        sswSectorJa: '建設業',
        sswFieldJa: '溶接',
        jobCategory: 'Welding',
        jpStudyDuration: '24 bulan',
        maritalStatus: 'married',
        heightCm: 170,
        weightKg: 72,
        religion: 'Islam',
        eduLevel: 'SMK',
        eduMajor: 'Teknik Las',
        selfIntroId: 'Juru las bersertifikat dengan pengalaman 5 tahun di proyek konstruksi besar. Menguasai las MIG, TIG, dan SMAW.',
        motivationId: 'Saya ingin meningkatkan keahlian pengelasan saya ke standar internasional Jepang dan mendapatkan sertifikasi yang diakui global.',
        selfPrId: 'Profesional, berpengalaman, dan berkomitmen terhadap keselamatan kerja. Memiliki sertifikat las level 2 dari BNSP.',
        applyReasonId: 'Jepang membutuhkan tenaga las terampil dan saya siap memberikan kontribusi terbaik sambil terus belajar.',
        test: { testName: 'JLPT N3', score: 70, pass: true, testDate: new Date('2024-01-20') },
      },
      {
        code: 'CDT-0204',
        fullName: 'Dewi Lestari',
        gender: 'F',
        dateOfBirth: new Date('2000-09-05'),
        birthPlace: 'Bogor',
        sswKubun: 'SSW1',
        sswSectorId: 'Pertanian',
        sswFieldId: 'Pertanian Tanaman',
        sswSectorJa: '農業',
        sswFieldJa: '耕種農業',
        jobCategory: 'Agriculture',
        jpStudyDuration: '12 bulan',
        maritalStatus: 'single',
        heightCm: 160,
        weightKg: 52,
        religion: 'Islam',
        eduLevel: 'SMA',
        eduMajor: 'IPA',
        selfIntroId: 'Saya berasal dari keluarga petani dan memiliki pengalaman berkebun sejak kecil. Memahami teknik pertanian modern dan hidroponik.',
        motivationId: 'Pertanian Jepang terkenal dengan teknologi dan kualitas produknya. Saya ingin mempelajari metode pertanian Jepang yang efisien.',
        selfPrId: 'Rajin, tahan banting, dan adaptif terhadap lingkungan baru. Saya senang bekerja di luar ruangan dan tidak takut panas maupun hujan.',
        applyReasonId: 'Saya ingin membawa pulang pengetahuan pertanian modern Jepang untuk diterapkan di kampung halaman saya.',
        test: null,
      },
      {
        code: 'CDT-0205',
        fullName: 'Rizky Pratama',
        gender: 'M',
        dateOfBirth: new Date('1997-12-19'),
        birthPlace: 'Medan',
        sswKubun: 'SSW1',
        sswSectorId: 'Konstruksi',
        sswFieldId: 'Bangunan',
        sswSectorJa: '建設業',
        sswFieldJa: '建築',
        jobCategory: 'Construction',
        jpStudyDuration: '18 bulan',
        maritalStatus: 'single',
        heightCm: 175,
        weightKg: 70,
        religion: 'Islam',
        eduLevel: 'SMK',
        eduMajor: 'Teknik Bangunan',
        selfIntroId: 'Saya memiliki pengalaman 4 tahun di bidang konstruksi bangunan. Mampu membaca gambar teknik dan mengawasi pekerjaan lapangan.',
        motivationId: 'Ingin belajar standar konstruksi Jepang yang sangat ketat dan inovatif, terutama dalam hal tahan gempa.',
        selfPrId: 'Energik, bertanggung jawab, dan memiliki jiwa kepemimpinan. Pernah memimpin tim kecil dalam proyek renovasi gedung.',
        applyReasonId: 'Industri konstruksi Jepang menawarkan teknologi bangunan paling canggih di dunia dan saya ingin menjadi bagian dari itu.',
        test: { testName: 'JLPT N4', score: 62, pass: true, testDate: new Date('2024-06-15') },
      },
      {
        code: 'CDT-0206',
        fullName: 'Ningsih Suryani',
        gender: 'F',
        dateOfBirth: new Date('1996-06-11'),
        birthPlace: 'Makassar',
        sswKubun: 'SSW1',
        sswSectorId: 'Kebersihan Gedung',
        sswFieldId: 'Kebersihan Bangunan',
        sswSectorJa: 'ビルクリーニング',
        sswFieldJa: 'ビルクリーニング',
        jobCategory: 'Cleaning',
        jpStudyDuration: '12 bulan',
        maritalStatus: 'single',
        heightCm: 157,
        weightKg: 53,
        religion: 'Kristen',
        eduLevel: 'SMA',
        eduMajor: 'IPS',
        selfIntroId: 'Berpengalaman 3 tahun sebagai cleaning service di gedung perkantoran. Memahami prosedur kebersihan standar internasional.',
        motivationId: 'Saya ingin mendapatkan pengalaman bekerja di Jepang yang terkenal dengan budaya kebersihan dan kerapian terbaik di dunia.',
        selfPrId: 'Rajin, teliti, dan menjunjung tinggi kebersihan. Saya bangga dengan pekerjaan saya dan selalu berusaha memberikan hasil terbaik.',
        applyReasonId: 'Jepang adalah negara yang sangat menjaga kebersihan. Saya ingin belajar standar kebersihan tingkat tinggi yang diterapkan di sana.',
        test: null,
      },
      {
        code: 'CDT-0207',
        fullName: 'Wahyu Hidayat',
        gender: 'M',
        dateOfBirth: new Date('1995-01-28'),
        birthPlace: 'Bandung',
        sswKubun: 'SSW1',
        sswSectorId: 'Akomodasi',
        sswFieldId: 'Hotel',
        sswSectorJa: '宿泊業',
        sswFieldJa: 'フロント・客室清掃',
        jobCategory: 'Hospitality',
        jpStudyDuration: '18 bulan',
        maritalStatus: 'married',
        heightCm: 172,
        weightKg: 67,
        religion: 'Islam',
        eduLevel: 'D3',
        eduMajor: 'Perhotelan',
        selfIntroId: 'Lulusan D3 Perhotelan dengan pengalaman 4 tahun di hotel bintang 4. Menguasai housekeeping, front desk, dan pelayanan tamu.',
        motivationId: 'Industri perhotelan Jepang terkenal dengan Omotenashi (keramahtamahan). Saya ingin mempelajari filosofi pelayanan tingkat tinggi tersebut.',
        selfPrId: 'Ramah, komunikatif, dan berdedikasi tinggi terhadap kepuasan tamu. Memiliki kemampuan bahasa Inggris dan Jepang dasar.',
        applyReasonId: 'Jepang membutuhkan tenaga perhotelan terampil dan saya siap memberikan pelayanan terbaik dengan semangat Omotenashi.',
        test: { testName: 'JLPT N4', score: 71, pass: true, testDate: new Date('2024-12-01') },
      },
      {
        code: 'CDT-0208',
        fullName: 'Farida Putri',
        gender: 'F',
        dateOfBirth: new Date('2001-08-17'),
        birthPlace: 'Palembang',
        sswKubun: 'SSW1',
        sswSectorId: 'Manufaktur',
        sswFieldId: 'Pemesinan',
        sswSectorJa: '製造業',
        sswFieldJa: '機械加工',
        jobCategory: 'Machining',
        jpStudyDuration: '12 bulan',
        maritalStatus: 'single',
        heightCm: 161,
        weightKg: 51,
        religion: 'Islam',
        eduLevel: 'SMK',
        eduMajor: 'Teknik Pemesinan',
        selfIntroId: 'Saya lulusan SMK Teknik Pemesinan dengan nilai terbaik di angkatan saya. Menguasai pengoperasian mesin CNC dan manual.',
        motivationId: 'Saya ingin membuktikan bahwa perempuan juga bisa unggul di bidang teknik dan industri manufaktur Jepang.',
        selfPrId: 'Ambisius, cepat belajar, dan tidak mudah menyerah. Saya selalu berusaha melampaui ekspektasi dalam setiap pekerjaan.',
        applyReasonId: 'Jepang terbuka terhadap perempuan di bidang industri dan saya ingin menjadi bagian dari kemajuan itu.',
        test: { testName: 'JLPT N4', score: 65, pass: true, testDate: new Date('2024-07-01') },
      },
      {
        code: 'CDT-0209',
        fullName: 'Eko Susanto',
        gender: 'M',
        dateOfBirth: new Date('1993-10-03'),
        birthPlace: 'Pontianak',
        sswKubun: 'SSW1',
        sswSectorId: 'Perikanan',
        sswFieldId: 'Budidaya Ikan',
        sswSectorJa: '漁業・養殖業',
        sswFieldJa: '養殖業',
        jobCategory: 'Aquaculture',
        jpStudyDuration: '12 bulan',
        maritalStatus: 'married',
        heightCm: 168,
        weightKg: 65,
        religion: 'Islam',
        eduLevel: 'SMA',
        eduMajor: 'IPA',
        selfIntroId: 'Saya berasal dari keluarga nelayan dan berpengalaman 7 tahun dalam budidaya ikan laut dan air tawar.',
        motivationId: 'Teknologi budidaya ikan Jepang sangat maju. Saya ingin belajar teknik aquaculture modern untuk diterapkan di Indonesia.',
        selfPrId: 'Tangguh, berpengalaman, dan mencintai pekerjaan di laut. Saya terbiasa bekerja dalam kondisi cuaca apapun.',
        applyReasonId: 'Jepang membutuhkan tenaga terampil di sektor perikanan dan saya memiliki pengalaman langsung yang relevan.',
        test: null,
      },
    ];

    // ── Upsert candidates ─────────────────────────────────────────────────────
    const candidateIds: string[] = [];
    for (const cand of candidates) {
      const [existing] = await queryInterface.sequelize.query(
        `SELECT id FROM candidates WHERE candidateCode = '${cand.code}' LIMIT 1`,
      );
      let cid: string;
      if ((existing as { id: string }[]).length === 0) {
        cid = uuidv4();
        await queryInterface.bulkInsert('candidates', [
          {
            id: cid,
            candidateCode: cand.code,
            lpkId,
            profileStatus: 'approved',
            isLocked: false,
            consentGiven: true,
            consentGivenAt: now,
            fullName: cand.fullName,
            gender: cand.gender,
            dateOfBirth: cand.dateOfBirth,
            birthPlace: cand.birthPlace,
            sswKubun: cand.sswKubun,
            sswSectorId: cand.sswSectorId,
            sswFieldId: cand.sswFieldId,
            sswSectorJa: cand.sswSectorJa,
            sswFieldJa: cand.sswFieldJa,
            jobCategory: cand.jobCategory,
            jpStudyDuration: cand.jpStudyDuration,
            maritalStatus: cand.maritalStatus,
            heightCm: cand.heightCm,
            weightKg: cand.weightKg,
            religion: cand.religion,
            eduLevel: cand.eduLevel,
            eduMajor: cand.eduMajor,
            selfIntroId: cand.selfIntroId,
            motivationId: cand.motivationId,
            selfPrId: cand.selfPrId,
            applyReasonId: cand.applyReasonId,
            childrenCount: 0,
            accompany: 'none',
            interviewStatus: null,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      } else {
        cid = (existing as { id: string }[])[0]!.id;
      }
      candidateIds.push(cid);

      // Insert Japanese test if present
      if (cand.test) {
        const t = cand.test;
        const [tEx] = await queryInterface.sequelize.query(
          `SELECT id FROM candidate_japanese_tests WHERE candidateId = '${cid}' AND testName = '${t.testName}' LIMIT 1`,
        );
        if ((tEx as unknown[]).length === 0) {
          await queryInterface.bulkInsert('candidate_japanese_tests', [
            {
              id: uuidv4(),
              candidateId: cid,
              testName: t.testName,
              score: t.score,
              pass: t.pass,
              testDate: t.testDate,
              createdAt: now,
            },
          ]);
        }
      }
    }

    // ── Workflow simulation ───────────────────────────────────────────────────
    // Allocation times staggered over past 30 days
    const allocBase = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Selection times: 1 week after allocation
    const selBase = new Date(allocBase.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Confirmation times: 2 days after selection
    const conBase = new Date(selBase.getTime() + 2 * 24 * 60 * 60 * 1000);

    // Workflow per candidate index:
    // 0–7  allocated (all 10 allocated)
    // 0–7  selected (first 8)
    // 0–5  confirmed (first 6)
    // 0    interview completed pass (Rina)
    // 1    interview completed fail (Doni)
    // 2    interview scheduled (Siti)
    // 3    interview proposed (Agus)

    const interviewStatusMap: Record<number, string | null> = {
      0: 'pass',
      1: 'fail',
      2: 'scheduled',
      3: null,
      4: null,
      5: null,
    };

    const batchCandidateIds: string[] = [];
    for (let i = 0; i < candidateIds.length; i++) {
      const cid = candidateIds[i]!;
      const isSelected = i < 8;
      const isConfirmed = i < 6;
      const allocAt = new Date(allocBase.getTime() + i * 2 * 60 * 60 * 1000);
      const selAt = isSelected ? new Date(selBase.getTime() + i * 60 * 60 * 1000) : null;
      const conAt = isConfirmed ? new Date(conBase.getTime() + i * 60 * 60 * 1000) : null;

      const [bcEx] = await queryInterface.sequelize.query(
        `SELECT id FROM batch_candidates WHERE batchId = '${batchId}' AND candidateId = '${cid}' LIMIT 1`,
      );
      let bcId: string;
      if ((bcEx as { id: string }[]).length === 0) {
        bcId = uuidv4();
        await queryInterface.bulkInsert('batch_candidates', [
          {
            id: bcId,
            batchId,
            candidateId: cid,
            allocatedBy: managerId,
            allocatedAt: allocAt,
            isSelected,
            selectedAt: selAt,
            isConfirmed,
            confirmedAt: conAt,
            createdAt: allocAt,
            updatedAt: conAt ?? selAt ?? allocAt,
          },
        ]);
      } else {
        bcId = (bcEx as { id: string }[])[0]!.id;
      }
      batchCandidateIds.push(bcId);

      // Update interviewStatus on candidate for those with completed/scheduled interviews
      if (isConfirmed && interviewStatusMap[i] !== undefined) {
        const istatus = interviewStatusMap[i];
        await queryInterface.sequelize.query(
          `UPDATE candidates SET interviewStatus = ${istatus ? `'${istatus}'` : 'NULL'} WHERE id = '${cid}'`,
        );
      }
    }

    // ── Interview proposals ───────────────────────────────────────────────────
    const proposalDefs = [
      // Rina (index 0) — completed, pass
      {
        idx: 0,
        status: 'completed',
        proposedDates: ['2025-04-10', '2025-04-12', '2025-04-15'],
        finalDate: new Date('2025-04-10'),
      },
      // Doni (index 1) — completed, fail
      {
        idx: 1,
        status: 'completed',
        proposedDates: ['2025-04-14', '2025-04-16'],
        finalDate: new Date('2025-04-14'),
      },
      // Siti (index 2) — scheduled
      {
        idx: 2,
        status: 'scheduled',
        proposedDates: ['2025-05-20', '2025-05-22', '2025-05-25'],
        finalDate: new Date('2025-05-20'),
      },
      // Agus (index 3) — proposed (no final date yet)
      {
        idx: 3,
        status: 'proposed',
        proposedDates: ['2025-05-28', '2025-05-30', '2025-06-02'],
        finalDate: null,
      },
    ];

    for (const pd of proposalDefs) {
      const bcId = batchCandidateIds[pd.idx]!;
      const [ipEx] = await queryInterface.sequelize.query(
        `SELECT id FROM interview_proposals WHERE batchCandidateId = '${bcId}' LIMIT 1`,
      );
      if ((ipEx as unknown[]).length === 0) {
        await queryInterface.bulkInsert('interview_proposals', [
          {
            id: uuidv4(),
            batchCandidateId: bcId,
            proposedBy: recruiterId,
            proposedDates: JSON.stringify(pd.proposedDates),
            finalDate: pd.finalDate,
            status: pd.status,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      }
    }

    console.log('✓ 10 demo candidates inserted with full workflow simulation.');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const codes = [
      'CDT-0200', 'CDT-0201', 'CDT-0202', 'CDT-0203', 'CDT-0204',
      'CDT-0205', 'CDT-0206', 'CDT-0207', 'CDT-0208', 'CDT-0209',
    ];
    for (const code of codes) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT id FROM candidates WHERE candidateCode = '${code}' LIMIT 1`,
      );
      const cid = (rows as { id: string }[])[0]?.id;
      if (cid) {
        const [bcRows] = await queryInterface.sequelize.query(
          `SELECT id FROM batch_candidates WHERE candidateId = '${cid}'`,
        );
        for (const bc of bcRows as { id: string }[]) {
          await queryInterface.sequelize.query(
            `DELETE FROM interview_proposals WHERE batchCandidateId = '${bc.id}'`,
          );
        }
        await queryInterface.sequelize.query(
          `DELETE FROM batch_candidates WHERE candidateId = '${cid}'`,
        );
        await queryInterface.sequelize.query(
          `DELETE FROM candidate_japanese_tests WHERE candidateId = '${cid}'`,
        );
        await queryInterface.sequelize.query(
          `DELETE FROM candidates WHERE id = '${cid}'`,
        );
      }
    }
    await queryInterface.sequelize.query(
      `DELETE FROM batches WHERE batchCode = 'BATCH-2025-002'`,
    );
    console.log('✓ 10 demo candidates removed.');
  },
};
