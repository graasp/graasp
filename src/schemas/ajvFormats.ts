import type { Ajv } from 'ajv';

import { MemberConstants } from '@graasp/sdk';

export function modifyAjvInstance(ajv: Ajv) {
  // JSON Web Token format
  ajv.addFormat('jwt', /^(?:[\w-]*\.){2}[\w-]*$/);

  // Authorization Bearer JWT format
  ajv.addFormat('bearer', /^[bB]earer (?:[\w-]*\.){2}[\w-]*$/);

  // At least, 1 number, 1 lowercase and 1 uppercase letter. At least 8 characters.
  ajv.addFormat('strongPassword', /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/);

  // No special characters and no Unicode control characters in the username
  ajv.addFormat('graaspUsername', MemberConstants.USERNAME_FORMAT_REGEX);
}
