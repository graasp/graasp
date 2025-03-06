import { singleton } from 'tsyringe';

import { ItemValidationReviewStatus, ItemValidationStatus } from '@graasp/sdk';

import { DBConnection } from '../../../../../../drizzle/db';
import { Item, ItemValidationGroupRaw } from '../../../../../../drizzle/types';
import { ProcessExecutionError } from '../errors';
import { ItemValidationRepository } from '../itemValidation.repository';
import { ItemValidationReviewRepository } from '../itemValidationReview.repository';
import { StrategyExecutorFactory } from './strategyExecutorFactory';
import { StrategyExecutor } from './types';

@singleton()
export class ItemValidationModerator {
  private readonly strategyExecutorFactory: StrategyExecutorFactory;
  private readonly itemValidationRepository: ItemValidationRepository;
  private readonly itemValidationReviewRepository: ItemValidationReviewRepository;

  constructor(
    strategyExecutorFactory: StrategyExecutorFactory,
    itemValidationRepository: ItemValidationRepository,
    itemValidationReviewRepository: ItemValidationReviewRepository,
  ) {
    this.strategyExecutorFactory = strategyExecutorFactory;
    this.itemValidationRepository = itemValidationRepository;
    this.itemValidationReviewRepository = itemValidationReviewRepository;
  }

  async validate(
    db: DBConnection,
    item: Item,
    itemValidationGroupId: ItemValidationGroupRaw['id'],
  ): Promise<ItemValidationStatus[]> {
    // execute each process on item
    const results = (
      await Promise.all(
        this.strategyExecutorFactory.createStrategyExecutors(item).map(async (strategyExecutor) => {
          try {
            return await this.executeValidationProcess(
              db,
              item,
              itemValidationGroupId,
              strategyExecutor,
            );
          } catch (error) {
            throw new ProcessExecutionError(strategyExecutor.process, error);
          }
        }),
      )
    ).filter((r): r is ItemValidationStatus => Boolean(r));

    return results;
  }

  private async executeValidationProcess(
    db: DBConnection,
    item: Item,
    groupId: string,
    { process, validate }: StrategyExecutor,
  ): Promise<ItemValidationStatus> {
    // create pending validation
    const itemValidation = await this.itemValidationRepository.post(db, item?.id, groupId, process);

    let status: ItemValidationStatus;
    let result: string | undefined = undefined;

    try {
      ({ status, result } = await validate());
    } catch (error) {
      // if some error happend during the execution of a process, it is counted as failure
      status = ItemValidationStatus.Failure;
      if (error instanceof Error) {
        result = error.message;
      }
    }

    // create review entry if validation failed
    if (status === ItemValidationStatus.Failure) {
      await this.itemValidationReviewRepository.post(
        db,
        itemValidation.id,
        ItemValidationReviewStatus.Pending,
      );
    }

    // update item validation
    await this.itemValidationRepository.patch(db, itemValidation.id, { result, status });

    return status;
  }
}
