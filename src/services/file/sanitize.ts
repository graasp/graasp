import sanitize from 'sanitize-html';
import { Readable } from 'stream';
import { text } from 'stream/consumers';

export function sanitizeHtml(content: string): string {
  return sanitize(content);
}

export async function sanitizeDocument(
  file: Readable,
  sanitizeFn: (content: string) => string,
): Promise<Readable> {
  try {
    const content = await text(file);
    const readable = Readable.from(sanitizeFn(content));

    // return sanitized readable
    return readable;
  } catch (e) {
    console.error(e);
    throw new Error('An error happened while creating a sanitized version of the file');
  }
}
