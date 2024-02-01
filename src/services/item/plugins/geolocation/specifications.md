# Item Geolocation

A geolocation attached to a hierarchy of items. It is composed of:

- `id`
- `lat`: latitude
- `lng`: longitude
- `country`: derived from `lat` and `lng`, could be `null`
- `item_path`: attached item, that can be inherited (a folder gives its geolocation to its children).

`lat` and `lng` are always defined. However they could not match a specific `country` (ie. ocean).

## Endpoints

- `GET /items/:id/geolocation`: return geolocation for item, inherits from parent
- `GET /items/geolocation`: return geolocations and their items within bounding box. Return folder with a geolocation but not its children without geolocation.
  - `lat1` & `lat2`: latitude bounds. Order does not matter
  - `lng1` & `lng2`: longitude bounds. Order does not matter
  - `keywords`: array of words to search. Returned results satisfies all the keywords.
- `PUT /items/:id/geolocation`: save geolocation for item, replace if it exists
- `DELETE /items/:id/geolocation`: delete geolocation for item

We use `POST /items` (item service) to add an item with a geolocation. The reason is mainly to avoid duplication (and more coherent keys invalidation in query client). If a geolocation (lat, lng) is partial the item cannot be created.

## Hooks

Copying an item should copy the geolocation.
