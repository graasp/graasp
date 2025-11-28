import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

import { MOCK_LOGGER } from '../../../../../test/app.vitest';
import { WSDoc } from './WSDoc';

const conn1 = {
  on: vi.fn(),
  close: vi.fn(),
} as unknown as WebSocket;

const conn2 = {
  on: vi.fn(),
  close: vi.fn(),
} as unknown as WebSocket;

describe('WSDoc', () => {
  it('closeConn destroy observers when no one is connected to it', () => {
    const doc = new WSDoc(null as never, 'test', false, MOCK_LOGGER);
    const initNbObservers = doc._observers.size;
    expect(initNbObservers).toBeGreaterThan(0);

    doc.addConnection(conn1);
    doc.addConnection(conn2);

    doc.closeConn(conn1);

    // observers should still exist
    expect(doc._observers.size).toEqual(initNbObservers);

    doc.closeConn(conn2);

    // observer should be removed
    expect(doc._observers.size).toEqual(0);
  });
});
