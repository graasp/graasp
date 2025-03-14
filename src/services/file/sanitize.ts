import { createWriteStream } from 'fs';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import sanitize from 'sanitize-html';
import { Readable } from 'stream';

import { TMP_FOLDER } from '../../utils/config.js';
import { randomHexOf4 } from '../utils.js';

export function sanitizeHtml(content: string): string {
  return sanitize(content);
}

export function createSanitizedFile(
  file: Readable,
  sanitizeFn: (content: string) => string,
): Promise<Readable> {
  return new Promise((done, rejects) => {
    // create tmp file to read
    const tmpFile = path.join(TMP_FOLDER, `${Date.now().toString()}_${randomHexOf4()}`);
    file.pipe(createWriteStream(tmpFile));

    file.on('error', function () {
      rejects(new Error('An error happened while piping the file to sanitize'));
    });

    file.on('close', async function () {
      const content = await readFile(tmpFile, {
        encoding: 'utf8',
        flag: 'r',
      });

      const readable = Readable.from(sanitizeFn(content));

      // delete tmp file
      unlink(tmpFile).catch((e) => console.error(e));

      // return sanitized readable
      done(readable);
    });
  });
}
