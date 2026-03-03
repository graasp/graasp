import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MOCK_LOGGER } from '../../../test/app.vitest';
import { AccountType } from '../../types';
import { THUMBNAIL_MIMETYPE, ThumbnailSizeFormat } from './constants';
import { ThumbnailService } from './thumbnail.service';

const MockedFileService = vi.fn(function () {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  this.uploadMany = vi.fn();
});

const AUTHENTICATED_USER = {
  id: 'user-1',
  name: 'user 1',
  type: AccountType.Individual,
  isValidated: true,
};

const ITEM_ID = 'item-1';

describe('ThumbnailService.upload', () => {
  let thumbnailService: ThumbnailService;
  let mockFileService;

  beforeEach(() => {
    mockFileService = new MockedFileService();
    thumbnailService = new ThumbnailService(mockFileService, MOCK_LOGGER);
  });

  afterEach(() => {
    MockedFileService.mockClear();
  });

  describe('successful upload', () => {
    test('should upload thumbnails for all sizes', async () => {
      const mockFile = new PassThrough();
      mockFileService.uploadMany.mockResolvedValue([]);

      const uploadPromise = thumbnailService.upload(AUTHENTICATED_USER, ITEM_ID, mockFile);
      // Feed some data to the file stream
      mockFile.write(Buffer.from('test image data'));
      mockFile.end();

      await uploadPromise;

      // Verify uploadMany was called with correct structure
      expect(mockFileService.uploadMany).toHaveBeenCalledWith(
        AUTHENTICATED_USER,
        expect.arrayContaining([
          expect.objectContaining({
            filepath: expect.stringContaining(ITEM_ID),
            mimetype: THUMBNAIL_MIMETYPE,
            file: expect.any(Object),
          }),
        ]),
      );

      // Should have uploads for each size in ThumbnailSizeFormat
      const calls = mockFileService.uploadMany.mock.calls[0];
      expect(calls[1]).toHaveLength(Object.keys(ThumbnailSizeFormat).length);
    });

    test('should create thumbnails with correct filepaths', async () => {
      const mockFile = new PassThrough();
      mockFileService.uploadMany.mockResolvedValue([]);

      const uploadPromise = thumbnailService.upload(AUTHENTICATED_USER, ITEM_ID, mockFile);
      mockFile.write(Buffer.from('test'));
      mockFile.end();

      await uploadPromise;

      const [, filesToUpload] = mockFileService.uploadMany.mock.calls[0];
      const filepaths = filesToUpload.map((f: { filepath: string }) => f.filepath);

      // All paths should include the ITEM_ID
      expect(filepaths.every((p: string) => p.includes(ITEM_ID))).toBe(true);
      // All paths should include the thumbnails prefix
      expect(filepaths.every((p: string) => p.includes('thumbnails'))).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle file stream errors gracefully', async () => {
      const mockFile = new PassThrough();

      mockFileService.uploadMany.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve([]);
          }, 1000);
        });
      });

      // Should handle error and log it
      await expect(async () => {
        thumbnailService.upload(AUTHENTICATED_USER, ITEM_ID, mockFile);
        // Emit error on file stream
        // rejects with undefined error to avoid image stream error to be caught by vitest
        mockFile.emit('error');
      }).rejects.toThrow();

      mockFile.destroy();
    });

    test('should handle upload service errors', async () => {
      const mockFile = new PassThrough();

      // rejects with undefined to avoid image stream error to be caught by vitest
      mockFileService.uploadMany.mockRejectedValue();

      await expect(() =>
        thumbnailService.upload(AUTHENTICATED_USER, ITEM_ID, mockFile),
      ).rejects.toThrow('S3 upload failed');
      mockFile.destroy();
    });
  });

  describe('listener cleanup', () => {
    test('should remove all listeners after successful upload', async () => {
      const mockFile = new PassThrough();
      mockFileService.uploadMany.mockResolvedValue([]);

      const uploadPromise = thumbnailService.upload(AUTHENTICATED_USER, ITEM_ID, mockFile);

      expect(mockFile.listenerCount('error')).toEqual(1);

      mockFile.write(Buffer.from('test'));
      mockFile.end();
      await uploadPromise;

      expect(mockFile.listenerCount('error')).toEqual(0);
    });

    test('should remove all listeners even on error', async () => {
      const mockFile = new PassThrough();

      // rejects with undefined to avoid image stream error to be caught by vitest
      mockFileService.uploadMany.mockRejectedValue();

      const uploadPromise = thumbnailService.upload(AUTHENTICATED_USER, ITEM_ID, mockFile);
      expect(mockFile.listenerCount('error')).toEqual(1);
      mockFile.write(Buffer.from('test'));
      mockFile.end();

      // trigger errors
      await expect(uploadPromise).rejects.toThrow('Upload failed');

      expect(mockFile.listenerCount('error')).toBe(0);

      mockFile.destroy();
    });
  });
});
