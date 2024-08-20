import { ItemLoginSchemaType } from '@graasp/sdk';

export function loginSchemaRequiresPassword(
  loginSchema: `${ItemLoginSchemaType}` | ItemLoginSchemaType,
): boolean {
  return (
    loginSchema === ItemLoginSchemaType.UsernameAndPassword ||
    loginSchema === ItemLoginSchemaType.AnonymousAndPassword
  );
}
