import {
  type Effect,
  EffectPhase,
  type TaskPriority,
  type UpdateBlock,
  type UpdateContext,
  type Updater,
} from '../types.js';

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _context: UpdateContext<TContext>;

  private _currentBlock: UpdateBlock<TContext> | null = null;

  private _pendingBlocks: UpdateBlock<TContext>[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _isScheduled = false;

  constructor(context: UpdateContext<TContext>) {
    this._context = context;
  }

  getCurrentBlock(): UpdateBlock<TContext> | null {
    return this._currentBlock;
  }

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  enqueueBlock(block: UpdateBlock<TContext>): void {
    this._pendingBlocks.push(block);
  }

  enqueueLayoutEffect(effect: Effect): void {
    this._pendingLayoutEffects.push(effect);
  }

  enqueueMutationEffect(effect: Effect): void {
    this._pendingMutationEffects.push(effect);
  }

  enqueuePassiveEffect(effect: Effect): void {
    this._pendingPassiveEffects.push(effect);
  }

  isPending(): boolean {
    return (
      this._pendingBlocks.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
  }

  isScheduled(): boolean {
    return this._isScheduled;
  }

  scheduleUpdate(): void {
    if (this._isScheduled) {
      return;
    }

    queueMicrotask(() => {
      if (this._isScheduled) {
        this.flush();
      }
    });

    this._isScheduled = true;
  }

  waitForUpdate(): Promise<void> {
    return this._isScheduled ? new Promise(queueMicrotask) : Promise.resolve();
  }

  flush(): void {
    try {
      do {
        while (this._pendingBlocks.length > 0) {
          const pendingBlocks = this._pendingBlocks;
          this._pendingBlocks = [];

          for (let i = 0, l = pendingBlocks.length; i < l; i++) {
            const block = pendingBlocks[i]!;
            if (!block.shouldUpdate()) {
              block.cancelUpdate();
              continue;
            }
            this._currentBlock = block;
            try {
              block.performUpdate(this._context, this);
            } finally {
              this._currentBlock = null;
            }
          }
        }

        if (this._pendingMutationEffects.length > 0) {
          const pendingMutationEffects = this._pendingMutationEffects;
          this._pendingMutationEffects = [];
          this._context.flushEffects(
            pendingMutationEffects,
            EffectPhase.Mutation,
          );
        }

        if (this._pendingLayoutEffects.length > 0) {
          const pendingLayoutEffects = this._pendingLayoutEffects;
          this._pendingLayoutEffects = [];
          this._context.flushEffects(pendingLayoutEffects, EffectPhase.Layout);
        }

        if (this._pendingPassiveEffects.length > 0) {
          const pendingPassiveEffects = this._pendingPassiveEffects;
          this._pendingPassiveEffects = [];
          this._context.flushEffects(
            pendingPassiveEffects,
            EffectPhase.Passive,
          );
        }
      } while (
        this._pendingBlocks.length > 0 ||
        this._pendingMutationEffects.length > 0 ||
        this._pendingLayoutEffects.length > 0 ||
        this._pendingPassiveEffects.length > 0
      );
    } finally {
      this._isScheduled = false;
    }
  }
}
