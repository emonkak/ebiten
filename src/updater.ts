import { type Scheduler, createDefaultScheduler } from './scheduler.js';
import { AtomSignal } from './signal.js';
import type {
  Component,
  Effect,
  TaskPriority,
  UpdateContext,
  Updater,
} from './types.js';

export interface ConcurrentUpdaterOptions {
  scheduler?: Scheduler;
  taskCount?: AtomSignal<number>;
}

export class ConcurrentUpdater<TContext> implements Updater<TContext> {
  private readonly _context: UpdateContext<TContext>;

  private readonly _scheduler: Scheduler;

  private readonly _taskCount = new AtomSignal(0);

  private _currentComponent: Component<TContext> | null = null;

  private _pendingComponents: Component<TContext>[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  constructor(
    context: UpdateContext<TContext>,
    {
      scheduler = createDefaultScheduler(),
      taskCount = new AtomSignal(0),
    }: ConcurrentUpdaterOptions = {},
  ) {
    this._context = context;
    this._scheduler = scheduler;
    this._taskCount = taskCount;
  }

  beginRenderingPipeline(): ConcurrentUpdater<TContext> {
    return new ConcurrentUpdater(this._context, {
      scheduler: this._scheduler,
      taskCount: this._taskCount,
    });
  }

  getCurrentComponent(): Component<TContext> | null {
    return this._currentComponent;
  }

  getCurrentPriority(): TaskPriority {
    const currentEvent = window.event;
    if (currentEvent !== undefined) {
      return isContinuousEvent(currentEvent) ? 'user-visible' : 'user-blocking';
    } else {
      return 'user-visible';
    }
  }

  enqueueComponent(component: Component<TContext>): void {
    this._pendingComponents.push(component);
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

  scheduleUpdate(): void {
    if (this._currentComponent !== null) {
      return;
    }
    this._scheduleRenderPipelines();
    this._scheduleBlockingEffects();
    this._schedulePassiveEffects();
  }

  isScheduled(): boolean {
    return (
      this._taskCount.value > 0 ||
      this._pendingComponents.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
  }

  isUpdating(): boolean {
    return this._taskCount.value > 0;
  }

  waitForUpdate(): Promise<void> {
    const taskCount = this._taskCount;
    if (taskCount.value > 0) {
      return new Promise((resolve) => {
        const subscription = taskCount.subscribe(() => {
          if (taskCount.value === 0) {
            subscription();
            resolve();
          }
        });
      });
    } else {
      return Promise.resolve();
    }
  }

  private async _updateComponent(
    rootComponent: Component<TContext>,
  ): Promise<void> {
    let pendingComponents = [rootComponent];
    let startTime = this._scheduler.getCurrentTime();

    do {
      for (let i = 0, l = pendingComponents.length; i < l; i++) {
        const component = pendingComponents[i]!;
        if (!component.shouldUpdate()) {
          continue;
        }

        if (
          this._scheduler.shouldYieldToMain(
            this._scheduler.getCurrentTime() - startTime,
          )
        ) {
          await this._scheduler.yieldToMain({
            priority: component.priority,
          });
          startTime = this._scheduler.getCurrentTime();
        }

        this._currentComponent = component;
        try {
          component.update(this._context, this);
        } finally {
          this._currentComponent = null;
        }
      }

      pendingComponents = this._pendingComponents;
      this._pendingComponents = [];
    } while (pendingComponents.length > 0);

    this._scheduleBlockingEffects();
    this._schedulePassiveEffects();
  }

  private _scheduleRenderPipelines(): void {
    const pendingComponents = this._pendingComponents;
    this._pendingComponents = [];

    for (let i = 0, l = pendingComponents.length; i < l; i++) {
      const component = pendingComponents[i]!;
      this._scheduler.requestCallback(
        async () => {
          try {
            await this.beginRenderingPipeline()._updateComponent(component);
          } finally {
            this._taskCount.value--;
          }
        },
        {
          priority: component.priority,
        },
      );
      this._taskCount.value++;
    }
  }

  private _scheduleBlockingEffects(): void {
    const pendingMutationEffects = this._pendingMutationEffects;
    const pendingLayoutEffects = this._pendingLayoutEffects;

    if (pendingMutationEffects.length > 0 || pendingLayoutEffects.length > 0) {
      this._pendingMutationEffects = [];
      this._pendingLayoutEffects = [];

      this._scheduler.requestCallback(
        () => {
          try {
            this._context.flushEffects(pendingMutationEffects, 'mutation');
            this._context.flushEffects(pendingLayoutEffects, 'layout');
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'user-blocking' },
      );
      this._taskCount.value++;
    }
  }

  private _schedulePassiveEffects(): void {
    const pendingPassiveEffects = this._pendingPassiveEffects;

    if (pendingPassiveEffects.length > 0) {
      this._pendingPassiveEffects = [];

      this._scheduler.requestCallback(
        () => {
          try {
            this._context.flushEffects(pendingPassiveEffects, 'passive');
          } finally {
            this._taskCount.value--;
          }
        },
        { priority: 'background' },
      );
      this._taskCount.value++;
    }
  }
}

export class SyncUpdater<TContext> implements Updater<TContext> {
  private readonly _context: UpdateContext<TContext>;

  private _currentComponent: Component<TContext> | null = null;

  private _pendingComponents: Component<TContext>[] = [];

  private _pendingMutationEffects: Effect[] = [];

  private _pendingLayoutEffects: Effect[] = [];

  private _pendingPassiveEffects: Effect[] = [];

  private _isUpdating = false;

  constructor(context: UpdateContext<TContext>) {
    this._context = context;
  }

  getCurrentComponent(): Component<TContext> | null {
    return this._currentComponent;
  }

  getCurrentPriority(): TaskPriority {
    return 'user-blocking';
  }

  enqueueComponent(component: Component<TContext>): void {
    this._pendingComponents.push(component);
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

  isScheduled(): boolean {
    return (
      this._pendingComponents.length > 0 &&
      this._pendingLayoutEffects.length > 0 &&
      this._pendingMutationEffects.length > 0 &&
      this._pendingPassiveEffects.length > 0
    );
  }

  isUpdating(): boolean {
    return this._isUpdating;
  }

  scheduleUpdate(): void {
    if (this._isUpdating) {
      return;
    }

    this._isUpdating = true;

    queueMicrotask(() => {
      try {
        this.flush();
      } finally {
        this._isUpdating = false;
      }
    });
  }

  waitForUpdate(): Promise<void> {
    return new Promise(queueMicrotask);
  }

  flush(): void {
    do {
      while (this._pendingComponents.length > 0) {
        const pendingComponents = this._pendingComponents;

        this._pendingComponents = [];

        for (let i = 0, l = pendingComponents.length; i < l; i++) {
          const component = pendingComponents[i]!;
          if (!component.shouldUpdate()) {
            continue;
          }
          this._currentComponent = component;
          try {
            component.update(this._context, this);
          } finally {
            this._currentComponent = null;
          }
        }
      }

      if (this._pendingMutationEffects.length > 0) {
        const pendingMutationEffects = this._pendingMutationEffects;
        this._pendingMutationEffects = [];
        this._context.flushEffects(pendingMutationEffects, 'mutation');
      }

      if (this._pendingLayoutEffects.length > 0) {
        const pendingLayoutEffects = this._pendingLayoutEffects;
        this._pendingLayoutEffects = [];
        this._context.flushEffects(pendingLayoutEffects, 'layout');
      }

      if (this._pendingPassiveEffects.length > 0) {
        const pendingPassiveEffects = this._pendingPassiveEffects;
        this._pendingPassiveEffects = [];
        this._context.flushEffects(pendingPassiveEffects, 'passive');
      }
    } while (
      this._pendingComponents.length > 0 ||
      this._pendingMutationEffects.length > 0 ||
      this._pendingLayoutEffects.length > 0 ||
      this._pendingPassiveEffects.length > 0
    );
  }
}

function isContinuousEvent(event: Event): boolean {
  switch (event.type as keyof DocumentEventMap) {
    case 'drag':
    case 'dragenter':
    case 'dragleave':
    case 'dragover':
    case 'mouseenter':
    case 'mouseleave':
    case 'mousemove':
    case 'mouseout':
    case 'mouseover':
    case 'pointerenter':
    case 'pointerleave':
    case 'pointermove':
    case 'pointerout':
    case 'pointerover':
    case 'scroll':
    case 'touchmove':
    case 'wheel':
      return true;
    default:
      return false;
  }
}
