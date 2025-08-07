# Pages

## Collaboration

Collaboration is handled by [yjs.js](https://docs.yjs.dev/).

The server files take their sources from this [example repository](https://github.com/yjs/y-websocket-server/).

The yjs's updates are saved in `page_update` and merged (given an update count threshold) to prevent storing too much data.

`page_update` is agnostic of the data `update` it contains.

## Tests

Controller tests use [`y-websocket`](https://github.com/yjs/y-websocket) to connect to the websocket endpoint. This allows to simulate a change in a yjs document to be reflected in the server.
