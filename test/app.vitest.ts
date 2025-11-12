import { vi } from 'vitest';

import { BaseLogger } from '../src/logger';

export const MOCK_LOGGER = {
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
} as unknown as BaseLogger;
