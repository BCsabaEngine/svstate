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
});
