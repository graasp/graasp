import { createWriteStream } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import sanitize from 'sanitize-html';
import { Readable } from 'stream';

import { TMP_FOLDER } from '../../utils/config';

export function sanitizeSvg(content: string) {
  return sanitize(content, {
    allowedTags: [
      'circle',
      'defs',
      'ellipse',
      'font',
      'g',
      'glyph',
      'image',
      'linearGradient',
      'path',
      'polygon',
      'polyline',
      'rect',
      'svg',
      'text',
      'textpath',
    ],
    allowedAttributes: false,
    parser: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
    },
  });
}

export function sanitizeHtml(content: string): string {
  return sanitize(content);
}

export function createSanitizedFile(
  file,
  sanitizeFn: (content: string) => string,
): Promise<Readable> {
  return new Promise((done, rejects) => {
    // create tmp file to read
    const tmpFile = path.join(TMP_FOLDER, Date.now().toString());
    file.pipe(createWriteStream(tmpFile));

    file.on('error', function (err) {
      rejects(err);
    });

    file.on('close', async function () {
      const content = await readFile(tmpFile, {
        encoding: 'utf8',
        flag: 'r',
      });

      const readable = Readable.from(sanitizeFn(content));

      // return sanitized readable
      done(readable);
    });
  });
}
