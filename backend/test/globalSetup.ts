import { setupTestDb, teardownTestDb } from './testDbSetup';

export default async function globalSetup() {
  await setupTestDb();

  return async () => {
    await teardownTestDb();
  };
}
