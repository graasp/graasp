# Item Geolocation

Geolocation attached to a hierarchy of items.
Geolocation can be inherited (a folder gives its geolocation to its children).

## Endpoints

- `GET /items/:id/geolocation`: return geolocation for item, inherits from parent
- `GET /items/geolocation?lat1<lat1>&lat2<lat2>&lng1<lng1>&lng2<lng2>`: return geolocations and their items within bounding box
- `PUT /items/:id/geolocation`: save geolocation for item
- `POST /items/map`: create an item including its geolocation
- `DELETE /items/:id/geolocation`: delete geolocation for item

## Hooks

Copying an item should copy the geolocation.
