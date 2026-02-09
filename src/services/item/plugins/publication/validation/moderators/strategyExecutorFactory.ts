import { singleton } from 'tsyringe';

import FileService from '../../../../../file/file.service';
import { type ItemRaw } from '../../../../item';
import { isImage } from '../utils';
import { ImageValidationStrategy } from './imageValidationStrategy';
import { TextValidationStrategy } from './textValidationStrategy';
import { ThumbnailValidationStrategy } from './thumbnailValidationStrategy';
import type { StrategyExecutor, ValidationStrategy } from './types';

export const buildStrategyExecutor = (
  strategy: ValidationStrategy,
  item: ItemRaw,
): StrategyExecutor => ({
  process: strategy.process,
  validate: () => strategy.validate(item),
});

@singleton()
export class StrategyExecutorFactory {
  private readonly fileService: FileService;
  private readonly textValidationStrategy: TextValidationStrategy;
  private readonly imageValidationStrategy: ImageValidationStrategy;
  private readonly thumbnailValidationStrategy: ThumbnailValidationStrategy;

  constructor(
    fileService: FileService,
    textValidationStrategy: TextValidationStrategy,
    imageValidationStrategy: ImageValidationStrategy,
    thumbnailValidationStrategy: ThumbnailValidationStrategy,
  ) {
    this.fileService = fileService;
    this.textValidationStrategy = textValidationStrategy;
    this.imageValidationStrategy = imageValidationStrategy;
    this.thumbnailValidationStrategy = thumbnailValidationStrategy;
  }

  /**
   * Define the different validation processes to run on the given item depending on the type.
   * @param item The item to validate.
   * @returns StrategyExecutor[] An array of validation strategies to apply on the given item.
   */
  public createStrategyExecutors(item: ItemRaw) {
    // always validate the item's text
    const validationStrategies: StrategyExecutor[] = [
      buildStrategyExecutor(this.textValidationStrategy, item),
    ];

    if (isImage(item)) {
      validationStrategies.push(buildStrategyExecutor(this.imageValidationStrategy, item));
    }

    if (item.settings.hasThumbnail) {
      validationStrategies.push(buildStrategyExecutor(this.thumbnailValidationStrategy, item));
    }

    return validationStrategies;
  }
}
