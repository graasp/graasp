import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { ErrorFactory, FAILURE_MESSAGES } from '@graasp/sdk';

export function buildError(err: unknown) {
  if (err instanceof Error) {
    return err;
  }
  return new Error(String(err));
}

export const ConfigurationError = ErrorFactory('config');

export const CoreError = ErrorFactory('core');

export const ItemNotFound = createError(
  'GERR001',
  FAILURE_MESSAGES.ITEM_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

export class MemberCannotReadItem extends CoreError {
  constructor(itemId: string) {
    super(
      {
        code: 'GERR002',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.USER_CANNOT_READ_ITEM,
      },
      itemId,
    );
  }
}
export class MemberCannotWriteItem extends CoreError {
  constructor(itemId: string) {
    super(
      {
        code: 'GERR003',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.USER_CANNOT_WRITE_ITEM,
      },
      itemId,
    );
  }
}
export class MemberCannotAdminItem extends CoreError {
  constructor(itemId: string) {
    super(
      {
        code: 'GERR004',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.USER_CANNOT_ADMIN_ITEM,
      },
      itemId,
    );
  }
}
export class InvalidMembership extends CoreError {
  constructor(data?: { itemId: string; accountId: string; permission: string }) {
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
  constructor(data?: { id?: string; path?: string }) {
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
export class ModifyExistingMembership extends CoreError {
  constructor(data?: { id: string }) {
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
  constructor(data?: string) {
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
  constructor() {
    super({
      code: 'GERR009',
      statusCode: StatusCodes.FORBIDDEN,
      message: FAILURE_MESSAGES.HIERARCHY_TOO_DEEP,
    });
  }
}
export class TooManyChildren extends CoreError {
  constructor() {
    super({
      code: 'GERR010',
      statusCode: StatusCodes.FORBIDDEN,
      message: FAILURE_MESSAGES.TOO_MANY_CHILDREN,
    });
  }
}
export class TooManyDescendants extends CoreError {
  constructor(data: number) {
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
  constructor(data?: string) {
    super(
      {
        code: 'GERR012',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_MOVE_TARGET,
      },
      data,
    );
  }
}

export const MemberNotFound = createError('GERR013', 'MEMBER_NOT_FOUND', StatusCodes.NOT_FOUND);

export class CannotModifyOtherMembers extends CoreError {
  constructor(member: { id: string }) {
    super(
      {
        code: 'GERR014',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.CANNOT_MODIFY_OTHER_MEMBERS,
      },
      member.id,
    );
  }
}

export class MemberCannotAccess extends CoreError {
  constructor(itemId: string) {
    super(
      {
        code: 'GERR016',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.MEMBER_CANNOT_ACCESS,
      },
      itemId,
    );
  }
}

export class MemberAlreadySignedUp extends CoreError {
  constructor(data: { email: string }) {
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
  constructor(data: { email: string }) {
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
  constructor() {
    super({
      code: 'GERR019',
      statusCode: StatusCodes.NOT_ACCEPTABLE,
      message: FAILURE_MESSAGES.MEMBER_WITHOUT_PASSWORD,
    });
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

export class InvalidPassword extends CoreError {
  constructor() {
    // this status code is custom for the browser to know it needs to refresh its token
    super({
      code: 'GERR025',
      statusCode: StatusCodes.UNAUTHORIZED,
      message: FAILURE_MESSAGES.INVALID_PASSWORD,
    });
  }
}

export class EmptyCurrentPassword extends CoreError {
  constructor() {
    // this status code is custom for the browser to know it needs to refresh its token
    super({
      code: 'GERR026',
      statusCode: StatusCodes.BAD_REQUEST,
      message: FAILURE_MESSAGES.EMPTY_CURRENT_PASSWORD,
    });
  }
}

export class UnauthorizedMember extends CoreError {
  constructor() {
    // this status code is custom for the browser to know it needs to refresh its token
    super({
      code: 'GERR027',
      statusCode: StatusCodes.UNAUTHORIZED,
      message: 'Unauthorized member',
    });
  }
}

export class AuthenticationError extends CoreError {
  constructor() {
    super({
      code: 'GERR028',
      statusCode: StatusCodes.UNAUTHORIZED,
      message: 'The authentication failed',
    });
  }
}

export class ItemNotFolder extends CoreError {
  constructor(parent: { id: string }) {
    super(
      {
        code: 'GERR029',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Item is not a folder',
      },
      parent.id,
    );
  }
}

export class CannotDeleteOnlyAdmin extends CoreError {
  constructor(item: { id: string }) {
    super(
      {
        code: 'GERR030',
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Cannot delete the only admin on item',
      },
      item.id,
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

export class CannotReorderRootItem extends CoreError {
  constructor(itemId: string) {
    super(
      {
        code: 'GERR034',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Cannot reorder items at root',
      },
      itemId,
    );
  }
}

export class CannotModifyGuestItemMembership extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR035',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.CANNOT_MODIFY_GUEST_ITEM_MEMBERSHIP,
      },
      data,
    );
  }
}

export class NothingToUpdateItem extends CoreError {
  constructor() {
    super({
      code: 'GERR036',
      statusCode: StatusCodes.BAD_REQUEST,
      message: FAILURE_MESSAGES.NOTHING_TO_UPDATE_ITEM,
    });
  }
}

export class BadCredentials extends CoreError {
  constructor() {
    super({
      code: 'GERR037',
      statusCode: StatusCodes.UNAUTHORIZED,
      message: FAILURE_MESSAGES.BAD_CREDENTIALS,
    });
  }
}

export class UnexpectedError extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR999',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: FAILURE_MESSAGES.UNEXPECTED_ERROR,
      },
      data,
    );
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
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR,
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
    super({ code: 'GERR1004', message: message, statusCode: StatusCodes.TOO_MANY_REQUESTS });
  }
}

export class OpenAIBadVersion extends OpenAIBaseError {
  constructor(gptVersion: string, validVersions: string) {
    const message = `The gpt-version '${gptVersion}' is not a valid version. Try one of these instead: "${validVersions}".`;
    super({ code: 'GERR1005', message: message, statusCode: StatusCodes.BAD_REQUEST });
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

export class InsufficientPermission extends CoreError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR1012',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.INSUFFICIENT_PERMISSION,
      },
      data,
    );
  }
}
