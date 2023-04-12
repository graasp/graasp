import { v4 } from 'uuid';

import { paths } from './constants';

describe('Constants', () => {
  it('paths', () => {
    const id = v4();
    expect(paths.baseItem.test(`/items/${id}`)).toBeTruthy();
    expect(paths.copyItem.test(`/items/${id}/copy`)).toBeTruthy();
    expect(paths.moveItem.test(`/items/${id}/move`)).toBeTruthy();
    expect(paths.childrenItem.test(`/items/${id}/children`)).toBeTruthy();
    expect(paths.multipleItems.test(`/items?id=${id}`)).toBeTruthy();
    expect(paths.multipleItems.test(`/items?id=${id}&id=${id}`)).toBeTruthy();

    expect(paths.baseItem.test(`/items/${id}?id=moredata`)).toBeFalsy();
    expect(paths.copyItem.test(`/items/${id}/copy?id=moredata`)).toBeTruthy();
    expect(paths.moveItem.test(`/items/${id}/move?id=moredata`)).toBeTruthy();
    expect(paths.childrenItem.test(`/items/${id}/children?id=moredata`)).toBeTruthy();
    expect(paths.multipleItems.test(`recycled/items?id=${id}&id=${id}`)).toBeFalsy();
  });
});
