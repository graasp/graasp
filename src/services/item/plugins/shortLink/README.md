# Short Links Feature

This README explains the purpose of the short links feature.

## The Purpose of This Feature

A short link is a new method of accessing a resource using a shortened identifier. It can be either a random string or a user-defined alias, simplifying content sharing and access. A short link can be associated with a specific view, redirecting users to the builder, player, or library view.

A short link consists of alphanumeric characters (A-Z, a-z, and 0-9), with the only allowed special character being "-". It must not exceed 255 characters and should have a minimum length of 6 characters.

### Aliases Are Unique

Each short link serves as a unique identifier, pointing to a single item. While multiple short links can lead to the same item, a short link cannot point to multiple items. If a short link is deleted, its alias becomes available for reuse.

### Permissions

Only administrator members can manage the short links for an item. Content targeted by a short link is subject to standard access permissions.

## Example

Consider the resource "91013899-6b63-4dad-8901-d0144bda8d32". Normally, accessing this content requires navigating to "https://builder.graasp.org/items/91013899-6b63-4dad-8901-d0144bda8d32". The link may vary based on the view.

With a new short link named "my-course-2023", accessing the item is simplified to "https://go.graasp.org/my-course-2023." This short link can be configured to redirect users to the builder or other views like library or player.

Short links streamline content access and sharing.

## How the API Works

The API listens on the following routes:

- **GET:**
  - `/items/short-links/:alias` (unprotected)
    - Retrieve the redirection route based on the short link alias. Returns 404 if the alias does not exist; otherwise, returns 302 with the url to redirect to.
  - `/items/short-links/alias/:alias` (unprotected)
    - Get the short link by alias. Returns 404 if the alias does not exist; otherwise, returns 200 with the short link object.
    - Because this route is unprotected, only the itemId field is returned from the item.
  - `/items/short-links/available/:alias` (unprotected)
    - Check if the given alias already exists. Returns 200 with the availability encapsulated like `{ available: boolean }`.
  - `/items/short-links/list/:itemId` (item's members only)
    - Return all short links associated with the given item id. Returns status 200 with an empty list if the item has no short links or a list of short links if the item exists. Returns 404 if the item does not exist.
- **POST:**
  - `/items/short-links` (admin only)
    - Allow admins to create a new short link. The body must contain a valid 'alias', 'platform', and an existing 'item'. Allowed values for the platform are "player", "builder", "library". Returns 200 with the created short link on success, 400 for an invalid body, or 404 for an invalid item id.
- **PATCH:**
  - `/items/short-links/:alias` (admin only)
    - Allow admins to change the view or the name of the short link. The allowed body includes 'alias' and/or 'platform'. Returns 200 with the updated short link, 400 for an invalid body, or 404 if the alias is not found.
- **DELETE:**
  - `/items/short-links/:alias` (admin only)
    - Allow admins to remove a short link. Returns 200 with the removed short link on success or 404 if the short link is not valid.

## Possible improvements

- A landing page that allow to enter the alias and redirects the user to the right resource. This page could be used in the event of a 404 on go.graasp.org. It would be nice to allow user to use it also at home of go.graasp.org for example.
- For the moment, if the user accesses a go.graasp.org link while not logged in, he or she will have to log in, and then access the go.graasp.org link again. It may be a good idea to memorize the resource the user is trying to access, so as to redirect them after logging in.
