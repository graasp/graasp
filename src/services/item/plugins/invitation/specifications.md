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
| `email` | Email address of the user | Yes | None (required) |
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

#### Handling Errors

The endpoint either performs all the requested memberships and invitations, or fails with an error.

Errors reasons might be related to:
- invalid file format
- empty file
- missing required emails in file
- missing access rights on items
- modification of existing persmissions on an item
- addition of an invitation on an item where an invitation for the same email already exists

#### Memberships

A data entry targeting an already existing membership will result in a `Modifying Existing` error.

#### Invitations

An email that is already invited on an item will be droped. 

Invitations can be set on parents or children of an item that already holds an invitation for the member but they need to follow [membership inheritance rules](../../../itemMembership/specifications.md#inheritance-rules).
