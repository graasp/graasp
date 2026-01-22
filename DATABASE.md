# Database Structure Guide

## Core Concept: Items & Hierarchies

The heart of this system is **Items**, they are containers for content. Items have a `type` to describe which kind of item they are. Items can be:

- **Folders** (containers that hold other items)
- **Documents** (text based resources)
- **Links** (references to external resources)
- **Files** (images, pdf, etc)
- **H5P** (references to external resources)
- **App** (references to an application)
- **Etherpad** (references to collaborative real-time text editor)

Items are organized in a **tree structure**, similar to folders on your computer:

```
My Workspace
├── Project A (#id-1)
│   ├── Document 1 (#id-2)
│   └── Document 2 (#id-3)
└── Project B (#id-4)
    └── Presentation (#id-5)
```

Each item has a `path` that shows its location in this hierarchy based on ids, like: `#id_1.#id_2`. Notice `-` are transformed into `_` in a `path`. For simplification this example uses readable ids, but the database structure uses UUID4 for identifiers (ie. `8a12ce1e-c58c-47a6-8ba2-742e0813d4ef`)

Core information about each item:

- `id`: Unique identifier
- `name`: What it's called
- `type`: Document, folder, link, etc.
- `path`: Location in the hierarchy
- `created_at` / `updated_at`: Timestamps
- `created_by`: The member who created it
- `deleted_at`: When it was deleted (`null` if not deleted) ← _Important for tracking deletions_

---

## Apps & Integrations

### Apps

Third-party or built-in applications that users can add to their folders. An app is composed of a name, description, URL, icon, thumbnail, publisher information, and configuration settings.

These curated apps integrate with the Graasp API using a configured API `key`, and can save user-specific data in three forms: `data` for information apps want to remember, `setting` for per-item configurations, and `action` for tracking usage. They are described in the sections below.

### App Data

App Data stores custom information that applications want to remember for each user, with visibility rules that control whether it's accessible to the account owner, the creator, or other users, and it's always tied to both a specific item and account.

### App Settings

App Settings provide per-item configuration that creators can customize and store as JSON data. These settings are available to all users accessing that item, but only administrators can edit them.

### App Actions

App Actions track when apps are used, recording which app was involved, what the user did with it, which item it happened on, and any custom data specific to that app interaction.

---

## Content Management

### Recycled Items

When items are deleted, they aren't actually removed from the database. Instead, a `deleted_at` timestamp marks the entire hierarchy as deleted, and one record in `recycled_item_data` is created for each deleted root item, allowing users to recover deleted content from the recycle bin.

Recycled items older than 3 months are scheduled to be automatically deleted.

### Item Visibility

The visibility of an item defines how it controls the access to it. There are 3 states:

- **Public**: Visible to anyone with the link
- **Hidden**: Not shown for readers
- **Private** (= no record): Only visible to people with explicit memberships

You can read more about memberships and access control under "Access & Permissions".

### Likes & Bookmarks

The `item_like` table records when someone "likes" an item.

The bookmarks (legacy name being `favorite` but still uses the table named `item_favorite`) tracks when someone saves an item to their bookmarks and have a quick access to it.

### Published Items

Published items are referenced in the library. An item is published if itself or its parent has a record in `published_items`. Its visibility should also be set to `public`. They can be unpublished at any time by the admins of the item.

### Publication Removal Notices

When administrators unpublish content from the admin panel, the system creates removal notices that record the reason for unpublishing and the date it occurred.

---

## Account Management

### Accounts (Members & Guests)

The system has two types of accounts, "members" and "guests".

#### Individual Members

Individual members are real people using the platform with an email address, a profile (including bio and avatar), and the ability to create items and collaborate with others. Their account `type` is set to `individual`.

#### Guests

Guest accounts are temporary accounts created for specific items, typically used to grant access without requiring full platform membership. Guests have limited permissions and may require passwords to access specific items. Their account `type` is set to `guest`.

**Related tables:**

- `guest_password`: Passwords for guest accounts to access a specific item
- `member_password`: Stores encrypted passwords for members
- `member_profile`: Additional info like bio, avatar, preferences

---

## Access & Permissions

### Item Memberships

Controls who has access to an item. They are three levels:

1. **Admin**: Can manage content and share access
1. **Write**: Can create and edit content
1. **Read**: Can view only

Each person can have different permission levels on an item hierarchy. From less permissive to most permissive, and the closest permission takes precedence.

For example if we have the following path `A.B.C` it is allowed to set a membership permission at each level for user Alice as followed:

- A: read
- B: write
- C: admin

So Alice can only read `A`, but is an admin for `C`.

### Membership Requests

When someone wants to join an item but doesn't have access yet, they create a request. Admins can approve or deny these requests.

### Invitations

Admins can invite people by email to access an item. The invitation includes:

- Email address of the person being invited
- Permission level they'll receive

### Short Links

Short Links are easy-to-share shortened URLs that point to specific items, redirecting users to the appropriate platform (builder, player, or library) and tracking who created the link and when.

### Item Login Schemas

When the item is private, it requires users to log in before accessing them. Additionally, an item can also allow "pseudonymized" login. If enabled, it will accept usernames, with or without passwords to access the item.

When someone logs in with these credentials, the system automatically creates a guest account linked to that login method. If the same person logs in again with the same credentials, their guest account is reused rather than creating a new one. This allows controlled access to specific items without requiring a full platform account.

Deleting an item login schema will delete all its related guests.

---

## Collaboration & Interaction

### Chat Messages

Each item has its own chatbox where users can have discussions. Each message records who wrote it (`creator_id`), when it was written (`created_at`), the message content (`body`), and which item it belongs to.

### Chat Mentions

Chat Mentions track when someone is mentioned in a chat message (@username), recording who was mentioned, whether they've read the mention, and when it was created.

---

## Item Publication

### Categories & Tags

Items can be organized with metadata that's especially useful for published content. Tags are user-defined and manually added to items, organized in categories like discipline, resource type, or level. Multiple tags can be assigned to each item to help with searching and filtering.

### Validation & Quality Control

Before publication, items are validated through automated checks including image validation. Each validation has a status of `pending`, `success`, or `failed`.

For each publication request, a validation group is created that references multiple validation records. If any validation fails, the item cannot be published.

The review table exists for future use but isn't currently active.

---

## Exports & Data Downloads

### Item Export Requests

When someone wants to download an item's content, the system records who made the request, which item or sub-tree of items they're exporting, the desired format (JSON, CSV, etc.), and when the request was made.

### Action Request Exports

Action Request Exports allow downloads of activity and action logs for user analytics and behavior tracking, capturing all interactions within a specified date range.

---

## Additional Item features

### Item Flags

Item Flags allow users to report problems with items, recording who reported it, the reason (spam, inappropriate content, etc.), and the status of the report (reviewed, resolved, etc.).

This feature is available but not heavily used currently.

### Geolocation

Items can optionally store location information, allowing them to be browsed and discovered on a map interface.

### Page Updates (Beta)

Items with type "page" use an alternative collaborative, real-time content editor. Updates are recorded in a dedicated table, and page content is built from these incremental updates. Retrieving complete page content requires reconstructing it from individual update records and a special library.

---

## Maintenance Notices

When important updates or critical maintenance is needed, the team schedules maintenance windows to inform users in advance. The system records the scheduled downtime period with start and end times, and can display messages to users about the maintenance.

---

## Actions (Analytic traces)

Actions are what users do, captured for analytics and displayed in dashboard graphics. Each action record includes the type of action, geographic location (if the user has allowed location tracking), when it occurred, which item was involved (if applicable), and which account performed it.

The system currently records a set of standard actions, but this list may be extended in the future.

---

## Need More Help?

Each table has detailed column information available. For specific analysis needs, refer to the technical schema documentation or contact the data team.
