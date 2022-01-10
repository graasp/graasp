import { v4 as uuidv4 } from 'uuid';

export const buildAction = (data): any => ({
  id: uuidv4(),
  createdAt: '2021-03-29T08:46:52.939Z',
  updatedAt: '2021-03-29T08:46:52.939Z',
  ...data,
});
