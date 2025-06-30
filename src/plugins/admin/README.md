# Admin plugin

The admin plugin is responsible for providing administrative access to feature to allowed users (called "admins").

## Authentication

The admins are authenticated using GitHub OAuth2 api.
We only store the user github ID and their username, as well as their last authentication time.

To allow a user to access the administration part, they need to exist in the `admins` table.
The `admins` table has a unique constraint on the `user_name` field.

To add a `someUser` as a new admin run the following statement:

```sql
insert into admins ("user_name") values ('someUser');
```

Replace `someUser` with the github handle of the user you want to authorize.

## Features

The Admin dashboard priovides multiple features to the admins.

### Queue Dashboard UI

The admins can access the BullMQ dashboard to check on queues and job status as well as trigger new jobs.

### TBA: email bulk send

This needs to be added.
