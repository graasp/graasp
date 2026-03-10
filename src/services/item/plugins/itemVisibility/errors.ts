import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const ItemHasVisibility = createError(
  'GITERR004',
  'Item already has visibility',
  StatusCodes.BAD_REQUEST,
);
export const ItemVisibilityNotFound = createError(
  'GITERR005',
  'Item visibility not found',
  StatusCodes.NOT_FOUND,
);
export const VisibilityNotFound = createError(
  'GITERR006',
  'Visibility not found',
  StatusCodes.NOT_FOUND,
);

export const CannotModifyParentVisibility = createError(
  'GITERR008',
  'Cannot modify inherited Visibility',
  StatusCodes.FORBIDDEN,
);

export const ConflictingVisibilitiesInTheHierarchy = createError(
  'GITERR007',
  'Visibility already present in the hierarchy - itself or ancestors',
  StatusCodes.FORBIDDEN,
);

export const InvalidUseOfItemVisibilityRepository = createError(
  'GITERR008',
  'ItemVisibilityRepository was not used correctly, this should not happen. Consider this an internal error. Contact your local developer team.',
  StatusCodes.BAD_REQUEST,
);
