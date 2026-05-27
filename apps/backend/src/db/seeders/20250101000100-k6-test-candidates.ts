import { QueryInterface } from 'sequelize';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Twenty dedicated load-test candidate accounts (k6.cand1–k6.cand20).
// Idempotent — safe to run multiple times.
// Run in container: cd /app/apps/backend && NODE_ENV=production npx sequelize-cli db:seed --seed 20250101000100-k6-test-candidates.ts

const PASSWORD = 'Demo1234!';

module.exports = {
  async up(queryInterface: QueryInterface): Promise<void> {
    const now = new Date();
    const hash = await bcrypt.hash(PASSWORD, 12);

    // Resolve any active LPK to attach test candidates to
    const [lpkRows] = await queryInterface.sequelize.query(
      `SELECT id FROM lpks WHERE isActive = 1 ORDER BY createdAt ASC LIMIT 1`,
    );
    if ((lpkRows as { id: string }[]).length === 0) {
      throw new Error('No LPK found in the database — create one first');
    }
    const lpkId: string = (lpkRows as { id: string }[])[0]!.id;

    const accounts = [
      { email: 'k6.cand1@candidate.ijbnet.org',  name: 'K6 Test Candidate 1',  code: 'K6T-0001' },
      { email: 'k6.cand2@candidate.ijbnet.org',  name: 'K6 Test Candidate 2',  code: 'K6T-0002' },
      { email: 'k6.cand3@candidate.ijbnet.org',  name: 'K6 Test Candidate 3',  code: 'K6T-0003' },
      { email: 'k6.cand4@candidate.ijbnet.org',  name: 'K6 Test Candidate 4',  code: 'K6T-0004' },
      { email: 'k6.cand5@candidate.ijbnet.org',  name: 'K6 Test Candidate 5',  code: 'K6T-0005' },
      { email: 'k6.cand6@candidate.ijbnet.org',  name: 'K6 Test Candidate 6',  code: 'K6T-0006' },
      { email: 'k6.cand7@candidate.ijbnet.org',  name: 'K6 Test Candidate 7',  code: 'K6T-0007' },
      { email: 'k6.cand8@candidate.ijbnet.org',  name: 'K6 Test Candidate 8',  code: 'K6T-0008' },
      { email: 'k6.cand9@candidate.ijbnet.org',  name: 'K6 Test Candidate 9',  code: 'K6T-0009' },
      { email: 'k6.cand10@candidate.ijbnet.org', name: 'K6 Test Candidate 10', code: 'K6T-0010' },
      { email: 'k6.cand11@candidate.ijbnet.org', name: 'K6 Test Candidate 11', code: 'K6T-0011' },
      { email: 'k6.cand12@candidate.ijbnet.org', name: 'K6 Test Candidate 12', code: 'K6T-0012' },
      { email: 'k6.cand13@candidate.ijbnet.org', name: 'K6 Test Candidate 13', code: 'K6T-0013' },
      { email: 'k6.cand14@candidate.ijbnet.org', name: 'K6 Test Candidate 14', code: 'K6T-0014' },
      { email: 'k6.cand15@candidate.ijbnet.org', name: 'K6 Test Candidate 15', code: 'K6T-0015' },
      { email: 'k6.cand16@candidate.ijbnet.org', name: 'K6 Test Candidate 16', code: 'K6T-0016' },
      { email: 'k6.cand17@candidate.ijbnet.org', name: 'K6 Test Candidate 17', code: 'K6T-0017' },
      { email: 'k6.cand18@candidate.ijbnet.org', name: 'K6 Test Candidate 18', code: 'K6T-0018' },
      { email: 'k6.cand19@candidate.ijbnet.org', name: 'K6 Test Candidate 19', code: 'K6T-0019' },
      { email: 'k6.cand20@candidate.ijbnet.org', name: 'K6 Test Candidate 20', code: 'K6T-0020' },
      { email: 'k6.cand21@candidate.ijbnet.org', name: 'K6 Test Candidate 21', code: 'K6T-0021' },
      { email: 'k6.cand22@candidate.ijbnet.org', name: 'K6 Test Candidate 22', code: 'K6T-0022' },
      { email: 'k6.cand23@candidate.ijbnet.org', name: 'K6 Test Candidate 23', code: 'K6T-0023' },
      { email: 'k6.cand24@candidate.ijbnet.org', name: 'K6 Test Candidate 24', code: 'K6T-0024' },
      { email: 'k6.cand25@candidate.ijbnet.org', name: 'K6 Test Candidate 25', code: 'K6T-0025' },
      { email: 'k6.cand26@candidate.ijbnet.org', name: 'K6 Test Candidate 26', code: 'K6T-0026' },
      { email: 'k6.cand27@candidate.ijbnet.org', name: 'K6 Test Candidate 27', code: 'K6T-0027' },
      { email: 'k6.cand28@candidate.ijbnet.org', name: 'K6 Test Candidate 28', code: 'K6T-0028' },
      { email: 'k6.cand29@candidate.ijbnet.org', name: 'K6 Test Candidate 29', code: 'K6T-0029' },
      { email: 'k6.cand30@candidate.ijbnet.org', name: 'K6 Test Candidate 30', code: 'K6T-0030' },
      { email: 'k6.cand31@candidate.ijbnet.org', name: 'K6 Test Candidate 31', code: 'K6T-0031' },
      { email: 'k6.cand32@candidate.ijbnet.org', name: 'K6 Test Candidate 32', code: 'K6T-0032' },
      { email: 'k6.cand33@candidate.ijbnet.org', name: 'K6 Test Candidate 33', code: 'K6T-0033' },
      { email: 'k6.cand34@candidate.ijbnet.org', name: 'K6 Test Candidate 34', code: 'K6T-0034' },
      { email: 'k6.cand35@candidate.ijbnet.org', name: 'K6 Test Candidate 35', code: 'K6T-0035' },
      { email: 'k6.cand36@candidate.ijbnet.org', name: 'K6 Test Candidate 36', code: 'K6T-0036' },
      { email: 'k6.cand37@candidate.ijbnet.org', name: 'K6 Test Candidate 37', code: 'K6T-0037' },
      { email: 'k6.cand38@candidate.ijbnet.org', name: 'K6 Test Candidate 38', code: 'K6T-0038' },
      { email: 'k6.cand39@candidate.ijbnet.org', name: 'K6 Test Candidate 39', code: 'K6T-0039' },
      { email: 'k6.cand40@candidate.ijbnet.org', name: 'K6 Test Candidate 40', code: 'K6T-0040' },
      { email: 'k6.cand41@candidate.ijbnet.org', name: 'K6 Test Candidate 41', code: 'K6T-0041' },
      { email: 'k6.cand42@candidate.ijbnet.org', name: 'K6 Test Candidate 42', code: 'K6T-0042' },
      { email: 'k6.cand43@candidate.ijbnet.org', name: 'K6 Test Candidate 43', code: 'K6T-0043' },
      { email: 'k6.cand44@candidate.ijbnet.org', name: 'K6 Test Candidate 44', code: 'K6T-0044' },
      { email: 'k6.cand45@candidate.ijbnet.org', name: 'K6 Test Candidate 45', code: 'K6T-0045' },
      { email: 'k6.cand46@candidate.ijbnet.org', name: 'K6 Test Candidate 46', code: 'K6T-0046' },
      { email: 'k6.cand47@candidate.ijbnet.org', name: 'K6 Test Candidate 47', code: 'K6T-0047' },
      { email: 'k6.cand48@candidate.ijbnet.org', name: 'K6 Test Candidate 48', code: 'K6T-0048' },
      { email: 'k6.cand49@candidate.ijbnet.org', name: 'K6 Test Candidate 49', code: 'K6T-0049' },
      { email: 'k6.cand50@candidate.ijbnet.org', name: 'K6 Test Candidate 50', code: 'K6T-0050' },
    ];

    for (const acc of accounts) {
      // User record
      const [existingUser] = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email = '${acc.email}' LIMIT 1`,
      );
      let userId: string;
      if ((existingUser as { id: string }[]).length === 0) {
        userId = uuidv4();
        await queryInterface.bulkInsert('users', [
          {
            id: userId,
            email: acc.email,
            name: acc.name,
            role: 'candidate',
            passwordHash: hash,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        ]);
        console.log(`  ✓ created user ${acc.email}`);
      } else {
        userId = (existingUser as { id: string }[])[0]!.id;
        console.log(`  → user ${acc.email} already exists`);
      }

      // Candidate profile record
      const [existingCand] = await queryInterface.sequelize.query(
        `SELECT id FROM candidates WHERE candidateCode = '${acc.code}' LIMIT 1`,
      );
      if ((existingCand as { id: string }[]).length === 0) {
        await queryInterface.bulkInsert('candidates', [
          {
            id: userId,
            userId,
            candidateCode: acc.code,
            lpkId,
            profileStatus: 'approved',
            isLocked: false,
            consentGiven: true,
            consentGivenAt: now,
            fullName: acc.name,
            childrenCount: 0,
            accompany: 'none',
            sswKubun: 'SSW1',
            createdAt: now,
            updatedAt: now,
          },
        ]);
        console.log(`  ✓ created candidate profile ${acc.code}`);
      } else {
        console.log(`  → candidate ${acc.code} already exists`);
      }
    }

    console.log('K6 test candidates ready (50 accounts).');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const emails = [
      'k6.cand1@candidate.ijbnet.org',
      'k6.cand2@candidate.ijbnet.org',
      'k6.cand3@candidate.ijbnet.org',
      'k6.cand4@candidate.ijbnet.org',
      'k6.cand5@candidate.ijbnet.org',
      'k6.cand6@candidate.ijbnet.org',
      'k6.cand7@candidate.ijbnet.org',
      'k6.cand8@candidate.ijbnet.org',
      'k6.cand9@candidate.ijbnet.org',
      'k6.cand10@candidate.ijbnet.org',
      'k6.cand11@candidate.ijbnet.org',
      'k6.cand12@candidate.ijbnet.org',
      'k6.cand13@candidate.ijbnet.org',
      'k6.cand14@candidate.ijbnet.org',
      'k6.cand15@candidate.ijbnet.org',
      'k6.cand16@candidate.ijbnet.org',
      'k6.cand17@candidate.ijbnet.org',
      'k6.cand18@candidate.ijbnet.org',
      'k6.cand19@candidate.ijbnet.org',
      'k6.cand20@candidate.ijbnet.org',
      'k6.cand21@candidate.ijbnet.org',
      'k6.cand22@candidate.ijbnet.org',
      'k6.cand23@candidate.ijbnet.org',
      'k6.cand24@candidate.ijbnet.org',
      'k6.cand25@candidate.ijbnet.org',
      'k6.cand26@candidate.ijbnet.org',
      'k6.cand27@candidate.ijbnet.org',
      'k6.cand28@candidate.ijbnet.org',
      'k6.cand29@candidate.ijbnet.org',
      'k6.cand30@candidate.ijbnet.org',
      'k6.cand31@candidate.ijbnet.org',
      'k6.cand32@candidate.ijbnet.org',
      'k6.cand33@candidate.ijbnet.org',
      'k6.cand34@candidate.ijbnet.org',
      'k6.cand35@candidate.ijbnet.org',
      'k6.cand36@candidate.ijbnet.org',
      'k6.cand37@candidate.ijbnet.org',
      'k6.cand38@candidate.ijbnet.org',
      'k6.cand39@candidate.ijbnet.org',
      'k6.cand40@candidate.ijbnet.org',
      'k6.cand41@candidate.ijbnet.org',
      'k6.cand42@candidate.ijbnet.org',
      'k6.cand43@candidate.ijbnet.org',
      'k6.cand44@candidate.ijbnet.org',
      'k6.cand45@candidate.ijbnet.org',
      'k6.cand46@candidate.ijbnet.org',
      'k6.cand47@candidate.ijbnet.org',
      'k6.cand48@candidate.ijbnet.org',
      'k6.cand49@candidate.ijbnet.org',
      'k6.cand50@candidate.ijbnet.org',
    ];
    for (const email of emails) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT id FROM users WHERE email = '${email}' LIMIT 1`,
      );
      if ((rows as { id: string }[]).length > 0) {
        const id = (rows as { id: string }[])[0]!.id;
        await queryInterface.sequelize.query(`DELETE FROM candidates WHERE id = '${id}'`);
        await queryInterface.sequelize.query(`DELETE FROM users WHERE id = '${id}'`);
      }
    }
    await queryInterface.sequelize.query(
      `DELETE FROM sequelize_data WHERE name = '20250101000100-k6-test-candidates'`,
    );
  },
};
