import { QueryInterface } from 'sequelize';

const ID_MONTHS: Record<string, string> = {
  januari: '01', februari: '02', maret: '03', april: '04',
  mei: '05', juni: '06', juli: '07', agustus: '08',
  september: '09', oktober: '10', november: '11', desember: '12',
};

function parseStartDate(period: string): string | null {
  // Normalise separators: em dash, en dash, hyphen surrounded by spaces or not
  const start = period.split(/\s*[–—-]\s*/)[0].trim();
  // Match "MonthName YYYY" — month name may be multi-word (none in ID, but safe)
  const m = start.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (!m) return null;
  const monthStr = ID_MONTHS[m[1].toLowerCase()];
  if (!monthStr) return null;
  return `${m[2]}-${monthStr}-01`;
}

export async function up(queryInterface: QueryInterface): Promise<void> {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT id, period FROM candidate_careers WHERE startDate IS NULL AND period IS NOT NULL AND period != ''`,
  ) as [Array<{ id: string; period: string }>, unknown];

  console.log(`[migration 000029] Found ${rows.length} career entries to backfill.`);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const startDate = parseStartDate(row.period);
    if (startDate) {
      await queryInterface.sequelize.query(
        `UPDATE candidate_careers SET startDate = ? WHERE id = ?`,
        { replacements: [startDate, row.id] },
      );
      updated++;
    } else {
      console.warn(`[migration 000029] Could not parse period: "${row.period}" (id: ${row.id})`);
      skipped++;
    }
  }

  console.log(`[migration 000029] Done — updated: ${updated}, skipped (unparseable): ${skipped}`);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Clear all backfilled dates (those set to the 1st of the month, which is our convention)
  await queryInterface.sequelize.query(
    `UPDATE candidate_careers SET startDate = NULL WHERE DAY(startDate) = 1`,
  );
}
