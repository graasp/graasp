# Graasp Backend

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-3-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

[![GitHub Release](https://img.shields.io/github/release/graasp/graasp)](https://github.com/graasp/graasp/releases/latest)
![Test CI](https://github.com/graasp/graasp/actions/workflows/test.yml/badge.svg?branch=main)
![typescript version](https://img.shields.io/github/package-json/dependency-version/graasp/graasp/dev/typescript)
[![Translations](https://gitlocalize.com/repo/9284/whole_project/badge.svg)](https://gitlocalize.com/repo/9284?utm_source=badge)

This repository contains the source code and configurations for the Graasp backend. Visit the Graasp Platform at [graasp.org](https://graasp.org)

❓Looking for our client applications/front-ends ?
Head over to: [Client](https://github.com/graasp/client), [Library](https://github.com/graasp/graasp-library)

## Requirements

In order to run the Graasp backend, it requires:

- Node version 22
- NPM version 10
- Yarn (can be installed through [`nvm`](https://github.com/nvm-sh/nvm))
- [Docker](https://docs.docker.com/get-docker/) or [Podman](https://podman.io/): Docker is not necessary, it is possible to install everything locally. However it is strongly recommended to use the Docker installation guide.

## Recommended Tools

- [NVM](https://github.com/nvm-sh/nvm) or [Volta (recommended)](https://volta.sh/) : CLI to manage multiple versions of NodeJs and NPM.
- [Postman](https://www.postman.com) : Application to explore and test your APIs.
- [Starship](https://starship.rs/): A shell prompt enhancer that shows you the current git branch nvm version and package version, very useful for quick look at your environment (works on all shells and is super fast), requires you to use a [NerdFont](https://www.nerdfonts.com/)
- [VS Code](https://code.visualstudio.com) : IDE to manage the database and make changes to the source code.

  - [Remote-Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) : A extension for VS Code. It allows to easily setup the dev environment.

  - [SQLTools](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools) : A extension for VS Code. It allows easy access to the database.

## Installation

Graasp offers two ways to install the Graasp backend :

- [Docker](#docker-installation) (recommended) : this allows you to run a preconfigured environment
- [Local](#local-installation) : you'll need to install and configure all the required services

### Docker installation

We recommend to set up the development environment using Docker, as it allows to use a preconfigured development environment.

First open the folder in the dev-container by using the command palette <kbd>cmd</kbd> + <kbd>shift</kbd> + <kbd>P</kbd> (or <kbd>ctrl</kbd> instead of <kbd>cmd</kbd>), and typing `Open Folder in Container`.

This will create 10 containers :

- `graasp-core` : Node.js backend of Graasp
- `db` : PostgreSQL cluster used by multiple services
- `graasp-etherpad` : Container for the etherpad service
- `graasp-meilisearch` : Container for the meilisearch service
- `graasp-redis` : Redis instance to enable websockets
- `graasp-localstack` : Localstack instance use to fake S3 storage locally
- `localfile` : Simple static file server to get files stored in graasp when using the `local` storage option (see the [Utilities section](#utilities))
- `graasp-iframely` : Iframely instance used to get embeds for links
- `mailer` : Simple mailer instance used to receive emails locally (see the [Utilities section](#utilities))

> **Important**
> To use localstack with the Docker installation, it is necessary to edit your `/etc/hosts` with the following line `127.0.0.1 localstack`. This is necessary because the backend creates signed urls with the localstack container hostname. Without changing the hosts, the development machine cannot resolve the `http://localstack` hostname.

Then install the required npm packages with `yarn install`. You should run this command in the docker's terminal, because some packages are built depending on the operating system (eg. `bcrypt`).

> **Info**
> If the process is killed during the installation of the packages, you'll need to increase the memory limit for docker.  
> To increase the memory limit, go to `Docker > Preferences > Resources` and change the memory from default (2 GB) to 8GB.

Once the packages are installed we need to bootstrap the database. Run this line in the terminal of the DevContainer. It will connect to the Postgres Engine running in the `db` container with the `docker` user and run the `bootstrapDB.sql` file. You will be asked for a password. Enter `docker`.

```sh
psql -h db -U docker -f bootstrapDB.sql
```

It will create 4 roles with their associated database for the services that need them:

- Graasp: the db for the backend
- Umami: google analytics replacement
- Etherpad: real-time documents
- Test: a test database that will be wiped during tests

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
PORT=3000
COOKIE_DOMAIN=localhost
CORS_ORIGIN_REGEX=^http?:\/\/(localhost)?:[0-9]{4}$

### Database configuration (set by ./.devcontainer/docker-compose.yml)
# DB_CONNECTION=postgres://graasper:graasper@db:5432/graasp?sslmode=disable
# If you use read replicas, set the connection strings here (separated by commas)
# DB_READ_REPLICA_CONNECTIONS=

### Sessions

# Session cookie key (to generate one: https://github.com/fastify/fastify-secure-session#using-a-pregenerated-key and https://github.com/fastify/fastify-secure-session#using-keys-as-strings)
# TLDR: npx @fastify/secure-session > secret-key && node -e "let fs=require('fs'),file=path.join(__dirname, 'secret-key');console.log(fs.readFileSync(file).toString('hex'));fs.unlinkSync(file)"
SECURE_SESSION_SECRET_KEY=<secret-key>


### Auth

# JWT secret (can use the same command as for SECURE_SESSION_SECRET_KEY)
JWT_SECRET=<secret-key>
# Auth JWT secret (can use the same command as for SECURE_SESSION_SECRET_KEY)
AUTH_TOKEN_JWT_SECRET=<secret-key>
# Refresh JWT secret (can use the same command as for SECURE_SESSION_SECRET_KEY)
REFRESH_TOKEN_JWT_SECRET=<secret-key>
# Password reset JWT secret (can use the same command as for SECURE_SESSION_SECRET_KEY)
PASSWORD_RESET_JWT_SECRET=<secret-key>
# Email change JWT secret (can use the same command as for SECURE_SESSION_SECRET_KEY)
EMAIL_CHANGE_JWT_SECRET=<secret-key>


### Mail server configuration

# Mailer config (set by ./.devcontainer/docker-compose.yml)
# Set to random values if you don't want to use the mock mailbox at http://localhost:1080
# MAILER_CONNECTION=


### File storages configuration

# If you are using a local installation of localstack replace by http://localhost:4566
# Otherwise this value is already set by ./.devcontainer/docker-compose.yml
# S3_FILE_ITEM_HOST=http://graasp-localstack:4566

# Graasp file item file storage path
# File item storage is set by ./.devcontainer/docker-compose.yml
# FILE_STORAGE_ROOT_PATH=
# FILE_STORAGE_HOST=http://localhost:1081

# Graasp s3 file item
FILE_STORAGE_TYPE=s3
S3_FILE_ITEM_REGION=us-east-1
S3_FILE_ITEM_BUCKET=graasp
S3_FILE_ITEM_ACCESS_KEY_ID=graasp-user
S3_FILE_ITEM_SECRET_ACCESS_KEY=graasp-pwd

# Graasp H5P
H5P_FILE_STORAGE_TYPE=local
H5P_STORAGE_ROOT_PATH=/tmp/graasp-h5p/
H5P_PATH_PREFIX=h5p-content/
H5P_FILE_STORAGE_HOST=http://localhost:1081


### External services configuration

# Graasp Etherpad (set by ./.devcontainer/docker-compose.yml)
# ETHERPAD_URL=http://etherpad:9001
# Optional, if the etherpad server has a different public URL than what the back-end uses to communicate with the service (e.g. private network)
# ETHERPAD_PUBLIC_URL=http://localhost:9001
# Optional, if the etherpad cookie domain is different from the domain of the public URL
# ETHERPAD_COOKIE_DOMAIN=localhost
# Api key is set by ./.devcontainer/etherpad/devApiKey.txt
# ETHERPAD_API_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Graasp embedded link item
# Set by ./.devcontainer/docker-compose.yml
# EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN=http://graasp-iframely:8061

# Graasp apps
APPS_JWT_SECRET=<secret-key>
APPS_PUBLISHER_ID=<id>

GRAASPER_CREATOR_ID=<id>

# Graasp websockets
# Redis config set by ./.devcontainer/docker-compose.yml
# redis[s]://[[username][:password]@][host][:port][/db-number]:
# REDIS_CONNECTION=

# Graasp Actions
SAVE_ACTIONS=true

# Client hosts
CLIENT_HOST=http://localhost:3114
LIBRARY_CLIENT_HOST=http://localhost:3005
GRAASP_MOBILE_BUILDER=graasp-mobile-builder

# This is already set in the docker-compose file, un-comment below if you want to override it
# IMAGE_CLASSIFIER_API=<url>

# get a recaptcha secret access key for your hostname at http://www.google.com/recaptcha/admin
RECAPTCHA_SECRET_ACCESS_KEY=<google-recaptcha-key>
# Graasp search
MEILISEARCH_URL=http://meilisearch:7700
MEILISEARCH_MASTER_KEY=masterKey
MEILISEARCH_REBUILD_SECRET=secret

# OPEN AI
# OPENAI_GPT_VERSION=<DEFAULT_GPT_VERSION> # valid values are gpt-4 or gpt-3.5-turbo
OPENAI_API_KEY=<openai-api-key>

# GEOLOCATION API - this can be empty if you don't use geolocation
GEOLOCATION_API_KEY=
```

### Umami

To log into umami in your local instance:
<https://umami.is/docs/login>

The first time you log in use username: `admin` and password: `umami`. It is recommended to change these.

## Running

To run the application, use `yarn watch`. If any file change, the application will automatically reload.

You can also run `yarn seed` to feed the database with predefined mock data.

## Utilities

The development [docker-compose.yml](.devcontainer/docker-compose.yml) provides an instance of [mailcatcher](https://mailcatcher.me/), which emulates a SMTP server for sending e-mails. When using the email authentication flow, the mailbox web UI is accessible at [http://localhost:1080](http://localhost:1080).

The development [docker-compose.yml](.devcontainer/docker-compose.yml) provides a [static file server](https://static-web-server.net/) for serving files when using the `local` storage option (alternative to the `s3` option). This option has the added benefit of being persistent when used locally in opposition to localstack (see the [known issues section](#known-issues) for more informations). The server is available at `http://localhost:1081`.

## Testing

To run the tests locally without obliterating your database you should create a new `.env.test` file that can contain the same values as your `.env.development` file.
Simply change the config values for the database connection:

```sh
DB_CONNECTION=postgres://test:test@db:5432/test?sslmode=disable
```

This will ensure your tests run on the second database container. As they will create new data and sometimes delete data between test runs you will not loose your development data.

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

## Known issues

The development environnement uses `localstack` as a local alternative to AWS s3 storage. But persistence accross restarts is not supported without the premium license.
This means that it is expected that you see 404 on uploaded files after a restart of your computer.
In details:

- the items are persisted in the DB
- the files stored on the fake s3 are not.

In the future we might investigate different solutions to mocking s3 storage, or improve the local storage to provide a durable local storage option.

## Openapi

Generate an `openapi.json` specification file by running the following query. You should have built the backend at least once beforehand.

```sh
yarn openapi:generate
```

You can then lint the specifications with

```sh
yarn openapi:lint
```

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://defferrard.dev/"><img src="https://avatars.githubusercontent.com/u/56632076?v=4?s=100" width="100px;" alt="Jeremy Defferrard"/><br /><sub><b>Jeremy Defferrard</b></sub></a><br /><a href="https://github.com/graasp/graasp/commits?author=Defferrard" title="Code">💻</a> <a href="https://github.com/graasp/graasp/commits?author=Defferrard" title="Tests">⚠️</a> <a href="https://github.com/graasp/graasp/commits?author=Defferrard" title="Documentation">📖</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/pyphilia"><img src="https://avatars.githubusercontent.com/u/11229627?v=4?s=100" width="100px;" alt="Kim Lan Phan Hoang"/><br /><sub><b>Kim Lan Phan Hoang</b></sub></a><br /><a href="https://github.com/graasp/graasp/commits?author=pyphilia" title="Code">💻</a> <a href="https://github.com/graasp/graasp/commits?author=pyphilia" title="Tests">⚠️</a> <a href="https://github.com/graasp/graasp/commits?author=pyphilia" title="Documentation">📖</a> <a href="#design-pyphilia" title="Design">🎨</a> <a href="https://github.com/graasp/graasp/issues?q=author%3Apyphilia" title="Bug reports">🐛</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/ReidyT"><img src="https://avatars.githubusercontent.com/u/147397675?v=4?s=100" width="100px;" alt="Thibault Reidy"/><br /><sub><b>Thibault Reidy</b></sub></a><br /><a href="https://github.com/graasp/graasp/commits?author=ReidyT" title="Code">💻</a> <a href="https://github.com/graasp/graasp/commits?author=ReidyT" title="Tests">⚠️</a> <a href="https://github.com/graasp/graasp/commits?author=ReidyT" title="Documentation">📖</a> <a href="https://github.com/graasp/graasp/issues?q=author%3AReidyT" title="Bug reports">🐛</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
