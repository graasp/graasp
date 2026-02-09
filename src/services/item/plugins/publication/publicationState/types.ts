import type { ItemValidationGroupRaw, ItemValidationRaw } from '../../../../../drizzle/types';
import type { PackedItem } from '../../../packedItem.dto';

type ValidationStatus = Pick<ItemValidationRaw, 'status'>;

export type ItemMetadata = Pick<PackedItem, 'updatedAt' | 'path' | 'type'> &
  Partial<Pick<PackedItem, 'public'>>;

export type ItemValidationGroupStatus = Pick<ItemValidationGroupRaw, 'createdAt'> & {
  itemValidations: ValidationStatus[];
};

export type MapByStatus = { [status: string]: ValidationStatus[] };
