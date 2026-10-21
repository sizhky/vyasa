// One bundle so every ProseMirror package shares a single prosemirror-model;
// two copies of it make nodes from one fail `instanceof` checks in the other.
export { EditorState, Plugin, PluginKey, TextSelection, NodeSelection, Selection } from 'prosemirror-state';
export { EditorView } from 'prosemirror-view';
export { Schema, Fragment, Slice, DOMParser as PMDOMParser } from 'prosemirror-model';
export { keymap } from 'prosemirror-keymap';
export { history, undo, redo } from 'prosemirror-history';
export { baseKeymap, toggleMark, setBlockType, wrapIn, chainCommands, exitCode, joinBackward, lift } from 'prosemirror-commands';
export { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule, undoInputRule } from 'prosemirror-inputrules';
export { splitListItem, liftListItem, sinkListItem, wrapInList } from 'prosemirror-schema-list';
export { dropCursor } from 'prosemirror-dropcursor';
export { gapCursor } from 'prosemirror-gapcursor';
export { default as MarkdownIt } from 'markdown-it';
export { schema as markdownSchema, MarkdownParser, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';
export { Decoration, DecorationSet } from 'prosemirror-view';
export {
  tableNodes, tableEditing, goToNextCell, addRowAfter, addRowBefore, addColumnAfter, addColumnBefore,
  deleteRow, deleteColumn, isInTable, selectionCell, TableMap,
} from 'prosemirror-tables';
