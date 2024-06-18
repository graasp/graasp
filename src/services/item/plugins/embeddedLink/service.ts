import fetch from 'node-fetch';

import { FastifyBaseLogger } from 'fastify';

import { InvalidUrl } from './errors.js';
import { isValidUrl } from './utils.js';

type IframelyLink = {
  rel: string[];
  href: string;
};

type IframelyResponse = {
  meta: {
    title?: string;
    description?: string;
  };
  html: string;
  links: IframelyLink[];
};

type LinkMetadata = {
  title?: string;
  description?: string;
  html: string;
  thumbnails: string[];
  icons: string[];
};

export const PREFIX_EMBEDDED_LINK = 'embedded-links';

const hasRel = (rel: string[], value: string) => rel.some((r) => r === value);
const hasThumbnailRel = (rel: string[]) => hasRel(rel, 'thumbnail');
const hasIconRel = (rel: string[]) => hasRel(rel, 'icon');

const CSP_KEY = 'Content-Security-Policy';
const X_FRAME_KEY = 'X-Frame-Options';
const CSP_FRAME_NONE = ["frame-ancestors 'none'", "frame-ancestors 'self'"];
const X_FRAME_DISABLED = ['sameorigin', 'deny'];

export class EmbeddedLinkService {
  private assertUrlIsValid(url: string) {
    if (!isValidUrl(url)) {
      throw new InvalidUrl(url);
    }
  }

  async getLinkMetadata(iframelyHrefOrigin: string, url: string): Promise<LinkMetadata> {
    this.assertUrlIsValid(url);

    const response = await fetch(`${iframelyHrefOrigin}/iframely?uri=${encodeURIComponent(url)}`);
    // better clues on how to extract the metadata here: https://iframely.com/docs/links
    const { meta = {}, html, links = [] } = (await response.json()) as IframelyResponse;
    const { title, description } = meta;

    return {
      title: title?.trim(),
      description: description?.trim(),
      html,
      thumbnails: links.filter(({ rel }) => hasThumbnailRel(rel)).map(({ href }) => href),
      icons: links.filter(({ rel }: { rel: string[] }) => hasIconRel(rel)).map(({ href }) => href),
    };
  }

  async checkEmbeddingAllowed(url: string, logger?: FastifyBaseLogger): Promise<boolean> {
    this.assertUrlIsValid(url);

    try {
      const { headers } = await fetch(url);
      const cspHeader = headers.get(CSP_KEY)?.toLowerCase() || '';
      const xFrameOptions = headers.get(X_FRAME_KEY)?.toLowerCase() || '';

      if (CSP_FRAME_NONE.some((x) => cspHeader.includes(x))) {
        return false;
      } else if (X_FRAME_DISABLED.some((x) => x === xFrameOptions)) {
        return false;
      }

      return true;
    } catch (error) {
      const msgError = 'Error checking embedding permission:';
      if (logger) {
        logger?.error(msgError, error);
      } else {
        console.error(msgError, error);
      }
      return false;
    }
  }
}
