# Item Geolocation

Geolocation attached to a hierarchy of items.
Geolocation can be inherited (a folder gives its geolocation to its children).

## Endpoints

- `GET /items/:id/geolocation`
- `GET /items/geolocation?lat1<lat1>&lat2<lat2>&lng1<lng1>&lng2<lng2>`
- `PUT /items/:id/geolocation`
- `POST /items/map`
- `DELETE /items/:id/geolocation`

## Hooks

Copying an item should copy the geolocation.
