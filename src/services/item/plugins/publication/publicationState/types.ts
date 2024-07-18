import { PackedItem } from '../../../ItemWrapper';
import { ItemValidation } from '../validation/entities/ItemValidation';
import { ItemValidationGroup } from '../validation/entities/ItemValidationGroup';

type ValidationStatus = Pick<ItemValidation, 'status'>;

export type ItemMetadata = Pick<PackedItem, 'updatedAt' | 'path' | 'type'> &
  Partial<Pick<PackedItem, 'public'>>;

export type ItemValidationGroupStatus = Pick<ItemValidationGroup, 'createdAt'> & {
  itemValidations: ValidationStatus[];
};

export type MapByStatus = { [status: string]: ValidationStatus[] };
