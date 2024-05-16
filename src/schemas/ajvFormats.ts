import Ajv from 'ajv';

export default function plugin(ajv: Ajv) {
  ajv.addFormat('jwt', /^(?:[\w-]*\.){2}[\w-]*$/);
  ajv.addFormat('bearer', /^[bB]earer (?:[\w-]*\.){2}[\w-]*$/);
}
