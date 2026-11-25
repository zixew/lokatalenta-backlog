import { openDatabase, seedDatabaseIfEmpty } from '../server/db.ts';
import { tursoAdapter } from '../server/tursoAdapter.ts';

async function main(): Promise<void> {
  const startMs = Date.now();
  const db = openDatabase();
  const seeded = seedDatabaseIfEmpty(db);

  let tursoSynced = false;
  if (tursoAdapter.isConfigured) {
    await tursoAdapter.ensureSchema();
    const existingCount = await tursoAdapter.pullToLocal(db);
    if (existingCount === 0) {
      await tursoAdapter.pushFromLocal(db);
    }
    tursoSynced = true;
  }

  db.close();
  const elapsedMs = Date.now() - startMs;

  console.log(
    JSON.stringify({
      ok: true,
      service: 'lokatalenta-backlog',
      seededInitialData: seeded,
      tursoSynced,
      elapsedMs,
    }),
  );
}

main().catch((err) => {
  console.error('[db:migrate] failed:', err);
  process.exitCode = 1;
});
