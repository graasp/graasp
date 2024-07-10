# Item

## Properties

- `lang`: the language in which the item is written with. It can technically be any value as the column is a string, but it is ideally part of the supported languages of Graasp defined in @graasp/translations. We don't use an enum for the column definition because it might easily break if a new language is added in the frontend. Plus, this value should be at least the same set of member.extra.lang

The following properties exist in the database but are not returned to the client:

- `order`: the order in which the item is compared to its sibling. It is used to easily return an ordered array of siblings given a common parent. This order is an arbitrary positive float value. To prevent imprecision, rescaling happens after adding/moving items, setting a `DEFAULT_ORDER` interval between all `order` values. Bigger is this value, less imprecision we have. Items at the root have a `NULL` value.

  The order is computed as follow for inserting an item (reordering or creating):

- Adding an item **in between** other items place it exactly in between the two items' order.
- Adding an item **before all** other siblings place it exactly between 0 and the very first item's order.
- Adding an element at the **end** of the list will set the `order` at the very last item's order + `DEFAULT_ORDER`
- Adding an item in an **empty parent** will set it's order at `DEFAULT_ORDER`.

  `order` should never be duplicated in a same level, and cannot be `null` if the item is a child. If those cases happen, rescaling will be trigger to stable the ordering.

- `search_document`: word vector to perform full text search on. It is a combination of english, french and `lang` vectors.

## Endpoints

### POST /items?id=\<parentId\>&previousItemId=\<previousItemId\>

- `id`: optional. The new item will be created inside the provided item. If this parameter is not defined, the new item is created at the root
- `previousItemId`: optional. The new item will be created after the provided item.
  - If this parameter is not defined or does not exist in the provided parent, the new item is created at the beginning of the children array.

Rescaling the ordering should happen asynchronously after this call to prevent imprecision.

### PATCH /items/:id/reorder?previousItemId=\<previousItemId\>

- `id`: The item to reorder
- `previousItemId`: optional. The item will be reordered after the provided item.
  - If the corresponding item does not exist in the parent of the item, it throws.
  - If this parameter is not defined, the item will be reordered before all its siblings.

Rescaling the ordering should happen asynchronously after this call to prevent imprecision.
