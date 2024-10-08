import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { Item } from '../../../../entities/Item';

export type ValidationProcessResult = {
  status: ItemValidationStatus;
  result?: string;
};

export type StrategyExecutor = {
  validate: () => Promise<ValidationProcessResult>;
  process: ItemValidationProcess;
};

export interface ValidationStrategy {
  validate(item: Item): Promise<ValidationProcessResult>;
  process: ItemValidationProcess;
}
