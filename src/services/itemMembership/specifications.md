# Item memberships

## Inheritance rules

- A children membership can not be more restrictive (lower permission) than its parent memberships, but can be equal or more permissive (higher permission) than its parent membership

Example: 
If we have the following structure: A (parent) > B (child)
It is possible to have:
- `read` on A and `write` on B
- `read` on A and `admin` on B
- `write` on A and `admin` on B (this happens if user created B inside A)
- `read` on A only (user has `read` access to B with inheritance)
- `write` on A only (user has `write` access to B with inheritance)
- `admin` on A only (user has `admin` access to B with inheritance)
- `read` on B only (user does not have access to A)
- `write`on B only (user does not have access to A)
- `admin` on B only (user does not have access to A)

It is forbidden to have:
- `admin` on A and `write` on B 
- `admin` on A and `read` on B 
- `write` on A and `read` on B 
As these would result in B having a more restrictive permission than A.
