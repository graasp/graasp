import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { type ItemRaw } from '../../../../../../drizzle/item.dto';

export type ValidationProcessResult = {
  status: ItemValidationStatus;
  result?: string;
};

export type StrategyExecutor = {
  validate: () => Promise<ValidationProcessResult>;
  process: ItemValidationProcess;
};

export interface ValidationStrategy {
  validate(item: ItemRaw): Promise<ValidationProcessResult>;
  process: ItemValidationProcess;
}
