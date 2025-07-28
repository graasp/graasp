/**
 * source: https://lexical.dev/docs/collaboration/faq#initializing-editorstate-from-yjs-document
 */
import { createHeadlessEditor } from '@lexical/headless';
import type { Binding, Provider } from '@lexical/yjs';
import { createBinding, syncLexicalUpdateToYjs, syncYjsChangesToLexical } from '@lexical/yjs';
import { eq } from 'drizzle-orm/sql';
import type {
  Klass,
  LexicalEditor,
  LexicalNode,
  LexicalNodeReplacement,
  SerializedEditorState,
  SerializedLexicalNode,
} from 'lexical';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { Doc, applyUpdate } from 'yjs';

import { db } from '../../../../drizzle/db';
import { pageTable } from '../../../../drizzle/schema';

export function headlessConvertYDocStateToLexicalJSON(
  nodes: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement>,
  yDocState: Uint8Array,
): SerializedEditorState<SerializedLexicalNode> {
  return withHeadlessCollaborationEditor(nodes, (editor, binding) => {
    applyUpdate(binding.doc, yDocState, { isUpdateRemote: true });
    editor.update(() => {}, { discrete: true });

    return editor.getEditorState().toJSON();
  });
}

export async function headlessConvertLexicalJSONToYDocState(id: string) {
  const page = await db.query.pageTable.findFirst({ where: eq(pageTable.itemId, id) });
  const editor = createHeadlessEditor({});

  const id1 = 'main';
  const doc = new Doc();
  const docMap = new Map([[id1, doc]]);
  const provider = createNoOpProvider();
  const binding = createBinding(editor, provider, id, doc, docMap);

  // init yjs doc content if page content exists
  // go through editor for a correct transformation
  if (page && page.content) {
    const unsubscribe = registerCollaborationListeners(editor, provider, binding);
    const editorState = editor.parseEditorState(page!.content);

    editor.setEditorState(editorState);
    editor.update(() => {}, { discrete: true });
    unsubscribe();
  }

  return binding.doc;
}

/**
 * Creates headless collaboration editor with no-op provider (since it won't
 * connect to message distribution infra) and binding. It also sets up
 * bi-directional synchronization between yDoc and editor
 */
function withHeadlessCollaborationEditor<T>(
  nodes: ReadonlyArray<Klass<LexicalNode> | LexicalNodeReplacement>,
  callback: (editor: LexicalEditor, binding: Binding, provider: Provider) => T,
): T {
  const editor = createHeadlessEditor({
    nodes,
  });

  const id = 'main';
  const doc = new Doc();
  const docMap = new Map([[id, doc]]);
  const provider = createNoOpProvider();
  const binding = createBinding(editor, provider, id, doc, docMap);

  const unsubscribe = registerCollaborationListeners(editor, provider, binding);

  const res = callback(editor, binding, provider);

  unsubscribe();

  return res;
}

function registerCollaborationListeners(
  editor: LexicalEditor,
  provider: Provider,
  binding: Binding,
): () => void {
  const unsubscribeUpdateListener = editor.registerUpdateListener(
    ({ dirtyElements, dirtyLeaves, editorState, normalizedNodes, prevEditorState, tags }) => {
      if (tags.has('skip-collab') === false) {
        syncLexicalUpdateToYjs(
          binding,
          provider,
          prevEditorState,
          editorState,
          dirtyElements,
          dirtyLeaves,
          normalizedNodes,
          tags,
        );
      }
    },
  );

  const observer = (events: Array<YEvent<any>>, transaction: Transaction) => {
    if (transaction.origin !== binding) {
      syncYjsChangesToLexical(binding, provider, events, false);
    }
  };

  binding.root.getSharedType().observeDeep(observer);

  return () => {
    unsubscribeUpdateListener();
    binding.root.getSharedType().unobserveDeep(observer);
  };
}

function createNoOpProvider(): Provider {
  const emptyFunction = () => {};

  return {
    awareness: {
      getLocalState: () => null,
      getStates: () => new Map(),
      off: emptyFunction,
      on: emptyFunction,
      setLocalState: emptyFunction,
    },
    connect: emptyFunction,
    disconnect: emptyFunction,
    off: emptyFunction,
    on: emptyFunction,
  };
}
