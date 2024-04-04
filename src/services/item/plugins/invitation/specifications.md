# Invitations

This plugin handles invitations.

## Available routes

### Get a single invitation

Route: `GET /items/invitations/:id` 
Params: 
> Does not require authentication

### Create invitations for an item

Route: `POST /items/:id/invite`

### Add users from a CSV

Route: `POST /items/:id/invitations/upload-csv`
Body: Multipart Form containing a csv file.

#### CSV File specifications

| Column Name | Description | Required | Default Value |
|---|---|---|---|
| `email` | Email adress of the user | Yes | None (required) |
| `name` | Name to use when creating the user | No | Use the name in the email |
| `permission` | Permission level you want to grant to the user | No | `read` |
| `group_name` | The group to which the user should be added. Only relevant when using the template feature | If present should be present for all users | None (required if present for one user) | 

**NOTES**: 
- Order of the columns is not important.
- Spaces around the delimiter are supported

#### Valid CSV files

A single user specified only by email, will receive `read` permission
```csv
email
alice@example.com
```

Multiple users specified with email and name
```csv
name, email
Alice, alice@example.com
Bob, bob@example.com
```

Also works with no spaces
```csv
name,email
Alice,alice@example.com
Bob,bob@example.com
```

Multiple users with not all permissions set
```csv
email, name, permission
alice@example.com, Alice, read
bob@example.com, Bob
```

Permissions can be left blank too
```csv
email, permission, name
alice@example.com,, Alice
```

#### Handling duplicates

#### Memberships

A data entry targeting an already existing membership will result in a `Modifying Existing` error.

#### Invitations

An email that is already invited on an item will be droped. 

Invitations can be set on parents or children of an item that already holds an invitation for the member but they need to follow membership inheritance rules:
- A children membership can not be more restrictive (lower permission) than its parent memberships
- A children membership can be more permissive (higher permission) than its parent membership

Example: 
If we have the following structure: A (parent) > B (children)
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
