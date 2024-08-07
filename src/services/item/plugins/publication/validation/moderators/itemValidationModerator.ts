import { singleton } from 'tsyringe';

import { ItemValidationReviewStatus, ItemValidationStatus } from '@graasp/sdk';

import { Repositories } from '../../../../../../utils/repositories';
import { Item } from '../../../../entities/Item';
import { ItemValidationGroup } from '../entities/ItemValidationGroup';
import { ProcessExecutionError } from '../errors';
import { StrategyExecutorFactory } from './strategyExecutorFactory';
import { StrategyExecutor } from './types';

@singleton()
export class ItemValidationModerator {
  private readonly strategyExecutorFactory: StrategyExecutorFactory;

  constructor(strategyExecutorFactory: StrategyExecutorFactory) {
    this.strategyExecutorFactory = strategyExecutorFactory;
  }

  async validate(
    repositories: Repositories,
    item: Item,
    itemValidationGroup: ItemValidationGroup,
  ): Promise<ItemValidationStatus[]> {
    // execute each process on item
    const results = (
      await Promise.all(
        this.strategyExecutorFactory.createStrategyExecutors(item).map(async (strategyExecutor) => {
          try {
            return await this.executeValidationProcess(
              repositories,
              item,
              itemValidationGroup.id,
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
    repositories: Repositories,
    item: Item,
    groupId: string,
    { process, validate }: StrategyExecutor,
  ): Promise<ItemValidationStatus> {
    const { itemValidationReviewRepository, itemValidationRepository } = repositories;

    // create pending validation
    const itemValidation = await itemValidationRepository.post(item?.id, groupId, process);

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
      await itemValidationReviewRepository.post(
        itemValidation.id,
        ItemValidationReviewStatus.Pending,
      );
    }

    // update item validation
    await itemValidationRepository.patch(itemValidation.id, { result, status });

    return status;
  }
}
