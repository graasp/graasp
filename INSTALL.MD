# Required software

In order to run the Graasp backend, the following software is needed :

- Node v.14
- NPM v.6.14
- [Docker](https://docs.docker.com/get-docker/)

**IT IS IMPORTANT TO USE NPM 6.14 and Node.js 14**

# Recommanded software

- [VS Code](https://code.visualstudio.com) : IDE to manage the database and make changes to the source code.
- [NVM](https://github.com/nvm-sh/nvm) : CLI to manage multiple versions of Node.js and NPM. It is recommanded to be easily able to build plugins locally.

# Installation

First open the folder locally and run the following command to install the required npm packages.
`npm install`

The you can open the folder in the dev-container by using the command palette <kbd>cmd</kbd> + <kbd>shift</kbd> + <kbd>P</kbd>, and typing `Open Folder in Container`.

This will create 3 containers :
- app : Node.js backend of Graasp
- db : PostgreSQL database used by the backend 
- redis : Redis database used to store chat messages

The run the following command to install the required npm packages.

`npm install bcrypt`

Before running the application you'll need to install the PostgreSQL database. The recommanded way is to install The [SQLTools](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools) extension for VS Code. It allows easy access to the database container.

Then you'll need to execute the content of the `db-schema.sql`.

Then you'll need to execute the content of the [`db-schema.sql`](https://github.com/graasp/graasp-item-tags/blob/3/pinnedItem/db-schema.sql) for the tags plugin.

Then you'll need to execute the content of the [`db-schema.sql`](https://github.com/graasp/graasp-public-items/blob/main/db-schema.sql) for the public items plugin.

Then you'll need to execute the content of the [`db-schema.sql`](https://github.com/graasp/graasp-apps/blob/main/db-schema.sql) for the apps plugin.

Then you'll need to execute the content of the [`db-schema.sql`](https://github.com/graasp/graasp-item-flagging/blob/master/db-schema.sql) for the flaggin plugin.

# Configuration

To configure the application, you'll need to add a change the values in  `development.env`. Normally this is not necessay.

# Running
Run the watch command to automatically reload the files `npm run watch`.