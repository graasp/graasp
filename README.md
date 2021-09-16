# Requirements

In order to run the Graasp backend, it requires:

- Node v.14
- NPM v.6.14
- [Docker](https://docs.docker.com/get-docker/) : Docker is not necessary, it is possible to install everything locally. However it is strongly recommanded to use the Docker installation guide.

**IT IS IMPORTANT TO USE NPM 6.14 and Node.js 14**

# Recommended Tools

- [NVM](https://github.com/nvm-sh/nvm) : CLI to manage multiple versions of Node.js and NPM.

- [SourceTree](https://www.sourcetreeapp.com) : A free visual Git client for Windows and Mac.

- [Postman](https://www.postman.com) : Application to explore and test your APIs.

- [VS Code](https://code.visualstudio.com) : IDE to manage the database and make changes to the source code.

    - [Remote-Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) : A extension for VS Code. It allows to easily setup the dev environnement.

    - [SQLTools](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools) : A extension for VS Code. It allows easy access to the database.

# Docker installation (Recommanded) 

The installation with Docker is the recommanded way, it allows to use a preconfigured developement environnement.

First open the folder locally and run the following command to install the required npm packages.

`npm install`

Then you can open the folder in the dev-container by using the command palette <kbd>cmd</kbd> + <kbd>shift</kbd> + <kbd>P</kbd>, and typing `Open Folder in Container`.

This will create 3 containers :
- app : Node.js backend of Graasp
- db : PostgreSQL database used by the backend 
- redis : Redis instance to enable websockets

Then run the following command to install the required npm packages. Note : this is required because bcrypt use native libraires and it is not currently possible to directly install deps from the container.

`npm install bcrypt`

# Local Installation

First a running and accessible instance of PostgreSQL is required.

To enable websockets capabilities, it is required to have a running instance of [Redis](https://redis.io).

First open the folder locally and run the following command to install the required npm packages.

`npm install`

# Database creation

Before running the application you'll need to install the PostgreSQL database.

Then you'll need to execute the content of the `db-schema.sql`.

Install the corresponding schema if you are using any fo the following plugins :

- Item-Tags : [`db-schema.sql`](https://github.com/graasp/graasp-item-tags/blob/3/pinnedItem/db-schema.sql)

- Public-Items : [`db-schema.sql`](https://github.com/graasp/graasp-public-items/blob/main/db-schema.sql)

- Apps : [`db-schema.sql`](https://github.com/graasp/graasp-apps/blob/main/db-schema.sql)

- Item-Flagging [`db-schema.sql`](https://github.com/graasp/graasp-item-flagging/blob/master/db-schema.sql)

# Configuration

To configure the application, you'll need to change the values in  `development.env`. The file should have the following structure :

```` 
# Application server
# PROTOCOL=http
# HOSTNAME=localhost
PORT=3000
# EMAIL_LINKS_HOST=
# CLIENT_HOST=
# COOKIE_DOMAIN=
# CORS_ORIGIN_REGEX=

# Session cookie key (to generate one: https://github.com/fastify/fastify-secure-session#using-keys-as-strings)
SECURE_SESSION_SECRET_KEY=

# JWT secrets
JWT_SECRET=

TOKEN_BASED_AUTH=true
AUTH_TOKEN_JWT_SECRET=
AUTH_TOKEN_EXPIRATION_IN_MINUTES=10080
REFRESH_TOKEN_JWT_SECRET=
REFRESH_TOKEN_EXPIRATION_IN_MINUTES=86400

# PostgreSQL connection string
PG_CONNECTION_URI=postgresql://<user>:<password>@localhost:5432/<dbname>

# Slonik database logging (uncomment both)
# DATABASE_LOGS=true
# ROARR_LOG=true

# Mailer config
# MAILER_CONFIG_SMTP_HOST=
# MAILER_CONFIG_USERNAME=
# MAILER_CONFIG_PASSWORD=

# Graasp file item file storage path
FILE_STORAGE_ROOT_PATH=

# Graasp s3 file item
S3_FILE_ITEM_PLUGIN=false
# S3_FILE_ITEM_REGION=
# S3_FILE_ITEM_BUCKET=
# S3_FILE_ITEM_ACCESS_KEY_ID=
# S3_FILE_ITEM_SECRET_ACCESS_KEY=

# Graasp embedded link item
EMBEDDED_LINK_ITEM_PLUGIN=false
# EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN=<protocol>://<hostname>:<port>

# Graasp apps
APPS_PLUGIN=true
APPS_JWT_SECRET=

# Graasp websockets
WEBSOCKETS_PLUGIN=true
REDIS_HOST=graasp-redis
REDIS_PORT=6379
# REDIS_USERNAME=
# REDIS_PASSWORD=

# Graasp chatbox
CHATBOX_PLUGIN=true

# Graasp public items
PUBLIC_ITEMS_PLUGIN=true
````

# Running

To run the application, use `npm run watch`. If any file change, the application will automatically reload.