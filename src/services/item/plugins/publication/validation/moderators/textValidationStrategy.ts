import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { Item } from '../../../../../../drizzle/types.js';
import { detectFieldNameWithBadWords } from '../processes/badWordsDetection.js';
import { stripHtml } from '../utils.js';
import { ValidationProcessResult, ValidationStrategy } from './types.js';

export class TextValidationStrategy implements ValidationStrategy {
  public readonly process = ItemValidationProcess.BadWordsDetection;

  async validate(item: Item): Promise<ValidationProcessResult> {
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
