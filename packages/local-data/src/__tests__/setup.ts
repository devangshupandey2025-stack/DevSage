import 'fake-indexeddb/auto';

import { beforeEach } from 'vitest';
import { clearAllData, seedIfNeeded } from '../seed/demo-data.js';

beforeEach(async () => {
  await clearAllData();
  await seedIfNeeded();
});