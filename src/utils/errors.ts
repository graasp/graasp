import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

export const ConfigurationError = ErrorFactory('config');

export class ExpectedEnvVariable extends Error {
  constructor(envVarName: string) {
    super(`Expected to find env variable "${envVarName}" but it was undefined.`);
    this.name = 'MissingEnvVar';
  }
}

export const CoreError = ErrorFactory('core');

export class ItemNotFound extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR001',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.ITEM_NOT_FOUND,
      },
      data,
    );
  }
}
export class MemberCannotReadItem extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR002',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.USER_CANNOT_READ_ITEM,
      },
      data,
    );
  }
}
export class MemberCannotWriteItem extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR003',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.USER_CANNOT_WRITE_ITEM,
      },
      data,
    );
  }
}
export class MemberCannotAdminItem extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR004',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.USER_CANNOT_ADMIN_ITEM,
      },
      data,
    );
  }
}
export class InvalidMembership extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR005',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_MEMBERSHIP,
      },
      data,
    );
  }
}
export class ItemMembershipNotFound extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR006',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.ITEM_MEMBERSHIP_NOT_FOUND,
      },
      data,
    );
  }
}
export class ModifyExisting extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR007',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.MODIFY_EXISTING,
      },
      data,
    );
  }
}
export class InvalidPermissionLevel extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR008',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_PERMISSION_LEVEL,
      },
      data,
    );
  }
}
export class HierarchyTooDeep extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR009',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.HIERARCHY_TOO_DEEP,
      },
      data,
    );
  }
}
export class TooManyChildren extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR010',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.TOO_MANY_CHILDREN,
      },
      data,
    );
  }
}
export class TooManyDescendants extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR011',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.TOO_MANY_DESCENDANTS,
      },
      data,
    );
  }
}
export class InvalidMoveTarget extends CoreError {
  constructor(data?: unknown) {
    super(
      { code: 'GERR012', statusCode: 400, message: FAILURE_MESSAGES.INVALID_MOVE_TARGET },
      data,
    );
  }
}
export class MemberNotFound extends CoreError {
  constructor(data?: unknown) {
    super({ code: 'GERR013', statusCode: 404, message: FAILURE_MESSAGES.MEMBER_NOT_FOUND }, data);
  }
}
export class CannotModifyOtherMembers extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR014',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.CANNOT_MODIFY_OTHER_MEMBERS,
      },
      data,
    );
  }
}
export class TooManyMemberships extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR015',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.TOO_MANY_MEMBERSHIP,
      },
      data,
    );
  }
}
export class MemberCannotAccess extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR016',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.MEMBER_CANNOT_ACCESS,
      },
      data,
    );
  }
}

export class MemberAlreadySignedUp extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR017',
        statusCode: StatusCodes.CONFLICT,
        message: FAILURE_MESSAGES.MEMBER_ALREADY_SIGNED_UP,
      },
      data,
    );
  }
}

export class MemberNotSignedUp extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR018',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.MEMBER_NOT_SIGNED_UP,
      },
      data,
    );
  }
}

export class MemberWithoutPassword extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR019',
        statusCode: StatusCodes.NOT_ACCEPTABLE,
        message: FAILURE_MESSAGES.MEMBER_WITHOUT_PASSWORD,
      },
      data,
    );
  }
}

export class IncorrectPassword extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR020',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.INCORRECT_PASSWORD,
      },
      data,
    );
  }
}

export class TokenExpired extends CoreError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super({ code: 'GERR021', statusCode: 439, message: FAILURE_MESSAGES.TOKEN_EXPIRED }, data);
  }
}

export class ChallengeFailed extends CoreError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      { code: 'GERR021', statusCode: StatusCodes.UNAUTHORIZED, message: 'challenge fail' },
      data,
    );
  }
}

export class InvalidToken extends CoreError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      {
        code: 'GERR022',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.INVALID_TOKEN,
      },
      data,
    );
  }
}

export class InvalidSession extends CoreError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      {
        code: 'GERR023',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.INVALID_SESSION,
      },
      data,
    );
  }
}

export class OrphanSession extends CoreError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      {
        code: 'GERR024',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.ORPHAN_SESSION,
      },
      data,
    );
  }
}

export class InvalidPassword extends CoreError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      {
        code: 'GERR025',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.INVALID_PASSWORD,
      },
      data,
    );
  }
}

export class EmptyCurrentPassword extends CoreError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      {
        code: 'GERR026',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.EMPTY_CURRENT_PASSWORD,
      },
      data,
    );
  }
}

export class UnauthorizedMember extends CoreError {
  constructor(_data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super({
      code: 'GERR027',
      statusCode: StatusCodes.UNAUTHORIZED,
      message: 'Unauthorized member',
    });
  }
}

export class EmailNotAllowed extends CoreError {
  constructor(data?: unknown) {
    super(
      { code: 'GERR027', statusCode: 403, message: 'Your email is not allowed to sign up' },
      data,
    );
  }
}

export class AuthenticationError extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR028',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'The authentication failed',
      },
      data,
    );
  }
}

export class ItemNotFolder extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR029',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Item is not a folder',
      },
      data,
    );
  }
}

export class CannotDeleteOnlyAdmin extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR030',
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Cannot delete the only admin on item',
      },
      data,
    );
  }
}

export class MissingNameOrTypeForItemError extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR031',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Name and type should be defined',
      },
      data,
    );
  }
}

export class InvalidItemError extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR032',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'path should be defined',
      },
      data,
    );
  }
}

export class NoFileProvided extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR033',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Expected a file to be present in the request, found none',
      },
      data,
    );
  }
}

export class DatabaseError extends CoreError {
  constructor(data?: unknown) {
    super({ code: 'GERR998', statusCode: 500, message: FAILURE_MESSAGES.DATABASE_ERROR }, data);
  }
}

export class UnexpectedError extends CoreError {
  constructor(data?: unknown) {
    super({ code: 'GERR999', statusCode: 500, message: FAILURE_MESSAGES.UNEXPECTED_ERROR }, data);
    this.origin = 'unknown';
  }
}

interface OpenAIParamsError {
  message?: string;
  code?: string;
  statusCode?: number;
}

export class OpenAIBaseError extends CoreError {
  constructor({
    message = 'An unknown error occured',
    code = 'GERR1000',
    statusCode = 500,
  }: OpenAIParamsError = {}) {
    super({ code: code, statusCode: statusCode, message: message });
    this.origin = 'OpenAI';
  }
}

export class OpenAIUnknownStopError extends OpenAIBaseError {
  constructor(stopReason: string) {
    const message = `The stop reason "${stopReason}" is not a known OpenAI reason`;
    super({ code: 'GERR1001', message: message });
  }
}

export class OpenAILengthError extends OpenAIBaseError {
  constructor() {
    const message = 'Incomplete model output due to token limitation';
    super({ code: 'GERR1002', message: message });
  }
}

export class OpenAITimeOutError extends OpenAIBaseError {
  constructor() {
    const message = 'The response takes too long to respond';
    super({ code: 'GERR1003', message: message });
  }
}

export class OpenAIQuotaError extends OpenAIBaseError {
  constructor() {
    const message = 'This token exceeded current quota, please check plan and billing details.';
    super({ code: 'GERR1004', message: message, statusCode: 429 });
  }
}

export class OpenAIBadVersion extends OpenAIBaseError {
  constructor(gptVersion: string, validVersions: string) {
    const message = `The gpt-version '${gptVersion}' is not a valid version. Try one of these instead: "${validVersions}".`;
    super({ code: 'GERR1005', message: message, statusCode: 400 });
  }
}

export class InvalidJWTItem extends CoreError {
  constructor(jwtItemId: string, itemId: string) {
    const message = `The JWT item id '${jwtItemId}' does not correspond with the accessed item ${itemId}.`;
    super({ code: 'GERR1007', statusCode: StatusCodes.FORBIDDEN, message: message });
  }
}

export class ShortLinkNotFound extends CoreError {
  constructor(shortLink: string) {
    super(
      {
        code: 'GERR1009',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.SHORT_LINK_NOT_FOUND,
      },
      shortLink,
    );
    this.origin = 'shortLink';
  }
}

export class ShortLinkDuplication extends CoreError {
  constructor(shortLink: string) {
    super(
      {
        code: 'GERR1010',
        statusCode: StatusCodes.CONFLICT,
        message: FAILURE_MESSAGES.SHORT_LINK_ALREADY_EXISTS,
      },
      shortLink,
    );
    this.origin = 'shortLink';
  }
}

export class ShortLinkLimitExceed extends CoreError {
  constructor(itemId: string, platform: string) {
    super(
      {
        code: 'GERR1011',
        statusCode: StatusCodes.CONFLICT,
        message: FAILURE_MESSAGES.SHORT_LINK_LIMIT_EXCEED,
      },
      {
        itemId,
        platform,
      },
    );
    this.origin = 'shortLink';
  }
}
