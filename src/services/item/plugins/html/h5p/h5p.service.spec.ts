import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemberFactory } from '../../../../../../test/factories/member.factory';
import { BaseLogger } from '../../../../../logger';
import { StorageService } from '../../../../member/plugins/storage/memberStorage.service';
import { H5PItem } from '../../../item';
import { ItemRepository } from '../../../item.repository';
import { ItemService } from '../../../item.service';
import { H5P_FILE_DOT_EXTENSION } from './constants';
import { H5PService } from './h5p.service';

// lightweight stub for repository
const mockItemRepository = {
  updateOne: vi.fn().mockResolvedValue(undefined),
} as unknown as ItemRepository;

const logger = console as unknown as BaseLogger;

// helper to create fresh service for each test
function createService() {
  return new H5PService({} as ItemService, {} as StorageService, mockItemRepository, logger);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MOCK_DB = {} as any;

describe('H5P Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('copy should move both package and content and update repository', async () => {
    const newCid = 'mocked-uuid';
    vi.mock('uuid', () => ({
      v4: vi.fn(() => 'mocked-uuid'),
    }));

    const h5pService = createService();
    const member = MemberFactory();

    const original = {
      id: 'orig-id',
      name: `MyPackage${H5P_FILE_DOT_EXTENSION}`,
      extra: {
        h5p: {
          h5pFilePath: 'orig-root/origFile.h5p',
          contentFilePath: 'orig-root/content',
        },
      },
    } as H5PItem;

    const copyItem = { id: 'copy-id' } as H5PItem;

    vi.spyOn(h5pService.fileService, 'copy').mockResolvedValue('copy-value');
    vi.spyOn(h5pService.fileService, 'copyFolder').mockResolvedValue('folder-path');

    await h5pService.copy(MOCK_DB, member, { original, copy: copyItem });

    const baseName = path.basename(original.name, H5P_FILE_DOT_EXTENSION);
    const expectedName = `${baseName}-1`;

    // repository should be updated with new name and paths
    expect(mockItemRepository.updateOne).toHaveBeenCalled();
    const updateCall = (mockItemRepository.updateOne as any).mock.calls[0];
    const [_db, itemId, updateData] = updateCall;

    expect(itemId).toBe(copyItem.id);
    expect(updateData.name).toBe('MyPackage-1');
    expect(updateData.extra.h5p.contentId).toBe('mocked-uuid');
    expect(updateData.extra.h5p.contentFilePath).toBe(h5pService.buildContentPath(newCid));
    expect(updateData.extra.h5p.h5pFilePath).toBe(
      h5pService.buildPackagePath(newCid, expectedName),
    );
  });
});
