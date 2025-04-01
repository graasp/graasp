import { isValidUrl } from './utils';

describe('Tests isValidUrl function', () => {
  describe('Valid URLs', () => {
    it('Returns true for a valid URL with http protocol', () => {
      const validUrl = 'http://www.example.com';
      expect(isValidUrl(validUrl)).toBe(true);
    });

    it('Returns true for a valid URL with https protocol', () => {
      const validUrl = 'https://www.example.com';
      expect(isValidUrl(validUrl)).toBe(true);
    });

    it('Returns true for a valid URL with https protocol and without www subdomain', () => {
      const validUrl = 'https://example.com';
      expect(isValidUrl(validUrl)).toBe(true);
    });

    it('Returns true for a valid URL with http protocol and port', () => {
      const validUrl = 'http://example.com:8080';
      expect(isValidUrl(validUrl)).toBe(true);
    });

    it('Returns true for a valid URL with http protocol, port and query param', () => {
      const validUrl = 'http://example.com:8080?test=ok';
      expect(isValidUrl(validUrl)).toBe(true);
    });
    it('Returns true for a valid URL with https protocol, port and path', () => {
      const validUrl = 'https://example.com:443/test.png';
      expect(isValidUrl(validUrl)).toBe(true);
    });

    it('Returns true for a valid URL with www subdomain and missing protocol', () => {
      const invalidUrl = 'example.com';
      expect(isValidUrl(invalidUrl)).toBe(true);
    });

    it('Returns true for a valid URL with missing protocol', () => {
      const invalidUrl = 'example.com';
      expect(isValidUrl(invalidUrl)).toBe(true);
    });
  });

  describe('Invalid URLs', () => {
    it('Returns false for an invalid URL with invalid characters', () => {
      const invalidUrl = 'https://www.example!.com';
      expect(isValidUrl(invalidUrl)).toBe(false);
    });

    it('Returns false for an invalid URL with missing Top-Level Domain', () => {
      const invalidUrl = 'https://www.example';
      expect(isValidUrl(invalidUrl)).toBe(false);
    });
  });
});
