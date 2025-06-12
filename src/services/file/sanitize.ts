import { createWriteStream } from 'fs';
import { readFile, unlink } from 'fs/promises';
import path from 'path';
import sanitize from 'sanitize-html';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { TMP_FOLDER } from '../../utils/config';
import { randomHexOf4 } from '../utils';

export function sanitizeHtml(content: string): string {
  return sanitize(content);
}

export async function createSanitizedFile(
  file: Readable,
  sanitizeFn: (content: string) => string,
): Promise<Readable> {
  // create tmp file to read
  const tmpFile = path.join(TMP_FOLDER, `${Date.now().toString()}_${randomHexOf4()}`);
  try {
    const tmpWriteStream = createWriteStream(tmpFile);
    await pipeline(file, tmpWriteStream);

    const content = await readFile(tmpFile, {
      encoding: 'utf8',
      flag: 'r',
    });

    const readable = Readable.from(sanitizeFn(content));

    // delete tmp file
    unlink(tmpFile).catch((e) => console.error(e));

    // return sanitized readable
    return readable;
  } catch (e) {
    console.error(e);
    throw new Error('An error happened while creating a sanitized version of the file');
  }
}
