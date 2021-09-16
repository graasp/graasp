import { v4 as uuidv4 } from 'uuid';
import { extractChildId } from '../src/services/item-memberships/ws/hooks';
import { getParentId } from '../src/services/items/ws/hooks';

// generates an item path as represented in database
const dbItemPath = (...ids: string[]) => ids.join('.').replace(/-/g, '_');

test('get parent id', () => {
  const parent = uuidv4();
  const child = uuidv4();
  expect(getParentId(dbItemPath(parent, child))).toBe(parent);
  expect(getParentId(dbItemPath(child))).toBe(undefined);
});

test('extract child id', () => {
  const parent = uuidv4();
  const child = uuidv4();
  expect(extractChildId(dbItemPath(parent, child))).toBe(child);
  expect(extractChildId(dbItemPath(child))).toBe(child);
});
