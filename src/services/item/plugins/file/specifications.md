# Item: Files

## POST /upload?id=\<parentId\>&previousItemId=\<previousItemId\>

- `id`: optional. The new item will be created inside the provided item. If this parameter is not defined, the new item is created at the root
- `previousItemId`: optional. The new item will be created after the provided item.
  - If this parameter is not defined or does not exist in the provided parent, the new item is created at the beginning of the children array.

One can upload one or many files at once in `parentId`, after given `previousItemId`. The upload process happens in parallel transactions, one per file.

The order between files is not guaranteed. To prevent files to have the same order on insert, a rescaling is applied synchronously after uploading them.
