# Item actions

An item has a related actions grassped from different views (Builder, Player, ...etc)
The action basically has the following proporites

- `id`
- `view`: The context in which the action is viewed.
- `type`: types listed within sdk `ActionTriggers`.
- `extra`: this field stores additional data relevant to the specific action.
- `item`: the related item.

## Endpoints

- `GET /items/:id/actions`: Retrieves a list of actions associated with a specific item.
- `GET /items/:id/actions/aggregation`: Fetches aggregated data for actions corresponding to the specified item id.
- `POST /items/:id/actions`: save item actions.
- `POST /items/:id/actions/export`: Exports actions tied to a particular item. The system sends the generated files to the user via email. Users are allowed to receive an archive in two formats once a week:

  - `json` ( default format)
  - `csv` we use `papaParse` For CSV files, we use papaParse to convert JSON into CSV format. To address the challenge of nested objects, we flatten them as shown below:

  ```js
  const item = {
    id: 'id',
    namd: 'name',
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
