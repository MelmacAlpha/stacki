import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { captureSelectionPositions } from '../src/features/collaboration/selectionPositions';
import { structuralEdits } from '../src/features/source/sourceOperations';
import {} from '../src/features/source/source';
import type { Peer } from '../src/features/collaboration/presence';

test('undoing a move preserves the other editor’s selected element and ownership', () => {
  const document = new Y.Doc();
  const text = document.getText('source');
  const original = '<main><h1>Heading</h1><p>Paragraph</p></main>';
  text.insert(0, original);
  const undo = new Y.UndoManager(text, { trackedOrigins: new Set(['structure']) });
  try {
    const edits = structuralEdits(original, {
      kind: 'move',
      node: 'n0.0',
      target: 'n0.1',
      placement: 'after',
    });
    document.transact(() => {
      for (const edit of edits.sort((a, b) => b.start - a.start)) {
        text.delete(edit.start, edit.end - edit.start);
        text.insert(edit.start, edit.text);
      }
    }, 'structure');
    const peers = new Map<string, Peer>([
      [
        'other',
        {
          id: 'other',
          selection: 'n0.0',
          editing: true,
          name: 'Other editor',
          file: 'src/pages/index.astro',
          page: 'src/pages/index.astro',
          occurrence: 0,
          updatedAt: 0,
        },
      ],
    ]);
    const restore = captureSelectionPositions(document, peers.values());
    undo.undo();
    restore(peers);
    assert.equal(text.toString(), original);
    assert.equal(peers.get('other')?.selection, 'n0.1');
    assert.equal(peers.get('other')?.editing, true);
    const restoreRedo = captureSelectionPositions(document, peers.values());
    undo.redo();
    restoreRedo(peers);
    assert.equal(peers.get('other')?.selection, 'n0.0');
  } finally {
    undo.destroy();
    document.destroy();
  }
});
