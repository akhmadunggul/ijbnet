import { QueryInterface } from 'sequelize';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Three dedicated load-test candidate accounts.
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
      { email: 'k6.cand1@candidate.ijbnet.org', name: 'K6 Test Candidate 1', code: 'K6T-0001' },
      { email: 'k6.cand2@candidate.ijbnet.org', name: 'K6 Test Candidate 2', code: 'K6T-0002' },
      { email: 'k6.cand3@candidate.ijbnet.org', name: 'K6 Test Candidate 3', code: 'K6T-0003' },
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
            id: userId,            // reuse userId as candidateId for simplicity
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

    console.log('K6 test candidates ready.');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    const emails = [
      'k6.cand1@candidate.ijbnet.org',
      'k6.cand2@candidate.ijbnet.org',
      'k6.cand3@candidate.ijbnet.org',
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
