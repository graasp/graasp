import { FastifyInstance } from 'fastify';

import build from '../../../../../../../test/app';
import { resolveDependency } from '../../../../../../di/utils';
import { ItemValidationAlreadyExist } from '../errors';
import { ValidationQueue } from '../validationQueue';

describe('Validation Queue Tests', () => {
  let app: FastifyInstance;
  let validationQueue: ValidationQueue;
  const itemPath = '1b304da5_b342_46e8_a484_1712d5209e43';
  const childPath = `${itemPath}.cc24344a_9745_42d6_ae03_17ef686ee824`;

  const resetValidations = async () => {
    await validationQueue.removeInProgress(itemPath);
    await validationQueue.removeInProgress(childPath);
  };

  beforeAll(async () => {
    ({ app } = await build());
    validationQueue = resolveDependency(ValidationQueue);
  });

  afterAll(() => {
    app.close();
  });

  afterEach(async () => {
    await resetValidations();
    jest.clearAllMocks();
  });

  it('Adds new validation', async () => {
    await validationQueue.addInProgress(itemPath);
    const exists = await validationQueue.isInProgress(itemPath);

    expect(exists).toBe(true);
  });

  it('Adds validation twice should throw', async () => {
    const addTwice = async () => {
      await validationQueue.addInProgress(itemPath);
      await validationQueue.addInProgress(itemPath);
    };

    expect(addTwice()).rejects.toBeInstanceOf(ItemValidationAlreadyExist);
  });

  it('Adds validation of parent and child should throw', async () => {
    const addTwice = async () => {
      await validationQueue.addInProgress(itemPath);
      await validationQueue.addInProgress(childPath);
    };

    await expect(() => addTwice()).rejects.toBeInstanceOf(ItemValidationAlreadyExist);
  });

  it('Retrieves child validation', async () => {
    await validationQueue.addInProgress(itemPath);
    const exists = await validationQueue.isInProgress(childPath);

    expect(exists).toBe(true);
  });

  it('Removes parent validation', async () => {
    await validationQueue.addInProgress(itemPath);
    const exists = [
      await validationQueue.isInProgress(itemPath),
      await validationQueue.isInProgress(childPath),
    ];
    expect(exists).toEqual([true, true]);

    await validationQueue.removeInProgress(itemPath);
    const results = [
      await validationQueue.isInProgress(itemPath),
      await validationQueue.isInProgress(childPath),
    ];
    expect(results).toEqual([false, false]);
  });

  it('Removes child validation', async () => {
    await validationQueue.addInProgress(childPath);
    const exists = await validationQueue.isInProgress(childPath);
    expect(exists).toBe(true);

    await validationQueue.removeInProgress(childPath);
    const results = await validationQueue.isInProgress(childPath);
    expect(results).toBe(false);
  });

  it('Expires after the timeout', async () => {
    const EXPIRES_IN_SECONDS = 1;
    const EXPIRES_IN_MS = EXPIRES_IN_SECONDS * 1000;

    await validationQueue.addInProgress(childPath, EXPIRES_IN_SECONDS);
    const exists = await validationQueue.isInProgress(childPath);
    expect(exists).toBe(true);

    // Wait a bit more than the expiration time to avoid flacky test.
    await new Promise((resolve) => setTimeout(resolve, EXPIRES_IN_MS + 500));

    const results = await validationQueue.isInProgress(childPath);
    expect(results).toBe(false);
  });
});
