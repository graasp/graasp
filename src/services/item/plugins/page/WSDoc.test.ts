import { WebSocket } from 'ws';

import { MOCK_LOGGER } from '../../../../../test/app';
import { WSDoc } from './WSDoc';

const conn1 = {
  on: jest.fn(),
  close: jest.fn(),
} as unknown as WebSocket;

const conn2 = {
  on: jest.fn(),
  close: jest.fn(),
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
