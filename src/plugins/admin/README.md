# Admin plugin

The admin plugin is responsible for providing administrative access to features for designated admin users (called "admins").

## Authentication

The admins are authenticated using GitHub OAuth2 api. For how to setup an OAuth app to work with your local setup see [Local setup for OAuth App](#local-setup-for-oauth-app)
We only store the user github ID and their username, as well as their last authentication time.

To allow a user to access the administration part, they need to exist in the `admins` table.
The `admins` table has a unique constraint on the `user_name` field.

### Local setup for OAuth app

For the admin feature to work in your local development environement you need to have GitHub OAuth app credentials. See the [GitHub OAuth app documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) for a full walkthrough of how to set one up.

For our purpose, you will need to create an OAuth app from your GitHub account.

1. Go to: Settings -> Developer Settings -> OAuth apps 
1. Create an OAuth app ("New OAuth app" button)
   1. Choose the name you want (i.e. "Admin dev" or "Local Graasp admin")
   1. For "Homepage URL" set `http://localhost:3000` 
   1. You can add a description (optional)
   1. Set the "Authorization callback URL" to `http://localhost:3000/admin/auth/github/callback`
   1. Validate
1. Copy the "Client Id" and paste it in your `.env.development` file next to the `GITHUB_CLIENT_ID` 
1. Generate a new client secret, copy it and paste it in your `.env.development` file next to `GITHUB_CLIENT_SECRET` (be carefull, as this value will not be shown again, you cna always re-generate it if you loose it, also DO NOT SHARE IT WITH ANYONE!)

With this in place, you just need to add the admins to the database following instructions in [adding admins](#adding-admins)

### Adding admins

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
