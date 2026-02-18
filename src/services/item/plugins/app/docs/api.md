# API

All following requests need an authentication token received as described in the [guide](./guide.md).

Therefore, don't forget to use `Authorization: Bearer <token>` in your request's headers.

### Table of Contents

- [App Actions](#app-actions)
- [App Context](#app-context)
- [App Data](#app-data)
- [App Settings](#app-settings)
- [Parent Window](#parent-window)

### Query strings

Within Graasp, the apps are given some information by query string:

- itemId: item id of the corresponding item

---

<a name="app-actions"></a>

## App Actions

App actions are analytic traces the app might save. They have the following structure:

- `id`: the app action id
- `account`: the member related to the app action (default: current authenticated member id).
- `member`: use `account`
- `item`: the item corresponding to the current app
- `data`: object containing any necessary data
- `type`: the related action related to the data
- `createdAt`: creation timestamp of the app action

### GET App Action

`GET <apiHost>/app-items/<item-id>/app-action`

- return value: an array of all app data related to `itemId`

### POST App Action

`POST <apiHost>/app-items/<item-id>/app-action`

- body: `{ data: { ... }, type, [visibility] }`
- returned value: created app action

---

<a name="app-data"></a>

## App Data

App data are all data the app might save. They have the following structure:

- `id`: the app data id
- `account`: the member related to the data (default: current authenticated member id)
- `member`: use `account`
- `item`: the item corresponding to the current app
- `data`: object containing any necessary data
- `type`: the related action related to the data
- `creator`: the member who created the app data
- `visibility`: availability of the app data, either `member` or `item` (default: `member`)
  - `member`: the app data can be managed by the creator and members with admin permission. Members with write permission can view them but cannot modify them.
  - `item`: the app data can be managed by the creator and members with admin permission. All other members can view them but cannot modify them.
- `createdAt`: creation timestamp of the app data
- `updatedAt`: update timestamp of the app data

### Permissions and visibility

Currently, there is no difference between `read` and `write` permission when using the app API.

User with `admin` permission can get/patch/delete any app data. User with `read` or `write` permission can get app data that they created or that are adressed to them (with `member` being set to their member id).

App data that have their visibility set to `member` can only be seen (get) by their creator, member, all `admin`. App data with visibility set to `item` can be seen by all users, but only creator, member, and admin can patch/delete them.

Consider an app with three users:

1. A with `admin` permission
2. B with `read` permission
3. C with `read` permission
4. O with `read` permission

See examples of allowed operations in the table below.

| App Data                                                                 | A                | B                | C                | O   |
| ------------------------------------------------------------------------ | ---------------- | ---------------- | ---------------- | --- |
| **App data 1** - _creator: **B**, member: **B**, visibility: **member**_ | get/patch/delete | get/patch/delete | -                | -   |
| **App data 1** - _creator: **B**, member: **B**, visibility: **item**_   | get/patch/delete | get/patch/delete | get              | get |
| **App data 1** - _creator: **B**, member: **C**, visibility: **member**_ | get/patch/delete | get/patch/delete | get/patch/delete | -   |
| **App data 1** - _creator: **B**, member: **C**, visibility: **item**_   | get/patch/delete | get/patch/delete | get/patch/delete | get |
| **App data 1** - _creator: **A**, member: **B**, visibility: **member**_ | get/patch/delete | get/patch/delete | -                | -   |
| **App data 1** - _creator: **A**, member: **B**, visibility: **item**_   | get/patch/delete | get/patch/delete | get              | get |
| **App data 1** - _creator: **A**, member: **A**, visibility: **member**_ | get/patch/delete | -                | -                | -   |
| **App data 1** - _creator: **A**, member: **A**, visibility: **item**_   | get/patch/delete | get              | get              | get |

### GET App Data

`GET <apiHost>/app-items/<item-id>/app-data`

- return value: an array of all app data related to `itemId`

### POST App Data

`POST <apiHost>/app-items/<item-id>/app-data`

- body: `{ data: { ... }, type, [accountId], [visibility] }`

  `accountId` is used to adress the app data to another member. All logged users can send an app data to another user.

- returned value: created app data

### PATCH App Data

`PATCH <apiHost>/app-items/<item-id>/app-data/<app-data-id>`

- body: `{ data: { ... } }`
- returned value: patched app data

### DELETE App Data

`DELETE <apiHost>/app-items/<item-id>/app-data/<app-data-id>`

- returned value: deleted app data

### Upload a file as an app data

`POST <apiHost>/app-items/upload?id=<item-id>`

- it is not possible to patch a file app setting
- send files as form data, the name of the file will be the name of the app setting
- returned value: created app setting

### Download a file from an app data

`GET <apiHost>/app-items/<app-data-id>/download`

- returned value: signed url of the file

---

<a name="app-context"></a>

## App Context

The app context contains additional information which might be interesting for your app such as:

- `members`: a list of all the members having access to the app's parent and the app itself
- `item`: all corresponding item properties

### GET App Action

`GET <apiHost>/app-items/<item-id>/context`

- return value: the context of the corresponding item

---

<a name="app-settings"></a>

## App Settings

App settings store the app configuration. Only members with the admin permission can create, update and delete them. The other members can only fetch the app settings.

If the related item is copied, its app settings are copied alongside, opposed to app data.

App settings have the following structure:

- `id`: the app setting id
- `name`: the app setting name
- `item`: the item corresponding to the current app
- `data`: object containing any necessary setting
- `creator`: the member who created the app setting
- `createdAt`: creation timestamp of the app setting
- `updatedAt`: update timestamp of the app setting

### GET App Setting

`GET <apiHost>/app-items/<item-id>/app-settings`

- return value: an array of all app settings related to `itemId`

### POST App Setting

`POST <apiHost>/app-items/<item-id>/app-settings`

- body: `{ name, data: { ... } }`
- returned value: created app setting

### PATCH App Setting

`PATCH <apiHost>/app-items/<item-id>/app-settings/<app-setting-id>`

- body: `{ data: { ... } }`
- permission: only member with the admin permission can patch an app setting
- it is not possible to patch a file app setting
- returned value: patched app setting

### DELETE App Setting

`DELETE <apiHost>/app-items/<item-id>/app-settings/<app-setting-id>`

- returned value: deleted app data
- permission: only member with the admin permission can delete an app setting

### Upload a file as an app setting

`POST <apiHost>/app-items/app-settings/upload?id=<item-id>`

- it is not possible to patch a file app setting
- send files as form data, the name of the file will be the name of the app setting
- returned value: created app setting

### Download a file from an app setting

`GET <apiHost>/app-items/app-settings/<app-setting-id>/download`

- returned value: signed url of the file

---

<a name="parent-window"></a>

## Parent Window

Since apps are embedded in Graasp with an iframe, it is possible to communicate with the parent window using both regular `window.postMessage` and `MessageChannel`. One should first use `window.postMessage` to get the context, as well as the `MessageChannel`'s port to continue the process (see [guide](./guide.md)).

### `window.postMessage`

### GET Context

```js
postMessage(
    JSON.stringify({
      type: 'GET_CONTEXT',
    }
);
```

- return values:
  - `apiHost`: the api host origin
  - `context`: where the app is running (eg: `builder`, `explorer`, `standalone`, ...)
  - `itemId`: item id which corresponds to your app resource id
  - `lang`: language
  - `accountId`: the current authenticated user using the app
  - `memberId`: use `accountId`
  - `permission`: the current member's permission
  - `settings`: the corresponding item settings
  - as well as the `port` of the `MessageChannel` you will use from now on to communicate with the parent window.

### `MessageChannel`

### GET Authentication Token

```js
port.postMessage(
    JSON.stringify({
      type: 'GET_AUTH_TOKEN',
      payload: {
        key: <app key>,
        origin: <app origin>,
      },
    })
  );
```

- return value: authentication token
