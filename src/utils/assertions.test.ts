import { notUndefined } from './assertions.js';

describe('notUndefined', () => {
  it('should throw an error if the object is undefined', () => {
    const object = undefined;
    expect(() => notUndefined(object)).toThrow();
  });
  it('should return the object if it is defined', () => {
    const object = 'defined';
    expect(notUndefined(object)).toBe(object);
  });
  it('should throw the error passed as an argument', () => {
    const object = undefined;
    const error = new Error('Custom error');
    expect(() => notUndefined(object, error)).toThrow(error);
  });
  it('should return the object if an error is defined', () => {
    const object = 'defined';
    const error = new Error('Custom error');
    expect(notUndefined(object, error)).toBe(object);
  });
  it('should help type assertion', () => {
    const object = 'defined';
    function getObject(): string | undefined {
      return object;
    }
    const newObject: string = notUndefined(getObject());
    expect(newObject).toBe(object);
  });
});
