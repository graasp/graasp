# Import ZIP

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
