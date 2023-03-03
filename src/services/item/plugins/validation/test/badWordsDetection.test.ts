import { FastifyLoggerInstance } from 'fastify';

import { DatabaseTransactionHandler, Item, ItemService, ItemType, Member } from '@graasp/sdk';
import { FileTaskManager } from 'graasp-plugin-file';
import { TaskRunner as Runner } from 'graasp-test';

import {
  BAD_ITEM,
  DEFAULT_OPTIONS,
  GOOD_ITEM,
  ITEM_VALIDATION_REVIEWS,
  IVStauses,
  MOCK_CLASSIFIER_API,
  SAMPLE_VALIDATION_PROCESS,
  buildMember,
  itemValidationGroupEntry,
} from '../../test/constants';
import { FAILURE_RESULT, SUCCESS_RESULT } from '../constants';
import { ItemValidationService } from '../db-service';
import { ItemValidationReview } from '../types';
import { CreateItemValidationTask } from './create-item-validation-task';

const handler = {} as unknown as DatabaseTransactionHandler;
const log = {} as unknown as FastifyLoggerInstance;

const validationService = new ItemValidationService();
const itemService = { get: jest.fn() } as unknown as ItemService;

const member = buildMember() as Member;
const fTM = new FileTaskManager(DEFAULT_OPTIONS.fileConfigurations, DEFAULT_OPTIONS.fileItemType);
const runner = new Runner();

describe('Run detect bad words process', () => {
  const iVP = [SAMPLE_VALIDATION_PROCESS[0]];
  const iVId = 'item-validation-id-1';
  jest.spyOn(validationService, 'getEnabledProcesses').mockImplementation(async () => iVP);
  jest
    .spyOn(validationService, 'getItemValidationStatuses')
    .mockImplementation(async () => IVStauses);
  jest
    .spyOn(validationService, 'getItemValidationReviewStatuses')
    .mockImplementation(async () => IVStauses);
  jest.spyOn(validationService, 'createItemValidation').mockImplementation(async () => iVId);
  jest
    .spyOn(validationService, 'createItemValidationGroup')
    .mockImplementation(async () => itemValidationGroupEntry);
  jest
    .spyOn(validationService, 'updateItemValidationGroup')
    .mockImplementation(async () => itemValidationGroupEntry);
  jest
    .spyOn(validationService, 'createItemValidationReview')
    .mockImplementation(async () => ITEM_VALIDATION_REVIEWS[0] as ItemValidationReview);

  it('Detect fields containing bad words', async () => {
    const input = BAD_ITEM.id;
    const item = BAD_ITEM;
    const task = new CreateItemValidationTask(
      member,
      validationService,
      itemService,
      fTM,
      runner,
      ItemType.LOCAL_FILE,
      MOCK_CLASSIFIER_API,
      { itemId: input },
    );
    jest.spyOn(itemService, 'get').mockImplementation(async () => item as Item);
    await task.run(handler, log);
    expect(task.result).toEqual(FAILURE_RESULT);
  });

  it('Return empty list if item is OK', async () => {
    const input = GOOD_ITEM.id;
    const item = GOOD_ITEM;
    const task = new CreateItemValidationTask(
      member,
      validationService,
      itemService,
      fTM,
      runner,
      ItemType.LOCAL_FILE,
      MOCK_CLASSIFIER_API,
      { itemId: input },
    );
    jest.spyOn(itemService, 'get').mockImplementation(async () => item as Item);
    await task.run(handler, log);
    expect(task.result).toEqual(SUCCESS_RESULT);
  });
});
