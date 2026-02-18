## `graasp-websockets` protocol specification

Rules for the messages transmitted over WebSocket for real-time notifications in Graasp

### Message format for Graasp

In the following code snippets, strings between angle brackets (`"<example>"`) are placeholder for dynamic values unless specified otherwise.

1. Messages are exchanged as strings over the WebSocket connection. Clients use the native WebSocket client or equivalent `send` ([API ref](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send)), while the server uses the [`ws` library](https://github.com/websockets/ws) `send`: ([API ref](https://github.com/websockets/ws/blob/master/doc/ws.md#websocketsenddata-options-callback)).

2. Message strings as described in (1) encode [JSON data](https://www.json.org/). They can be serialized and parsed using the [native `JSON` object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON) (e.g. `JSON.parse()` and `JSON.stringify()`) or using a library (such as [AJV](https://github.com/ajv-validator/ajv)).

3. All messages (from both client and server) must contain a `realm` field: it ensures that `graasp-websockets` can be extended in the future with other usages. The `realm` field must be set to `notif` for Graasp real-time update notifications.
    ```jsonc
    {
        "realm": "notif",
        // other fields ...
    }
    ```

4. Messages sent by clients provide an `action` field to perform subscriptions changes requests. Clients may send one of the following messages:

- Client subscribe: subscribe the WS client to the specified channel:
    ```jsonc
    {
        "realm": "notif",
        "action": "subscribe",
        "topic": "<topicName>",
        "channel": "<channelName>"
    }
    ```
    where:
    - `<channelName>` is the name of the channel to subscribe to in the `<topicName>` scope. The special value `broadcast` can be used to send messages to all clients, irrespective of the topic scope.
    - `<topicName>` is the kind of channel to subscribe to (defined by consumers of the websockets service: each topic name is unique and the owner of the topic must validate whether the client is allowed to subscribe to the specified channel. Note that channels are scoped by topic and are thus only unique **per topic**).

- Client unsubscribe: unsubscribe the WS client from the specified channel:
    ```jsonc
    {
        "realm": "notif",
        "action": "unsubscribe",
        "topic": "<topicName>",
        "channel": "<channelName>"
    }
    ```
    where `<channelName>` is the name of the channel in the specified `<topicName>` scope to unsubscribe from.

- Client subscribeOnly: unsubscribe the WS client from any channel it is currently subscribed to, and then subscribe it to the specified channel:
    ```jsonc
    {
        "realm": "notif",
        "action": "subscribeOnly",
        "topic": "<topicName>",
        "channel": "<channelName>"
    }
    ```
    where:
    - `<channelName>` is the name of the channel to subscribe to in the `<topicName>` scope. The special value `broadcast` can be used to send messages to all clients, irrespective of the topic scope.
    - `<topicName>` is the kind of channel to subscribe to (defined by consumers of the websockets service: each topic name is unique and the owner of the topic must validate whether the client is allowed to subscribe to the specified channel. Note that channels are scoped by topic and are thus only unique **per topic**).

- Client disconnect: unsubscribes the WS client from all channels it is currently subscribed to and unregisters the WS client from `graasp-websockets`:
    ```jsonc
    {
        "realm": "notif",
        "action": "disconnect"
    }
    ```
    **After** sending a client disconnect message, **later requests from this client are ignored**. A **new WS connection** must be initiated by the client before sending other requests.

5. Messages sent by the server are either responses to client requests, real-time update notifications, or info messages. The `type` field specifies this behaviour.

- Server responses: provide feedback to a client following a request.
    ```jsonc
    {
        "realm": "notif",
        "type": "response",
        "status": "<responseStatus>",
        "error": { // optional
            "name": "<errorName>",
            "message": "<errorMessage",
        },
        "request": { /* optional, client request copy */ }
    }
    ```
    where:
    - `<responseStatus>` represents the request completion status, either `success` or `error`
    - the `error` field is optional: if and only if the `<responseStatus>` is `error`, then the `error` field is populated, otherwise it is `undefined`. The error has a name and a descriptive message
    - the `request` field is optional and is populated with a copy of the client request object that generated this response. If the request could not be parsed into a valid object, `error.name` is set to `BAD_REQUEST` and the `request` field is left `undefined`  
    
    Possible error messages include:
    - `ACCESS_DENIED`: the client is not allowed to access the requested resource
    - `BAD_REQUEST`: the client sent a request which format was not understood by the server
    - `NOT_FOUND`: the client or the requested resource was not found on the server
    - `SERVER_ERROR`: unexpected server error while processing the request

- Real-time updates: notifications sent to the client from a given channel which it is subscribed to.
    ```jsonc
    {
        "realm": "notif",
        "type": "update",
        "topic": "<topicName>",
        "channel": "<channelName>",
        "body": { /* channel-specific object */ }
    }
    ```
    where `<topicName>` is the topic scope and `<channelName>` is the name of the channel on which the notification was sent. Each topic / channel pair may define its own message body type (by consumers of the websockets service).

- Real-time server info: other real-time notifications and broadcasts that do not belong to any specific channel
    ```jsonc
    {
        "realm": "notif",
        "type": "info",
        "message": "<message>",
        "extra": /* optional, any */
    }
    ```
    where `<message>` is the info message, and `extra` an optional object of any shape.

### Server-specific rules

- The shape of the JSON data is defined by both TypeScript interface definitions in `src/interfaces/` and as [JSON Type Definitions](https://jsontypedef.com/). This allows the AJV library to compile an optimized parser + validator and serializer pair ([doc](https://ajv.js.org/json-type-definition.html), [example](https://ajv.js.org/guide/typescript.html#type-safe-parsers-and-serializers)).