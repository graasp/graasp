import { Ajv } from 'ajv';

export default function plugin(ajv: Ajv) {
  // JSON Web Token format
  ajv.addFormat('jwt', /^(?:[\w-]*\.){2}[\w-]*$/);

  // Authrorization Bearer JWT format
  ajv.addFormat('bearer', /^[bB]earer (?:[\w-]*\.){2}[\w-]*$/);

  // At least, 1 number, 1 lowercase and 1 uppercase letter. At least 8 characters.
  ajv.addFormat('strongPassword', /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/);
}
