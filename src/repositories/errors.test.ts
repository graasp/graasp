import { Item } from '../services/item/entities/Item';
import {
  EntryNotFoundAfterInsertException,
  EntryNotFoundAfterUpdateException,
  EntryNotFoundBeforeDeleteException,
} from './errors';
import { EntryNotFoundFactory, OpEntryNotFound } from './utils';

// Checks that EntryNotFound errors display the entity's name only.
describe('Repository Errors', () => {
  it('EntryNotFoundAfterInsertException', () => {
    expect(new EntryNotFoundAfterInsertException(Item).message).toBe(
      EntryNotFoundFactory('Item', OpEntryNotFound.CREATE),
    );
  });

  it('EntryNotFoundAfterUpdateException', () => {
    expect(new EntryNotFoundAfterUpdateException(Item).message).toBe(
      EntryNotFoundFactory('Item', OpEntryNotFound.UPDATE),
    );
  });

  it('EntryNotFoundBeforeDeleteException', () => {
    expect(new EntryNotFoundBeforeDeleteException(Item).message).toBe(
      EntryNotFoundFactory('Item', OpEntryNotFound.DELETE),
    );
  });
});
