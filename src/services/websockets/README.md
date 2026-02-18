# graasp-plugin-websockets

A websockets extension for Graasp exposed through a fastify plugin

![](https://img.shields.io/github/actions/workflow/status/graasp/graasp-plugin-websockets/main.yml?branch=main)

This project provides back-end support for WebSockets in the Graasp ecosystem. It implements a Fastify plugin that can be registered into the core Graasp Fastify server instance.

This plugin provides real-time communication across Graasp server clusters and all connected clients through a channel broadcast abstraction implemented on top of WebSocket. It provides real-time events sent to clients following a publish / subscribe pattern.

## Usage

This plugin requires a [Redis](https://redis.io/) instance which serves as a relay when multiple instances of Graasp run as a cluster (for instance for load balancing purposes).

Add this plugin repository to the dependencies section of the `package.json` of your Graasp server instance:

```sh
yarn add @graasp/sdk @graasp/plugin-websockets
```

In the file of the designated WebSocket endpoint route, import the plugin:

```ts
import graaspWebSockets from '@graasp/plugin-websockets';
```

Register the plugin on your Fastify instance (here `instance` is the core Graasp Fastify instance, initialized / obtained beforehand):

```ts
    // make sure to register dependent services before!
    await instance.register(authPlugin, ...)
    await instance.register(itemService, ...)
    await instance.register(itemMembershipService, ...)
    //...
    // then register graasp-plugin-websockets as follows
    await instance.register(graaspWebSockets);
```

Services that are destructured from the Fastify instance in [`src/service-api.ts`](src/service-api.ts) must be registered beforehand and decorate it with the corresponding names, as defined in [`@graasp/sdk`](https://github.com/graasp/graasp-sdk) (i.e. `validateSession`, `log`, `items = { taskManager }`, ...)!

The plugin accepts the following options (which all have sane defaults):

```ts
    await instance.register(graaspWebSockets, {
        prefix: '/ws',
        redis: {
            config: {
                host: REDIS_HOST,
                port: +REDIS_PORT,
                username: REDIS_USERNAME,
                password: REDIS_PASSWORD,
                ... // any other RedisOptions property from 'ioredis'
            }
            channelName: 'graasp-notif',
        }
    });
```

where:

- `prefix` is the route of the websocket endpoint, relative to current registration scope. Websocket clients connect to this route to upgrade from HTTP(S) to WS(S).
- `redis.config` is the configuration required to connect to the Redis server instance, which can contain any property from the `RedisOptions` type from `ioredis` ([see API reference](https://luin.github.io/ioredis/index.html#RedisOptions)).
- `redis.channelName` is the name of the Redis pub/sub channel used to share websocket messages across multiple server instance (for instance in a cluster).

The plugin will also decorate the Fastify instance with a websocket service under the `websockets` property. Read [USAGE.md](USAGE.md) for instructions on how to consume this service from other parts of the server, such as other plugins.

## Adding behaviour with websockets

If you want to **use real-time updates from the server in front-end Graasp applications** (e.g. `graasp-compose`) that require real-time feedback or **add additional real-time behaviour that is not implemented yet**, make sure to follow this guide: [USAGE.md](USAGE.md)

## API

This plugin implements a custom protocol over WebSoket between clients and this server plugin to send real-time notifications for specific Graasp behaviours. Please read [`API.md`](API.md) for more information about the messages format used between the server and clients that subscribe to updates from `graasp-plugin-websockets`.

## Building locally

If you'd like to run the code for other purposes (such as reusing modules without Graasp or just trying things out locally), clone this repository with:

```
git clone https://github.com/graasp/graasp-plugin-websockets.git
```

Then navigate into the cloned folder:

```
cd graasp-plugin-websockets
```

Install the dependencies:

```
yarn install
```

Compile the code:

```
yarn build
```

Files are compiled into the `dist/` folder.

You can then run tests as described [below](#testing), or import parts of the implementation into your own files.

## Cleaning artifacts

You can clean compiled and generated files from the repository folder using:

```
yarn clean
```

## Testing

Several test suites are provided in folder [`test/`](test/). They include unit tests as well as end-to-end tests written for the [Jest](https://jestjs.io/) testing framework using the [ts-jest](https://kulshekhar.github.io/ts-jest/) transformer to run TypeScript tests directly. The configuration is specified by [`jest.config.js`](jest.config.js).

To run the tests, make sure that you have installed the dependencies at least once:

```
yarn install
```

Then simply use the `test` script (defined in [`package.json`](package.json)):

```
yarn test
```

You will obtain the Jest summary in the console.

### Code coverage

Jest will also provide code coverage results directly in the console. It also generates a detailed line coverage report in the `coverage/` folder.

You can inspect it by first running the tests and then opening the following file in your web browser (substitute `firefox` with your browser of choice, or simply find the file in your file manager and open it):

```
firefox coverage/lcov-report/index.html
```

You can then browse folders, files and lines of code with coverage annotations directly in your web browser.

### Lint issues

Code quality is enforced using [ESLint](https://eslint.org/) and its configuration is specified in [`.eslintrc.js`](.eslintrc.js) and [`.eslintignore`](.eslintignore).

To see a list of lint issues found in the code, run:

```
yarn lint
```

### Continuous integration

This repository also includes a run configuration for Github Actions in [`.github/workflows/main.yml`](.github/workflows/main.yml). [`package.json`](package.json) provides the `test:ci` script to be used for testing in continuous integration environments.

#### Troubleshooting

If your project depends on `graasp-plugin-websockets`, cannot fetch the `graasp-plugin-websockets` repository in your continuous integration system (such as Github Actions) and uses `yarn ci` as the install command, try using `yarn install` instead. There are known issues with Github SSH keys management.

## Repository structure

- [`.github/`](.github/): Github-related configurations, such as Actions
- [`src/`](src/): source code of the `graasp-plugin-websockets` plugin and its modules
- [`test/`](test/): Jest unit and end-to-end tests (file names match sources in `src/`)
- [`README.md`](README.md): [this file](README.md)
- [`tsconfig.json`](tsconfig.json): TypeScript compiler configuration

## Author

This project was originally written for a 2021 Master Semester project at the REACT group at EPFL:

- Alexandre CHAU (alexandre.chau@alumni.epfl.ch)
- [
  Coordination & Interaction Systems Group (REACT)](https://www.epfl.ch/labs/react/)
- [Ecole Polytechnique Fédérale de Lausanne (EPFL)](https://www.epfl.ch/)

Acknowledgements:

- André NOGUEIRA
- Kim PHAN
- Denis GILLET
- Nicolas MACRIS

## License

This project and repository are licensed under the GNU Affero General Public License Version 3. Please read the [LICENSE](LICENSE) file for more details.

```
    graasp-plugin-websockets - WebSockets for Graasp
    Copyright (C) 2021 EPFL REACT

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
```
