import { StatusCodes } from 'http-status-codes';

import {
  H5PImportError,
  H5PItemMissingExtraError,
  H5PItemNotFoundError,
  InvalidH5PFileError,
} from '../src/errors';
import { MOCK_ITEM } from './fixtures';

describe('Custom errors', () => {
  it('builds correct InvalidH5PFileError', () => {
    const error = new InvalidH5PFileError(MOCK_ITEM);

    expect(error.code).toEqual('GPH5PERR001');
    expect(error.data).toEqual(MOCK_ITEM);
    expect(error.message).toEqual('File is not a valid H5P package');
    expect(error.origin).toEqual('graasp-plugin-h5p');
    expect(error.statusCode).toEqual(StatusCodes.BAD_REQUEST);
  });

  it('builds correct H5PItemNotFoundError', () => {
    const error = new H5PItemNotFoundError(MOCK_ITEM);

    expect(error.code).toEqual('GPH5PERR002');
    expect(error.data).toEqual(MOCK_ITEM);
    expect(error.message).toEqual('H5P item not found');
    expect(error.origin).toEqual('graasp-plugin-h5p');
    expect(error.statusCode).toEqual(StatusCodes.NOT_FOUND);
  });

  it('builds correct H5PItemMissingExtraError', () => {
    const error = new H5PItemMissingExtraError(MOCK_ITEM);

    expect(error.code).toEqual('GPH5PERR003');
    expect(error.data).toEqual(MOCK_ITEM);
    expect(error.message).toEqual('H5P item missing required extra');
    expect(error.origin).toEqual('graasp-plugin-h5p');
    expect(error.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  it('builds correct H5PImportError', () => {
    const error = new H5PImportError();

    expect(error.code).toEqual('GPH5PERR004');
    expect(error.data).toBeUndefined();
    expect(error.message).toEqual('Unexpected server error while importing H5P');
    expect(error.origin).toEqual('graasp-plugin-h5p');
    expect(error.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
  });
});
