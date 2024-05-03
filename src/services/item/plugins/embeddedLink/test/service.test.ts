import fetch, { Response } from 'node-fetch';

import { EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN } from '../../../../../utils/config';
import { EmbeddedLinkService } from '../service';
import { FAKE_URL, FETCH_RESULT, expectedResult } from './fixtures';

jest.mock('node-fetch');

const { Headers } = jest.requireActual('node-fetch');

export const mockResponse = (response: Response) => {
  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => response);
};

export const mockHeaderResponse = (headers: { [key: string]: string }) => {
  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
    async () => ({ headers: new Headers(headers) } as Response),
  );
};

const embeddedLinkService = new EmbeddedLinkService();

describe('Test EmbeddedLinkService', () => {
  describe('Tests retrieving link metadata', () => {
    it('Retrieve all metadata from URL', async () => {
      mockResponse({ json: async () => FETCH_RESULT } as Response);
      const metadata = await embeddedLinkService.getLinkMetadata(
        EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
        FAKE_URL,
      );
      expect(metadata).toEqual(expectedResult);
    });
  });

  describe('Tests allowed to embbed links in iFrame', () => {
    describe('Embedding is disallowed when X-Frame-Options is set', () => {
      it('Embedding is disallowed when X-FRAME-OPTIONS is DENY', async () => {
        mockHeaderResponse({ 'X-FRAME-OPTIONS': 'DENY' });
        expect(await embeddedLinkService.checkEmbeddingAllowed(FAKE_URL)).toBe(false);
      });
      it('Embedding is disallowed when x-frame-options is deny', async () => {
        mockHeaderResponse({ 'x-frame-options': 'deny' });
        expect(await embeddedLinkService.checkEmbeddingAllowed(FAKE_URL)).toBe(false);
      });
      it('Embedding is disallowed when X-FRAME-OPTIONS is SAMEORIGIN', async () => {
        mockHeaderResponse({ 'X-FRAME-OPTIONS': 'DENY' });
        expect(await embeddedLinkService.checkEmbeddingAllowed(FAKE_URL)).toBe(false);
      });
      it('Embedding is disallowed when x-frame-options is sameorigin', async () => {
        mockHeaderResponse({ 'x-frame-options': 'sameorigin' });
        expect(await embeddedLinkService.checkEmbeddingAllowed(FAKE_URL)).toBe(false);
      });
    });

    describe('Embedding is disallowed when Content-Security-Policy is set', () => {
      it('Embedding is disallowed when content-security-policy is none', async () => {
        mockHeaderResponse({ 'content-security-policy': "frame-ancestors 'none'" });
        expect(await embeddedLinkService.checkEmbeddingAllowed(FAKE_URL)).toBe(false);
      });
      it('Embedding is disallowed when CONTENT-SECURITY-POLICY is NONE', async () => {
        mockHeaderResponse({ 'CONTENT-SECURITY-POLICY': "FRAME-ANCESTORS 'NONE'" });
        expect(await embeddedLinkService.checkEmbeddingAllowed(FAKE_URL)).toBe(false);
      });
      it('Embedding is disallowed when content-security-policy is self', async () => {
        mockHeaderResponse({ 'content-security-policy': "frame-ancestors 'self'" });
        expect(await embeddedLinkService.checkEmbeddingAllowed(FAKE_URL)).toBe(false);
      });
      it('Embedding is disallowed when CONTENT-SECURITY-POLICY is self', async () => {
        mockHeaderResponse({ 'CONTENT-SECURITY-POLICY': "FRAME-ANCESTORS 'SELF'" });
        expect(await embeddedLinkService.checkEmbeddingAllowed(FAKE_URL)).toBe(false);
      });
    });

    describe('Embedding is allowed when X-Frame-Options and CSP are not set', () => {
      it('Embedding is allowed', async () => {
        mockHeaderResponse({});
        expect(await embeddedLinkService.checkEmbeddingAllowed(FAKE_URL)).toBe(true);
      });
    });
  });
});
