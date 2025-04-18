import { ItemValidationGroupRaw, ItemValidationRaw } from '../../../../../drizzle/types';
import { PackedItem } from '../../../ItemWrapper';

type ValidationStatus = Pick<ItemValidationRaw, 'status'>;

export type ItemMetadata = Pick<PackedItem, 'updatedAt' | 'path' | 'type'> &
  Partial<Pick<PackedItem, 'public'>>;

export type ItemValidationGroupStatus = Pick<ItemValidationGroupRaw, 'createdAt'> & {
  itemValidations: ValidationStatus[];
};

export type MapByStatus = { [status: string]: ValidationStatus[] };
