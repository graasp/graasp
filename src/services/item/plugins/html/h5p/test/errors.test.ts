import { StatusCodes } from 'http-status-codes';

import { ItemFactory } from '../../../../../../../test/factories/item.factory';
import { HtmlImportError, HtmlItemNotFoundError } from '../../errors';
import { H5PInvalidFileError } from '../errors';

const MOCK_ITEM = ItemFactory({});

describe('Custom errors', () => {
  it('builds correct InvalidH5PFileError', () => {
    const error = new H5PInvalidFileError(MOCK_ITEM);

    expect(error.code).toEqual('GPH5PERR001');
    expect(error.message).toEqual('File is not a valid H5P package');
    expect(error.statusCode).toEqual(StatusCodes.BAD_REQUEST);
  });

  it('builds correct HtmlItemNotFoundError', () => {
    const error = new HtmlItemNotFoundError(MOCK_ITEM);

    expect(error.code).toEqual('GPHTMLERR002');
    expect(error.message).toEqual('Html item not found');
    expect(error.statusCode).toEqual(StatusCodes.NOT_FOUND);
  });

  it('builds correct HtmlImportError', () => {
    const error = new HtmlImportError();

    expect(error.code).toEqual('GPHTMLERR003');
    expect(error.message).toEqual('Unexpected server error while importing Html');
    expect(error.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
  });
});
