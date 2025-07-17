# Admin plugin

The admin plugin is responsible for providing administrative access to features for designated admin users (called "admins").

## Authentication

The admins are authenticated using GitHub OAuth2 api. For how to setup an OAuth app to work with your local setup see [Local setup for OAuth App](#local-setup-for-oauth-app)
We only store the user's github id and github username, as well as the last authentication time (updated each time user logs in).

To allow a user to access the administration part, they need to exist in the `admin` table.
The `admin` table has a unique constraint on the `github_name` and `github_id` fields.

### Local setup for OAuth app

> There is currently no way to have the admin work without a valid GitHub OAuth client id and secret. This might be added in the future.

For the admin feature to work in your local development environment you need to have GitHub OAuth app credentials. See the [GitHub OAuth app documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) for a full walkthrough of how to set one up.

For our purpose, you will need to create an OAuth app from your GitHub account.

1. Go to: Settings -> Developer Settings -> OAuth apps 
1. Create an OAuth app ("New OAuth app" button)
   1. Choose the name you want (i.e. "Admin dev" or "Local Graasp admin")
   1. For "Homepage URL" set `http://localhost:3000` 
   1. You can add a description (optional)
   1. Set the "Authorization callback URL" to `http://localhost:3000/admin/auth/github/callback`
   1. Validate
1. Copy the "Client Id" and paste it in your `.env.development` file next to the `GITHUB_CLIENT_ID` 
1. Generate a new client secret, copy it and paste it in your `.env.development` file next to `GITHUB_CLIENT_SECRET` (be careful, as this value will not be shown again, you can always re-generate it if you loose it, also DO NOT SHARE IT WITH ANYONE!)

With this in place, you just need to add the admins to the database following instructions in [adding admins](#adding-admins)

### Adding admins

To add a new admin you need to know their github `id`. You can get the user `id` using a call to the github API if you know their username (github handle).
To get the github id:

```sh
curl -s https://api.github.com/users/<user_name> | jq '.id'
```

The number output is the unique github id for that user.

Add the new admin by their id and username using the following statement:

```sql
insert into admins ("github_id", "github_name") values ('<user_id>', '<user_name>');
```

Replace `<user_id>` and `<user_name>` with the github id and the github handle of the user you want to authorize.

## Features

The Admin dashboard provides multiple features to the admins.

### Queue Dashboard UI

The admins can access the BullMQ dashboard to check on queues and job status as well as trigger new jobs.

### TBA: email bulk send

This needs to be added.
