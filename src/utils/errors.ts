import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { FAILURE_MESSAGES } from '@graasp/sdk';

export function buildError(err: unknown) {
  if (err instanceof Error) {
    return err;
  }
  return new Error(String(err));
}

export const ItemNotFound = createError(
  'GERR001',
  FAILURE_MESSAGES.ITEM_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

export const MemberCannotReadItem = createError(
  'GERR002',
  FAILURE_MESSAGES.USER_CANNOT_READ_ITEM,
  StatusCodes.FORBIDDEN,
);

export const MemberCannotWriteItem = createError(
  'GERR003',
  FAILURE_MESSAGES.USER_CANNOT_WRITE_ITEM,
  StatusCodes.FORBIDDEN,
);

export const MemberCannotAdminItem = createError(
  'GERR004',
  FAILURE_MESSAGES.USER_CANNOT_ADMIN_ITEM,
  StatusCodes.FORBIDDEN,
);

export const InvalidMembership = createError(
  'GERR005',
  FAILURE_MESSAGES.INVALID_MEMBERSHIP,
  StatusCodes.BAD_REQUEST,
);

export const ItemMembershipNotFound = createError(
  'GERR006',
  FAILURE_MESSAGES.ITEM_MEMBERSHIP_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

export const ModifyExistingMembership = createError(
  'GERR007',
  FAILURE_MESSAGES.MODIFY_EXISTING,
  StatusCodes.BAD_REQUEST,
);

export const InvalidPermissionLevel = createError(
  'GERR008',
  FAILURE_MESSAGES.INVALID_PERMISSION_LEVEL,
  StatusCodes.BAD_REQUEST,
);

export const HierarchyTooDeep = createError(
  'GERR009',
  FAILURE_MESSAGES.HIERARCHY_TOO_DEEP,
  StatusCodes.FORBIDDEN,
);

export const TooManyChildren = createError(
  'GERR010',
  FAILURE_MESSAGES.TOO_MANY_CHILDREN,
  StatusCodes.FORBIDDEN,
);

export const TooManyDescendants = createError(
  'GERR011',
  FAILURE_MESSAGES.TOO_MANY_DESCENDANTS,
  StatusCodes.FORBIDDEN,
);

export const InvalidMoveTarget = createError(
  'GERR012',
  FAILURE_MESSAGES.INVALID_MOVE_TARGET,
  StatusCodes.BAD_REQUEST,
);

export const MemberNotFound = createError('GERR013', 'MEMBER_NOT_FOUND', StatusCodes.NOT_FOUND);

export const CannotModifyOtherMembers = createError(
  'GERR014',
  FAILURE_MESSAGES.CANNOT_MODIFY_OTHER_MEMBERS,
  StatusCodes.FORBIDDEN,
);

export const MemberCannotAccess = createError(
  'GERR016',
  FAILURE_MESSAGES.MEMBER_CANNOT_ACCESS,
  StatusCodes.FORBIDDEN,
);

export const MemberAlreadySignedUp = createError(
  'GERR017',
  FAILURE_MESSAGES.MEMBER_ALREADY_SIGNED_UP,
  StatusCodes.CONFLICT,
);

export const MemberNotSignedUp = createError(
  'GERR018',
  FAILURE_MESSAGES.MEMBER_NOT_SIGNED_UP,
  StatusCodes.NOT_FOUND,
);

export const MemberWithoutPassword = createError(
  'GERR019',
  FAILURE_MESSAGES.MEMBER_WITHOUT_PASSWORD,
  StatusCodes.NOT_ACCEPTABLE,
);

export const ChallengeFailed = createError('GERR021', 'challenge fail', StatusCodes.UNAUTHORIZED);

export const InvalidPassword = createError(
  'GERR025',
  FAILURE_MESSAGES.INVALID_PASSWORD,
  StatusCodes.UNAUTHORIZED,
);

export const EmptyCurrentPassword = createError(
  'GERR026',
  FAILURE_MESSAGES.EMPTY_CURRENT_PASSWORD,
  StatusCodes.BAD_REQUEST,
);

export const UnauthorizedMember = createError(
  'GERR027',
  'Unauthorized member',
  StatusCodes.UNAUTHORIZED,
);

export const AuthenticationError = createError(
  'GERR028',
  'The authentication failed',
  StatusCodes.UNAUTHORIZED,
);

export const ItemNotFolder = createError(
  'GERR029',
  'Item is not a folder',
  StatusCodes.BAD_REQUEST,
);

export const CannotDeleteOnlyAdmin = createError(
  'GERR030',
  'Cannot delete the only admin on item',
  StatusCodes.FORBIDDEN,
);

export const MissingNameOrTypeForItemError = createError(
  'GERR031',
  'Name and type should be defined',
  StatusCodes.BAD_REQUEST,
);

export const NoFileProvided = createError(
  'GERR033',
  'Expected a file to be present in the request, found none',
  StatusCodes.BAD_REQUEST,
);

export const CannotReorderRootItem = createError(
  'GERR034',
  'Cannot reorder items at root',
  StatusCodes.BAD_REQUEST,
);

export const CannotModifyGuestItemMembership = createError(
  'GERR035',
  FAILURE_MESSAGES.CANNOT_MODIFY_GUEST_ITEM_MEMBERSHIP,
  StatusCodes.BAD_REQUEST,
);

export const NothingToUpdateItem = createError(
  'GERR036',
  FAILURE_MESSAGES.NOTHING_TO_UPDATE_ITEM,
  StatusCodes.BAD_REQUEST,
);

export const BadCredentials = createError(
  'GERR037',
  FAILURE_MESSAGES.BAD_CREDENTIALS,
  StatusCodes.UNAUTHORIZED,
);

export const UnexpectedError = createError(
  'GERR999',
  FAILURE_MESSAGES.UNEXPECTED_ERROR,
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export const OpenAIBaseError = createError(
  'GERR1000',
  'An unknown error occured',
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export const OpenAIUnknownStopError = createError(
  'GERR1001',
  'The stop reason is not a known OpenAI reason',
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export const OpenAILengthError = createError(
  'GERR1002',
  'Incomplete model output due to token limitation',
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export const OpenAITimeOutError = createError(
  'GERR1003',
  'The response takes too long to respond',
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export const OpenAIQuotaError = createError(
  'GERR1004',
  'This token exceeded current quota, please check plan and billing details.',
  StatusCodes.TOO_MANY_REQUESTS,
);

export const OpenAIBadVersion = createError(
  'GERR1005',
  'The gpt-version is not a valid version',
  StatusCodes.BAD_REQUEST,
);

export const InvalidJWTItem = createError(
  'GERR1007',
  'The JWT item id does not correspond with the accessed item',
  StatusCodes.FORBIDDEN,
);

export const ShortLinkNotFound = createError(
  'GERR1009',
  FAILURE_MESSAGES.SHORT_LINK_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

export const ShortLinkDuplication = createError(
  'GERR1010',
  FAILURE_MESSAGES.SHORT_LINK_ALREADY_EXISTS,
  StatusCodes.CONFLICT,
);

export const ShortLinkLimitExceed = createError(
  'GERR1011',
  FAILURE_MESSAGES.SHORT_LINK_LIMIT_EXCEED,
  StatusCodes.CONFLICT,
);

export const InsufficientPermission = createError(
  'GERR1012',
  FAILURE_MESSAGES.INSUFFICIENT_PERMISSION,
  StatusCodes.FORBIDDEN,
);
