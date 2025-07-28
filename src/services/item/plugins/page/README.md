# Pages

## Collaboration

Collaboration is handled by yjs.js

The server files take their sources from this [example repository](https://github.com/yjs/y-websocket-server/).

Yjs saves a representation of Lexical format, which is not identical to Lexical's format. In the client, the lexical editor also applies a transformation from Yjs to Lexical to deduce the content.

[Lexical recommend having Yjs as the source of truth](https://lexical.dev/docs/collaboration/faq), that is, save Yjs's updates as is.
In our case, we want to handle "read" mode that would not need collaboration, so we better save Lexical's format as "snapshots". To save "snapshots", we need an Lexical instance to deduce its corresponding Yjs document's content and save it (as Lexical's format). [This page](https://lexical.dev/docs/collaboration/faq#initializing-editorstate-from-yjs-document) provide a headless transformation from Yjs to Lexical.
