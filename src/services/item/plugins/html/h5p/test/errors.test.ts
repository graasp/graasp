import { StatusCodes } from 'http-status-codes';

import { Item } from '../../../../entities/Item.js';
import { HtmlImportError, HtmlItemNotFoundError } from '../../errors.js';
import { H5PInvalidFileError } from '../errors.js';

const MOCK_ITEM = new Item();

describe('Custom errors', () => {
  it('builds correct InvalidH5PFileError', () => {
    const error = new H5PInvalidFileError(MOCK_ITEM);

    expect(error.code).toEqual('GPH5PERR001');
    expect(error.data).toEqual(MOCK_ITEM);
    expect(error.message).toEqual('File is not a valid H5P package');
    expect(error.origin).toEqual('graasp-plugin-html');
    expect(error.statusCode).toEqual(StatusCodes.BAD_REQUEST);
  });

  it('builds correct HtmlItemNotFoundError', () => {
    const error = new HtmlItemNotFoundError(MOCK_ITEM);

    expect(error.code).toEqual('GPHTMLERR002');
    expect(error.data).toEqual(MOCK_ITEM);
    expect(error.message).toEqual('Html item not found');
    expect(error.origin).toEqual('graasp-plugin-html');
    expect(error.statusCode).toEqual(StatusCodes.NOT_FOUND);
  });

  it('builds correct HtmlImportError', () => {
    const error = new HtmlImportError();

    expect(error.code).toEqual('GPHTMLERR003');
    expect(error.data).toBeUndefined();
    expect(error.message).toEqual('Unexpected server error while importing Html');
    expect(error.origin).toEqual('graasp-plugin-html');
    expect(error.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
  });
});
