# Graasp Backend

![GitHub package.json version](https://img.shields.io/github/package-json/v/graasp/graasp?color=deepskyblue)

This repository contains the source code and confgurations for the Graasp Backend. Visit the Graasp Platform at [graasp.org](https://graasp.org)

❓Looking for our client applications/frontends ?
Head over to: [Builder](https://github.com/graasp/graasp-builder), [Player](https://github.com/graasp/graasp-player), [Library](https://github.com/graasp/graasp-library), [Analytics](https://github.com/graasp/graasp-analytics) or [Account](https://github.com/graasp/graasp-account)

## Requirements

In order to run the Graasp backend, it requires:

- Node v20
- NPM v9
- Yarn (can be installed through [`nvm`](https://github.com/nvm-sh/nvm))
- [Docker](https://docs.docker.com/get-docker/) : Docker is not necessary, it is possible to install everything locally. However it is strongly recommanded to use the Docker installation guide.

## Recommended Tools

- [NVM](https://github.com/nvm-sh/nvm) : CLI to manage multiple versions of Node.js and NPM.
- [Postman](https://www.postman.com) : Application to explore and test your APIs.
- [Starship](https://starship.rs/): A shell prompt enhancer that shows you the current git branch nvm version and package version, very usefull for quick look at your environment (works on all shells and is super fast), requires you to use a [NerdFont](https://www.nerdfonts.com/)
- [VS Code](https://code.visualstudio.com) : IDE to manage the database and make changes to the source code.
  - [Remote-Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) : A extension for VS Code. It allows to easily setup the dev environnement.

  - [SQLTools](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools) : A extension for VS Code. It allows easy access to the database.

## Installation

Graasp offers two ways to install the Graasp backend :

- [Docker](#docker-installation) (recommended) : this allows you to run a preconfigured environnement
- [Local](#local-installation) : you'll need to install and configure all the required services

### Docker installation

We recommend to set up the development environment using Docker, as it allows to use a preconfigured developement environnement.

First open the folder in the dev-container by using the command palette <kbd>cmd</kbd> + <kbd>shift</kbd> + <kbd>P</kbd> (or <kbd>ctrl</kbd> instead of <kbd>cmd</kbd>), and typing `Open Folder in Container`.

This will create 10 containers :

- `graasp-core` : Node.js backend of Graasp
- `graasp-postgres` : PostgreSQL database used by the backend
- `graasp-postgres-test` : PostgreSQL database used when running tests
- `graasp-etherpad` : Container for the etherpad service
- `graasp-postgres-etherpad` : PostgreSQL database used by the etherpad service
- `graasp-meilisearch` : Container for the meilisearch service
- `graasp-redis` : Redis instance to enable websockets
- `graasp-localstack` : Localstack instance use to fake S3 storage locally
- `graasp-iframely` : Iframely instance used to get embeds for links
- `mailer-1` : Simple mailer instance used to receive emails locally (see the [Utilities section](#utilities))

> **Important**
> To use localstack with the Docker installation, it is necessary to edit your `/etc/hosts` with the following line `127.0.0.1 localstack`. This is necessary because the backend creates signed urls with the localstack container hostname. Without changing the hosts, the developpement machine cannot resolve the `http://localstack` hostname.

Then install the required npm packages with `yarn install`. You should run this command in the docker's terminal, because some packages are built depending on the operating system (eg. `bcrypt`).

> **Info**
> If the process is killed during the installation of the packages, you'll need to increase the memory limit for docker.  
> To increase the memory limit, go to `Docker > Preferences > Resources` and change the memory from default (2 GB) to 8GB.

### Local Installation

First a running and accessible instance of PostgreSQL is required.

To enable websockets capabilities, it is required to have a running instance of [Redis](https://redis.io).

To use the backend with S3, it is required to have a running instance of [localstack](https://github.com/localstack/localstack).

Then open the folder locally and run the following command to install the required npm packages.

```sh
yarn install
```

## Configuration

To configure the application, you'll need to change the values in `.env.development`. The file should have the following structure :

> We provide sample values for development purposes aligned with the devcontainer configuration. Adjust these values as needed.

```bash
### Graasp back-end configuration

### Network configuration

# Default protocol is already set
# PROTOCOL=http
# The hostname is set by ./.devcontainer/docker-compose.yml
# HOSTNAME=0.0.0.0
PORT=3000
# The public URL is set by ./.devcontainer/docker-compose.yml
# PUBLIC_URL=
COOKIE_DOMAIN=localhost
CORS_ORIGIN_REGEX=^http?:\/\/(localhost)?:[0-9]{4}$

### Database configuration (set by ./.devcontainer/docker-compose.yml)
# DB_NAME=docker
# DB_USERNAME=docker
# DB_PASSWORD=docker
# DB_HOST=db
# If you use read replicas, set the hostnames here (separated by commas)
# DB_READ_REPLICA_HOSTS=
DATABASE_LOGS=true

### Sessions

# Session cookie key (to generate one: https://github.com/fastify/fastify-secure-session#using-a-pregenerated-key and https://github.com/fastify/fastify-secure-session#using-keys-as-strings)
# TLDR: npx @fastify/secure-session > secret-key && node -e "let fs=require('fs'),file=path.join(__dirname, 'secret-key');console.log(fs.readFileSync(file).toString('hex'));fs.unlinkSync(file)"
SECURE_SESSION_SECRET_KEY=<content>


### Auth

TOKEN_BASED_AUTH=true
# JWT secret (can use the same command as for SECURE_SESSION_SECRET_KEY)
JWT_SECRET=<content>
# Auth JWT secret (can use the same command as for SECURE_SESSION_SECRET_KEY)
AUTH_TOKEN_JWT_SECRET=<content>
AUTH_TOKEN_EXPIRATION_IN_MINUTES=10080
# Refresh JWT secret (can use the same command as for SECURE_SESSION_SECRET_KEY)
REFRESH_TOKEN_JWT_SECRET=<content>
REFRESH_TOKEN_EXPIRATION_IN_MINUTES=86400


### Mail server configuration

# Mailer config (set by ./.devcontainer/docker-compose.yml)
# Set to random values if you don't want to use the mock mailbox at http://localhost:1080
# MAILER_CONFIG_SMTP_HOST=mailer
# MAILER_CONFIG_USERNAME=graasp
# MAILER_CONFIG_PASSWORD=graasp


### File storages configuration

# If you are using a local installation of localstack replace by http://localhost:4566
# Otherwise this value is already set by ./.devcontainer/docker-compose.yml
# S3_FILE_ITEM_HOST=http://graasp-localstack:4566

# Graasp file item file storage path
# File item storage is set by ./.devcontainer/docker-compose.yml
# FILE_STORAGE_ROOT_PATH=

# Graasp s3 file item
S3_FILE_ITEM_PLUGIN=false
S3_FILE_ITEM_REGION=us-east-1
S3_FILE_ITEM_BUCKET=graasp
S3_FILE_ITEM_ACCESS_KEY_ID=graasp-user
S3_FILE_ITEM_SECRET_ACCESS_KEY=graasp-pwd

# Graasp H5P
H5P_FILE_STORAGE_TYPE=file
H5P_STORAGE_ROOT_PATH=/tmp/graasp-h5p/
H5P_PATH_PREFIX=h5p-content/


### External services configuration

# Graasp Etherpad (set by ./.devcontainer/docker-compose.yml)
# ETHERPAD_URL=http://etherpad:9001
# Optional, if the etherpad server has a different public URL than what the back-end uses to communicate with the service (e.g. private network)
# ETHERPAD_PUBLIC_URL=http://localhost:9001
# Optional, if the etherpad cookie domain is different from the domain of the public URL
# ETHERPAD_COOKIE_DOMAIN=localhost
# Api key is set by ./.devcontainer/etherpad/devApiKey.txt
# ETHERPAD_API_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Graasp embedded link item
# Set by ./.devcontainer/docker-compose.yml
# EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN=http://localhost:8061

# Graasp apps
APPS_JWT_SECRET=<content>
APPS_PUBLISHER_ID=<id>

# Graasp websockets
# Redis config set by ./.devcontainer/docker-compose.yml
# REDIS_HOST=redis
# REDIS_PORT=6379
# REDIS_USERNAME=
# REDIS_PASSWORD=

# Graasp Actions
SAVE_ACTIONS=true

# Client hosts
BUILDER_CLIENT_HOST=http://localhost:3111
PLAYER_CLIENT_HOST=http://localhost:3112
EXPLORER_CLIENT_HOST=http://localhost:3005
AUTH_CLIENT_HOST=http://localhost:3001
ACCOUNT_CLIENT_HOST=http://localhost:3114
ANALYZER_CLIENT_HOST=http://localhost:3005
GRAASP_MOBILE_BUILDER=graasp-mobile-builder

# validation containers
IMAGE_CLASSIFIER_API=<url>

# get a recaptcha secret access key for your hostname at http://www.google.com/recaptcha/admin
RECAPTCHA_SECRET_ACCESS_KEY=<content>
# Graasp search
MEILISEARCH_URL=http://graasp-meilisearch:7700
MEILISEARCH_MASTER_KEY=masterKey
MEILISEARCH_REBUILD_SECRET=secret

# Enable job scheduling (for cron based tasks)
JOB_SCHEDULING=true

# OPEN AI
# OPENAI_GPT_VERSION=<DEFAULT_GPT_VERSION> # valid values are gpt-4 or gpt-3.5-turbo
OPENAI_API_KEY=<token>
```

## Running

To run the application, use `yarn watch`. If any file change, the application will automatically reload.

## Utilities

The development [docker-compose.yml](.devcontainer/docker-compose.yml) provides an instance of [mailcatcher](https://mailcatcher.me/), which emulates a SMTP server for sending e-mails. When using the email authentication flow, the mailbox web UI is accessible at [http://localhost:1080](http://localhost:1080). If you do not want to use mailcatcher, set the `MAILER_CONFIG_SMTP_HOST` variable in your `.env.development` to some random value (e.g. empty string). This will log the authentication links in the server console instead.


## Database and Migrations

The application will run migrations on start.

### Create a migration

Migrations are saved in `src/migrations/*.ts`. They are then transformed into js files so typeorm can run them.

Run the generate and run command to create and apply the migration.

```sh
yarn migration:generate
yarn migration:run
```

If you need to revert

```sh
yarn migration:revert
```

To test your migrations, you can run

```sh
yarn migration:fake
```

Each migration should have its own test to verify the `up` and `down` procedures in `test/migrations`.

Up tests start from the previous migration state, insert mock data and apply the up procedure. Then each table should still contain the inserted data with necessary changes. The down tests have a similar approach.
