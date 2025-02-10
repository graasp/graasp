import { singleton } from 'tsyringe';

import { ItemType } from '@graasp/sdk';

import FileService from '../../../../../file/service';
import { Item } from '../../../../entities/Item';
import { isImage } from '../utils';
import { ImageValidationStrategy } from './imageValidationStrategy';
import { TextValidationStrategy } from './textValidationStrategy';
import { ThumbnailValidationStrategy } from './thumbnailValidationStrategy';
import { StrategyExecutor, ValidationStrategy } from './types';

export const buildStrategyExecutor = (
  strategy: ValidationStrategy,
  item: Item,
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

  private isSameTypeAsFileService(item: Item) {
    return item.type === ItemType.FILE;
  }

  /**
   * Define the different validation processes to run on the given item depending on the type.
   * @param item The item to validate.
   * @returns StrategyExecutor[] An array of validation strategies to apply on the given item.
   */
  public createStrategyExecutors(item: Item) {
    // always validate the item's text
    const validationStrategies: StrategyExecutor[] = [
      buildStrategyExecutor(this.textValidationStrategy, item),
    ];

    if (this.isSameTypeAsFileService(item) && isImage(item)) {
      validationStrategies.push(buildStrategyExecutor(this.imageValidationStrategy, item));
    }

    if (item.settings.hasThumbnail) {
      validationStrategies.push(buildStrategyExecutor(this.thumbnailValidationStrategy, item));
    }

    return validationStrategies;
  }
}
