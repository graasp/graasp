import { asDefined, assertIsDefined, isDefined } from './assertions';

describe('isDefined', () => {
  it('should return false if the object is undefined', () => {
    const object = undefined;
    expect(isDefined(object)).toBe(false);
  });
  it('should return false if the object is null', () => {
    const object = null;
    expect(isDefined(object)).toBe(false);
  });
  it('should return true if it is defined', () => {
    const object = 'defined';
    expect(isDefined(object)).toBe(true);
  });
  it('should return true if it is a boolean', () => {
    expect(isDefined(true)).toBe(true);
    expect(isDefined(false)).toBe(true);
  });
  it('should return true if it is an empty string', () => {
    const object = '';
    expect(isDefined(object)).toBe(true);
  });
});
describe('asDefined', () => {
  it('should throw an error if the object is undefined', () => {
    const object = undefined;
    expect(() => asDefined(object)).toThrow();
  });
  it('should return the object if it is defined', () => {
    const object = 'defined';
    expect(asDefined(object)).toBe(object);
  });
  it('should throw the error passed as an argument', () => {
    const object = undefined;
    expect(() => asDefined(object, Error)).toThrow(Error);
    expect(() => asDefined(object, Error, 'Message')).toThrow(Error);
  });
  it('should return the object if an error is defined', () => {
    const object = 'defined';
    expect(asDefined(object, Error)).toBe(object);
    expect(asDefined(object, Error, 'Custom Error Message')).toBe(object);
  });
  it('should help type assertion', () => {
    const object = 'defined';
    function getObject(): string | undefined {
      return object;
    }
    const newObject: string = asDefined(getObject());
    expect(newObject).toBe(object);
  });
});

describe('assertIsDefined', () => {
  it('should throw an error if the object is undefined', () => {
    const object = undefined;
    expect(() => assertIsDefined(object)).toThrow();
  });
  it('should do nothing if the object is defined', () => {
    const object = 'defined';
    expect(() => assertIsDefined(object)).not.toThrow();
  });
  it('should throw the error passed as an argument', () => {
    const object = undefined;
    expect(() => assertIsDefined(object, Error)).toThrow(Error);
    expect(() => assertIsDefined(object, Error, 'Message')).toThrow(Error);
  });
  it('should do nothing if an error is defined and the object is defined', () => {
    const object = 'defined';
    expect(() => assertIsDefined(object, Error)).not.toThrow();
    expect(() => assertIsDefined(object, Error, 'Custom Error Message')).not.toThrow();
  });
  it('should help type assertion', () => {
    const object = 'defined';
    function getObject(): string | undefined {
      return object;
    }
    const newObject = getObject();
    assertIsDefined(newObject);
    const result: string = newObject;
    expect(result).toBe(object);
  });
});
