# Graasp format export and import

## Export

### Export file structure

The export operation produces a single zip file. This file is a simple zip file that contains a `graasp-manifest.json` file and a collection of UUID-named files. The `graasp-manifest.json` file contains an ordered array where each item has the following structure:

```
- id (the newly generated ID that links the JSON item to the actual file in the zip)
- name (name of the item)
- type (item type)
- description (item description in HTML)
- settings (item settings)
- extra (item extras)
- thumbnailFilename (item thumbnail in the original size, if present)
- children (item children, in case of a folder item)
- mimetype (item file mimetype, in case there's a file attached to the item)
```

### Files and thumbnails

Files are stored in the top level of the zip. The filename is the same as the item ID in the manifest file. The thumbnails are also stored on the top-level and are named using the `{ID}-thumbnail` convention.

## Import

Upon the import, the uploaded ZIP file is scanned for the presence of a `graasp-manifest.json` file. If the file is present, it is scanned and then the items and their children are recursively imported, respecting the item order in the manifest file.

The `description` field for all items is sanitized before item creation.

### Item type-specific treatment

- `APP` - Not currently supported.
- `DOCUMENT` - The `name` and `content` fields are sanitized.
- `FOLDER` - The children are recursively imported, if present.
- `LINK` - Not currently supported.
- `FILE` - The file is imported with the same procedure as in the raw file import. The item is then created with the `extra` field based on the properties extracted from the file.
- `H5P` - The file is imported with the same procedure as the normal H5P upload. The `extra` field in the item is based on the properties extracted from the H5P file.
- `SHORTCUT` - Not currently supported.
- `ETHERPAD` - Not currently supported.

# Raw ZIP Import

## Sanitize

We base our sanitizing function on the default _sanitize_ function of [sanitize-html](https://www.npmjs.com/package/sanitize-html).

## Descriptions

Descriptions are saved in `<filename>.description.html`. They are sanitized.

## Supported files

### Special files (.name)

These files are ignored (ie. `.DS_STORE`).

### Empty files

These files are ignored.

### Links (.url)

Links are structured with 3 lines: `_source`, `link`, and `linkType`. The 3rd line defined whether a link is an _app_ or a _link_.

### HTML (.html)

We sanitize the result so it does not contain `<script>` (based on sanitize).
The result get saved in a _document_.

### TXT (.txt)

Text are sanitized and get transformed into a _document_.

### Others

All other files are saved as _files_. Their display will vary depending on the front-end interface.
