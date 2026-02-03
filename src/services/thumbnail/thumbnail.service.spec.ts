import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { MOCK_LOGGER } from '../../../test/app.vitest';
import { AccountType } from '../../types';
import { THUMBNAIL_MIMETYPE, ThumbnailSizeFormat } from './constants';
import { ThumbnailService } from './thumbnail.service';

const MockedFileService = vi.fn(function () {
  this.uploadMany = vi.fn();
});

const AUTHENTICATED_USER = {
  id: 'user-1',
  name: 'user 1',
  type: AccountType.Individual,
  isValidated: true,
};

describe('ThumbnailService.upload', () => {
  let thumbnailService: ThumbnailService;
  let mockFileService: any;

  beforeEach(() => {
    mockFileService = new MockedFileService();

    thumbnailService = new ThumbnailService(mockFileService, MOCK_LOGGER);
  });

  afterEach(() => {
    MockedFileService.mockClear();
  });

  describe('successful upload', () => {
    test('should upload thumbnails for all sizes', async () => {
      const mockUser = AUTHENTICATED_USER;
      const itemId = 'item-1';
      const mockFile = new PassThrough();

      mockFileService.uploadMany.mockResolvedValue([]);

      const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);

      // Feed some data to the file stream
      mockFile.write(Buffer.from('test image data'));
      mockFile.end();

      await uploadPromise;

      // Verify uploadMany was called with correct structure
      expect(mockFileService.uploadMany).toHaveBeenCalledWith(
        mockUser,
        expect.arrayContaining([
          expect.objectContaining({
            filepath: expect.stringContaining(itemId),
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
      const mockUser = AUTHENTICATED_USER;
      const itemId = 'item-123';
      const mockFile = new PassThrough();

      mockFileService.uploadMany.mockResolvedValue([]);

      const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);
      mockFile.write(Buffer.from('test'));
      mockFile.end();

      await uploadPromise;

      const [, filesToUpload] = mockFileService.uploadMany.mock.calls[0];
      const filepaths = filesToUpload.map((f: any) => f.filepath);

      // All paths should include the itemId
      expect(filepaths.every((p: string) => p.includes(itemId))).toBe(true);
      // All paths should include the thumbnails prefix
      expect(filepaths.every((p: string) => p.includes('thumbnails'))).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle file stream errors gracefully', async () => {
      const mockUser = AUTHENTICATED_USER;
      const itemId = 'item-1';
      const mockFile = new PassThrough();

      mockFileService.uploadMany.mockResolvedValue([]);

      const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);

      // Emit error on file stream
      const fileError = new Error('File read error');
      mockFile.destroy(fileError);

      // Should handle error and log it
      await expect(uploadPromise).rejects.toThrow('File read error');
    });

    test('should handle upload service errors', async () => {
      const mockUser = AUTHENTICATED_USER;
      const itemId = 'item-1';
      const mockFile = new PassThrough();

      const uploadError = new Error('S3 upload failed');
      mockFileService.uploadMany.mockRejectedValue(uploadError);

      const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);
      mockFile.write(Buffer.from('test'));
      mockFile.end();

      await expect(uploadPromise).rejects.toThrow('S3 upload failed');
    });

    // test('should handle image sharp errors', async () => {
    //   const mockUser = AUTHENTICATED_USER;
    //   const itemId = 'item-1';
    //   const mockFile = new PassThrough();

    //   mockFileService.uploadMany.mockImplementation(() => {
    //     return new Promise((resolve) => {
    //       // Simulate async behavior
    //       setTimeout(resolve, 10);
    //     });
    //   });

    //   const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);

    //   // Simulate an error on the image stream
    //   mockFile.write(Buffer.from('test'));
    //   mockFile.end();

    //   await uploadPromise;

    //   // The error handler should have been registered
    //   expect(mockLogger.debug).not.toHaveBeenCalledWith(
    //     expect.stringContaining('Could not upload'),
    //   );
    // });

    test('should call destroyAll on upload error', async () => {
      const mockUser = AUTHENTICATED_USER;
      const itemId = 'item-1';
      const mockFile = new PassThrough();

      const uploadError = new Error('Upload failed');
      mockFileService.uploadMany.mockRejectedValue(uploadError);

      const destroyAllSpy = vi.spyOn(thumbnailService as any, 'destroyAll');

      const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);
      mockFile.write(Buffer.from('test'));
      mockFile.end();

      await expect(uploadPromise).rejects.toThrow('Upload failed');
      expect(destroyAllSpy).toHaveBeenCalled();

      destroyAllSpy.mockRestore();
    });
  });

  describe('listener cleanup', () => {
    test('should remove all listeners after successful upload', async () => {
      const mockUser = AUTHENTICATED_USER;
      const itemId = 'item-1';
      const mockFile = new PassThrough();

      mockFileService.uploadMany.mockResolvedValue([]);

      const removeListenersSpy = vi.spyOn(thumbnailService as any, 'removeListeners');

      const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);
      mockFile.write(Buffer.from('test'));
      mockFile.end();

      await uploadPromise;

      expect(removeListenersSpy).toHaveBeenCalled();
      removeListenersSpy.mockRestore();
    });

    test('should remove all listeners even on error', async () => {
      const mockUser = AUTHENTICATED_USER;
      const itemId = 'item-1';
      const mockFile = new PassThrough();

      const uploadError = new Error('Upload failed');
      mockFileService.uploadMany.mockRejectedValue(uploadError);

      const removeListenersSpy = vi.spyOn(thumbnailService as any, 'removeListeners');

      const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);
      mockFile.write(Buffer.from('test'));
      mockFile.end();

      await expect(uploadPromise).rejects.toThrow('Upload failed');

      expect(removeListenersSpy).toHaveBeenCalled();
      removeListenersSpy.mockRestore();
    });

    test('should not leak event listeners', async () => {
      const mockUser = AUTHENTICATED_USER;
      const itemId = 'item-1';
      const mockFile = new PassThrough();

      mockFileService.uploadMany.mockResolvedValue([]);

      const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);
      mockFile.write(Buffer.from('test'));
      mockFile.end();

      await uploadPromise;

      // File stream should have minimal listeners after cleanup
      const fileListeners = mockFile.listenerCount('error');
      expect(fileListeners).toBe(0);
    });
  });

  describe('abort/destroy scenarios', () => {
    test('should handle stream destruction gracefully', async () => {
      const mockUser = AUTHENTICATED_USER;
      const itemId = 'item-1';
      const mockFile = new PassThrough();

      mockFileService.uploadMany.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            // Simulate abort by destroying the file stream
            mockFile.destroy(new Error('ABORT_ERR'));
          }, 10);
        });
      });

      const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);
      mockFile.write(Buffer.from('test'));
      mockFile.end();

      await expect(uploadPromise).rejects.toThrow();
    });

    test('should handle multiple error events without crashing', async () => {
      const mockUser = AUTHENTICATED_USER;
      const itemId = 'item-1';
      const mockFile = new PassThrough();

      mockFileService.uploadMany.mockImplementation(() => {
        return new Promise(() => {
          setTimeout(() => {
            mockFile.destroy(new Error('First error'));
            // Attempt to emit another error (should not crash)
            try {
              mockFile.emit('error', new Error('Second error'));
            } catch (_) {
              console.debug('Expected, stream is already destroyed');
            }
          }, 10);
        });
      });

      const uploadPromise = thumbnailService.upload(mockUser, itemId, mockFile);
      mockFile.write(Buffer.from('test'));
      mockFile.end();

      await expect(uploadPromise).rejects.toThrow();
    });
  });

  describe('concurrent uploads', () => {
    test('should handle multiple concurrent uploads without listener leaks', async () => {
      const mockUser = AUTHENTICATED_USER;

      mockFileService.uploadMany.mockResolvedValue([]);

      const uploads = Array.from({ length: 5 }, (_, i) => {
        const mockFile = new PassThrough();
        const uploadPromise = thumbnailService.upload(mockUser, `item-${i}`, mockFile);
        mockFile.write(Buffer.from(`test-${i}`));
        mockFile.end();
        return uploadPromise;
      });

      await Promise.all(uploads);

      expect(mockFileService.uploadMany).toHaveBeenCalledTimes(5);
    });

    test('should handle some uploads failing while others succeed', async () => {
      const mockUser = AUTHENTICATED_USER;

      // Alternate between success and failure
      let callCount = 0;
      mockFileService.uploadMany.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          return Promise.reject(new Error('Upload failed'));
        }
        return Promise.resolve([]);
      });

      const results = await Promise.allSettled([
        (async () => {
          const mockFile = new PassThrough();
          const uploadPromise = thumbnailService.upload(mockUser, 'item-0', mockFile);
          mockFile.write(Buffer.from('test-0'));
          mockFile.end();
          return uploadPromise;
        })(),
        (async () => {
          const mockFile = new PassThrough();
          const uploadPromise = thumbnailService.upload(mockUser, 'item-1', mockFile);
          mockFile.write(Buffer.from('test-1'));
          mockFile.end();
          return uploadPromise;
        })(),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });
});
