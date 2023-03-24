# Graasp

![GitHub package.json version](https://img.shields.io/github/package-json/v/graasp/graasp?color=deepskyblue)

## Requirements

In order to run the Graasp backend, it requires:

- Node v.16
- NPM v.7 or v.8
- Yarn
- [Docker](https://docs.docker.com/get-docker/) : Docker is not necessary, it is possible to install everything locally. However it is strongly recommanded to use the Docker installation guide.

## Recommended Tools

- [NVM](https://github.com/nvm-sh/nvm) : CLI to manage multiple versions of Node.js and NPM.

- [SourceTree](https://www.sourcetreeapp.com) : A free visual Git client for Windows and Mac.

- [Postman](https://www.postman.com) : Application to explore and test your APIs.

- [VS Code](https://code.visualstudio.com) : IDE to manage the database and make changes to the source code.

    - [Remote-Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) : A extension for VS Code. It allows to easily setup the dev environnement.

    - [SQLTools](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools) : A extension for VS Code. It allows easy access to the database.

## Installation

Graasp offers two ways to install the Graasp backend :

    - Docker : this allows you to run a preconfigured environnement (Recommended)
    - Local : you'll need to install and configure all the required services

### Docker installation (Recommended)

We recommend to set up the development environment using Docker, as it allows to use a preconfigured developement environnement.

First open the folder in the dev-container by using the command palette <kbd>cmd</kbd> + <kbd>shift</kbd> + <kbd>P</kbd> (or <kbd>ctrl</kbd> instead of <kbd>cmd</kbd>), and typing `Open Folder in Container`.

This will create 3 containers :
- `app` : Node.js backend of Graasp
- `db` : PostgreSQL database used by the backend
- `redis` : Redis instance to enable websockets
- `localstack` : Localstack instance use to locally test S3 storage

To use localstack with the Docker installation, it is necessary to edit your `/etc/hosts` with the following line `127.0.0.1 graasp-localstack`. This is necessary because the backend creates signed urls with the localstack container hostname. Without changing the hosts, the developpement machine cannot resolve the `http://graasp-localstack` hostname.

Then install the required npm packages with `yarn install`. You should run this command in the docker's terminal, because some packages are built depending on the operating system (eg. `bcrypt`).

If the process is killed during the installation of the packages, you'll need to increase the memory limit for docker.

To increase the memory limit, go to `Docker > Preferences > Resources` and change the memory from default (2 GB) to 8GB.

### Local Installation

First a running and accessible instance of PostgreSQL is required.

To enable websockets capabilities, it is required to have a running instance of [Redis](https://redis.io).

To use the backend with S3, it is required to have a running instance of [localstack](https://github.com/localstack/localstack).

Then open the folder locally and run the following command to install the required npm packages.

`yarn install`

### Database and Migrations

The application will run migrations on start. 

#### Create a migration
Run
```` bash
yarn migration:generate
yarn migration:run
````

If you need to revert
```` bash
yarn migration:revert
````

To test your migrations, you can run
```` bash
yarn migration:fake
````

### Configuration

To configure the application, you'll need to change the values in  `.env.development`. The file should have the following structure :

```` bash
# Application server
# PROTOCOL=http
# HOSTNAME=localhost
PORT=3000
# EMAIL_LINKS_HOST=
# CLIENT_HOST=
# COOKIE_DOMAIN=
CORS_ORIGIN_REGEX=^http?:\/\/(localhost)?:[0-9]{4}$

# Session cookie key (to generate one: https://github.com/fastify/fastify-secure-session#using-keys-as-strings)
SECURE_SESSION_SECRET_KEY=<content>

# JWT secrets
JWT_SECRET=<content>

TOKEN_BASED_AUTH=true
AUTH_TOKEN_JWT_SECRET=<content>
AUTH_TOKEN_EXPIRATION_IN_MINUTES=10080
REFRESH_TOKEN_JWT_SECRET=<content>
REFRESH_TOKEN_EXPIRATION_IN_MINUTES=86400

# PostgreSQL connection string
# If you are using dev-containers, this value is overwritten in docker-compose.yml
PG_CONNECTION_URI=postgresql://<user>:<password>@localhost:5432/<dbname>
# If you want to add read replicas to your DB cluster, provide their connection URIs here separated by commas
PG_READ_REPLICA_CONNECTION_URIS=

# Slonik database logging (uncomment both)
# DATABASE_LOGS=true
# ROARR_LOG=true

# Mailer config
# MAILER_CONFIG_SMTP_HOST=
# MAILER_CONFIG_USERNAME=
# MAILER_CONFIG_PASSWORD=

# Graasp file item file storage path
# If you are using dev-containers, this value is overwritten in docker-compose.yml
FILE_STORAGE_ROOT_PATH=

# Graasp s3 file item
S3_FILE_ITEM_PLUGIN=false
S3_FILE_ITEM_REGION=us-east-1
S3_FILE_ITEM_BUCKET=graasp
S3_FILE_ITEM_ACCESS_KEY_ID=graasp-user
S3_FILE_ITEM_SECRET_ACCESS_KEY=graasp-pwd

FILES_PATH_PREFIX=files/
AVATARS_PATH_PREFIX=avatars/
THUMBNAILS_PATH_PREFIX=items/

# If you are using a local installation of localstack replace by http://localhost:4566
# This value is only used for Dev or Test environments
S3_FILE_ITEM_HOST=http://graasp-localstack:4566

# Graasp H5P
H5P_CONTENT_REGION=us-east-1
H5P_CONTENT_BUCKET=graasp-h5p
H5P_CONTENT_ACCESS_KEY_ID=graasp-user
H5P_CONTENT_SECRET_ACCESS_KEY=graasp-pwd
H5P_PATH_PREFIX=h5p-content/

# Graasp Etherpad
ETHERPAD_URL=http://etherpad:9001
# Optional, if the etherpad server server has a different public URL than what the back-end uses to communicate with the service (e.g. private network)
ETHERPAD_PUBLIC_URL=http://localhost:9001
# Optional, if the etherpad cookie domain is different from the domain of the public URL
ETHERPAD_COOKIE_DOMAIN=localhost:9001
ETHERPAD_API_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Graasp embedded link item
EMBEDDED_LINK_ITEM_PLUGIN=false
# EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN=<protocol>://<hostname>:<port>

# Graasp apps
APPS_PLUGIN=true
APPS_JWT_SECRET=<content>
APPS_PUBLISHER_ID=<id>

# Graasp websockets
# If you are using a local installation and don't want to install redis, you can set WEBSOCKETS_PLUGIN to false
WEBSOCKETS_PLUGIN=true
REDIS_HOST=graasp-redis
REDIS_PORT=6379
# REDIS_USERNAME=
# REDIS_PASSWORD=

# Graasp chatbox
CHATBOX_PLUGIN=true

# Graasp public items
PUBLIC_PLUGIN=true
HIDDEN_TAG_ID=<tag-id>
PUBLISHED_TAG_ID=<tag-id>
PUBLIC_TAG_ID=<tag-id>
LOGIN_ITEM_TAG_ID=<tag-id>

# Graasp Actions and hosts
SAVE_ACTIONS=true
BUILDER_CLIENT_HOST=<value>
PLAYER_CLIENT_HOST=<value>
EXPLORER_CLIENT_HOST=<value>
AUTH_CLIENT_HOST=<value>

# validation containers
IMAGE_CLASSIFIER_API=<url>
````

## Running

To run the application, use `yarn watch`. If any file change, the application will automatically reload.
