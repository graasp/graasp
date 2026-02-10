import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { type ItemRaw } from '../../../../item';
import { detectFieldNameWithBadWords } from '../processes/badWordsDetection';
import { stripHtml } from '../utils';
import type { ValidationProcessResult, ValidationStrategy } from './types';

export class TextValidationStrategy implements ValidationStrategy {
  public readonly process = ItemValidationProcess.BadWordsDetection;

  async validate(item: ItemRaw): Promise<ValidationProcessResult> {
    const suspiciousFields = detectFieldNameWithBadWords([
      { name: 'name', value: item.name },
      { name: 'description', value: stripHtml(item.description) },
    ]);
    const result = suspiciousFields.join(', ');
    const status =
      suspiciousFields.length > 0 ? ItemValidationStatus.Failure : ItemValidationStatus.Success;

    return { result, status };
  }
}
