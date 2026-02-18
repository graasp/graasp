# Item actions

An item is linked to actions captured across different views (Builder, Player, ...etc).
The action basically has the following properties

- `id`
- `view`: The service (builder, player, library) in which the action is captured.
- `type`: types listed within sdk [ActionTriggers](https://github.com/graasp/graasp-sdk/blob/main/src/enums/triggers.ts), such as `item-view`, `item-search`.
- `extra`: this field stores additional data relevant to the specific action.
- `item`: the related item.

## Endpoints

- `GET /items/:id/actions`: Retrieves a list of actions associated with a specific item.
- `GET /items/:id/actions/aggregation`: Fetches aggregated data for actions corresponding to the specified item id.
- `POST /items/:id/actions`: save item actions.
- `POST /items/:id/actions/export`: Exports actions tied to a particular item. The system sends the generated files to the user via email. Users are allowed to receive an archive in two formats once a day:

  - `json` (default format)

  ```json
  {
    "id": "id",
    "name": "name",
    "creator": {
      "id": "member-id",
      "name": "member-name"
    }
  }
  ```

  - `csv` we are converting JSON into CSV format. To address the challenge of nested objects, we flatten them as shown below:

  ```js
  const item = {
    id: 'id',
    name: 'name',
    creator: {
      id: 'member-id',
      name: 'member-name',
    },
  };

  const flattenItem = {
    id: 'id',
    namd: 'name',
    'creator.id': 'member-id',
    'creator.name': 'member-name',
  };
  ```

| id  | name | creator.id | creator.name |
| --- | ---- | ---------- | ------------ |
| id  | name | member-id  | member-name  |
