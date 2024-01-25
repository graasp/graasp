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
- `GET /items/geolocation?lat1<lat1>&lat2<lat2>&lng1<lng1>&lng2<lng2>`: return geolocations and their items within bounding box. Return folder with a geolocation but not its children without geolocation.
- `PUT /items/:id/geolocation`: save geolocation for item, replace if it exists
- `DELETE /items/:id/geolocation`: delete geolocation for item

We use `POST /items` (item service) to add an item with a geolocation. The reason is mainly to avoid duplication (and more coherent keys invalidation in query client). If a geolocation (lat, lng) is partial the item cannot be created.

## Hooks

Copying an item should copy the geolocation.
