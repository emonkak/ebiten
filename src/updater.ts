import { initializeBinding } from './binding.js';
import { PartType, Renderable, Updater } from './types.js';

export function mount<TContext>(
  value: unknown,
  container: ChildNode,
  updater: Updater<TContext>,
): void {
  const part = {
    type: PartType.ChildNode,
    node: document.createComment(''),
  } as const;

  updater.enqueueMutationEffect({
    commit() {
      container.appendChild(part.node);
    },
  });

  initializeBinding(value, part, updater);

  updater.scheduleUpdate();
}

export function shouldSkipRender(renderable: Renderable<unknown>): boolean {
  if (!renderable.dirty) {
    return true;
  }
  let current: Renderable<unknown> | null = renderable;
  while ((current = current.parent) !== null) {
    if (current.dirty) {
      return true;
    }
  }
  return false;
}
