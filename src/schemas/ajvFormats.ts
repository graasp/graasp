import { Ajv } from 'ajv';

export default function plugin(ajv: Ajv) {
  // JSON Web Token format
  ajv.addFormat('jwt', /^(?:[\w-]*\.){2}[\w-]*$/);

  // Authorization Bearer JWT format
  ajv.addFormat('bearer', /^[bB]earer (?:[\w-]*\.){2}[\w-]*$/);

  // At least, 1 number, 1 lowercase and 1 uppercase letter. At least 8 characters.
  ajv.addFormat('strongPassword', /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/);

  // No special characters and no Unicode control characters in the username
  ajv.addFormat('username', /^[^"<>^%\\\u{0000}-\u{001F}\u{007F}-\u{009F}]+$/u);
}
