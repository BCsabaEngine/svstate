import { get } from 'svelte/store';

import { undoRedoPlugin } from '../src/plugins/undo-redo';
import { createSvState } from '../src/state.svelte';

const createTestState = () => {
  const undoRedo = undoRedoPlugin<{ name: string; count: number }>();
  const result = createSvState(
    { name: 'initial', count: 0 },
    { effect: ({ snapshot, property }) => snapshot(`Changed ${property}`) },
    { plugins: [undoRedo] }
  );
  return { ...result, undoRedo };
};

describe('undoRedoPlugin', () => {
  it('should redo after rollback', () => {
    const { data, rollback, undoRedo } = createTestState();

    data.name = 'updated';
    rollback();

    expect(data.name).toBe('initial');
    expect(undoRedo.canRedo()).toBe(true);

    undoRedo.redo();
    expect(data.name).toBe('updated');
  });

  it('should return correct canRedo', () => {
    const { data, rollback, undoRedo } = createTestState();

    expect(undoRedo.canRedo()).toBe(false);

    data.name = 'updated';
    expect(undoRedo.canRedo()).toBe(false);

    rollback();
    expect(undoRedo.canRedo()).toBe(true);
  });

  it('should clear redo stack on change', () => {
    const { data, rollback, undoRedo } = createTestState();

    data.name = 'first';
    rollback();
    expect(undoRedo.canRedo()).toBe(true);

    data.name = 'new-change';
    expect(undoRedo.canRedo()).toBe(false);
  });

  it('should clear redo stack on reset', () => {
    const { data, rollback, reset, undoRedo } = createTestState();

    data.name = 'first';
    rollback();
    expect(undoRedo.canRedo()).toBe(true);

    data.name = 'second';
    reset();
    expect(undoRedo.canRedo()).toBe(false);
  });

  it('should handle multiple undo/redo cycles', () => {
    const { data, rollback, undoRedo } = createTestState();

    data.name = 'first';
    data.count = 10; // Different property = different snapshot title

    rollback();
    expect(data.count).toBe(0);
    expect(data.name).toBe('first');
    expect(undoRedo.canRedo()).toBe(true);

    undoRedo.redo();
    expect(data.count).toBe(10);
  });

  it('should update redoStack store reactively', () => {
    const { data, rollback, undoRedo } = createTestState();

    expect(get(undoRedo.redoStack)).toHaveLength(0);

    data.name = 'updated';
    rollback();
    expect(get(undoRedo.redoStack)).toHaveLength(1);

    undoRedo.redo();
    expect(get(undoRedo.redoStack)).toHaveLength(0);
  });

  it('should not redo when stack is empty', () => {
    const { data, undoRedo } = createTestState();

    data.name = 'updated';
    undoRedo.redo(); // should be no-op
    expect(data.name).toBe('updated');
  });

  it('should clean up subscription on destroy', () => {
    const { destroy, undoRedo } = createTestState();

    // Should not throw
    destroy();
    expect(undoRedo.canRedo()).toBe(false);
  });

  it('should not push a redo entry when rollback(0) leaves the snapshot list unchanged', () => {
    const { data, rollback, undoRedo } = createTestState();

    data.name = 'updated';
    // steps=0 targets the current tip, so restoreToSnapshot doesn't shrink the snapshot list
    // and the plugin's subscription never captures a "previous tip" to push onto the redo stack
    rollback(0);

    expect(data.name).toBe('updated');
    expect(undoRedo.canRedo()).toBe(false);
  });
});

describe('undoRedoPlugin maxRedoStack', () => {
  it('should drop the oldest redo entry once the configured maximum is exceeded', () => {
    const undoRedo = undoRedoPlugin<{ a: number; b: number; c: number }>({ maxRedoStack: 2 });
    const { data, rollback } = createSvState(
      { a: 0, b: 0, c: 0 },
      { effect: ({ snapshot, property }) => snapshot(`Changed ${property}`) },
      { plugins: [undoRedo] }
    );

    data.a = 1; // Changed a
    data.b = 2; // Changed b
    data.c = 3; // Changed c

    // Each rollback undoes the current tip and pushes it onto the redo stack, so the push order
    // is the reverse of the change order: "Changed c" first, then "Changed b", then "Changed a"
    rollback();
    rollback();
    rollback();

    const stack = get(undoRedo.redoStack);
    // "Changed c" (pushed first) is dropped once the stack exceeds maxRedoStack
    expect(stack.map((s) => s.title)).toEqual(['Changed b', 'Changed a']);
  });
});

describe('undoRedoPlugin multi-step redo', () => {
  it('should redo each rolled-back step in turn', () => {
    const undoRedo = undoRedoPlugin<{ name: string; count: number }>();
    const { data, rollback } = createSvState(
      { name: 'initial', count: 0 },
      { effect: ({ snapshot, property }) => snapshot(`Changed ${property}`) },
      { plugins: [undoRedo] }
    );

    data.name = 'first';
    data.count = 10;

    rollback();
    rollback();

    expect(data.name).toBe('initial');
    expect(data.count).toBe(0);
    expect(get(undoRedo.redoStack)).toHaveLength(2);

    undoRedo.redo();
    expect(data.name).toBe('first');
    expect(get(undoRedo.redoStack)).toHaveLength(1);

    undoRedo.redo();
    expect(data.count).toBe(10);
    expect(undoRedo.canRedo()).toBe(false);
  });
});
