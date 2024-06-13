import { TemplateDirective } from './directives/template.js';
import {
  type ElementData,
  ElementTemplate,
} from './template/elementTemplate.js';
import { ChildNodeTemplate, TextTemplate } from './template/valueTemplate.js';
import {
  type Cleanup,
  type EffectCallback,
  type EffectHook,
  type FinilizerHook,
  type Hook,
  HookType,
  type MemoHook,
  type ReducerHook,
  type RefObject,
  type TaskPriority,
} from './types.js';
import type { Component, Effect, RenderingEngine, Updater } from './types.js';
import { dependenciesAreChanged } from './utils.js';

export type InitialState<TState> = TState extends Function
  ? () => TState
  : (() => TState) | TState;

export type NewState<TState> = TState extends Function
  ? (prevState: TState) => TState
  : ((prevState: TState) => TState) | TState;

export type Usable<TResult, TContext> =
  | UsableCallback<TResult, TContext>
  | UsableObject<TResult, TContext>;

export type UsableCallback<TResult, TContext> = (context: TContext) => TResult;

export interface UsableObject<TResult, TContext> {
  [usableTag](context: TContext): TResult;
}

export const usableTag = Symbol('Usable');

export class Context {
  private readonly _hooks: Hook[];

  private readonly _component: Component<Context>;

  private readonly _engine: RenderingEngine<Context>;

  private readonly _updater: Updater<Context>;

  private _hookIndex = 0;

  constructor(
    hooks: Hook[],
    component: Component<Context>,
    engine: RenderingEngine<Context>,
    updater: Updater<Context>,
  ) {
    this._hooks = hooks;
    this._component = component;
    this._engine = engine;
    this._updater = updater;
  }

  childNode<T>(value: T): TemplateDirective<T, Context> {
    const template = ChildNodeTemplate.instance;
    return new TemplateDirective(template, value);
  }

  element<TElementValue, TChildNodeValue>(
    type: string,
    elementValue: TElementValue,
    childNodeValue: TChildNodeValue,
  ): TemplateDirective<ElementData<TElementValue, TChildNodeValue>, Context> {
    const template = new ElementTemplate<TElementValue, TChildNodeValue>(type);
    return new TemplateDirective(template, { elementValue, childNodeValue });
  }

  finalize(): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<FinilizerHook>(HookType.Finalizer, currentHook);
    } else {
      this._hooks.push({ type: HookType.Finalizer });
    }
  }

  getContextValue<T>(key: PropertyKey): T | undefined {
    return this._engine.getVariable(this._component, key) as T | undefined;
  }

  html(
    tokens: ReadonlyArray<string>,
    ...data: unknown[]
  ): TemplateDirective<unknown[], Context> {
    const template = this._engine.getHTMLTemplate(tokens, data);
    return new TemplateDirective(template, data);
  }

  requestUpdate(): void {
    this._component.requestUpdate(
      this._updater.getCurrentPriority(),
      this._updater,
    );
  }

  setContextValue(key: PropertyKey, value: unknown): void {
    this._engine.setVariable(this._component, key, value);
  }

  svg(
    tokens: ReadonlyArray<string>,
    ...data: unknown[]
  ): TemplateDirective<unknown[], Context> {
    const template = this._engine.getSVGTemplate(tokens, data);
    return new TemplateDirective(template, data);
  }

  text<T>(value: T): TemplateDirective<T, Context> {
    const template = TextTemplate.instance;
    return new TemplateDirective(template, value);
  }

  use<TResult>(usable: Usable<TResult, Context>): TResult {
    return typeof usable === 'function'
      ? usable(this)
      : usable[usableTag](this);
  }

  useCallback<TCallback extends Function>(
    callback: TCallback,
    dependencies: unknown[],
  ): TCallback {
    return this.useMemo(() => callback, dependencies);
  }

  useDeferredValue<TValue>(value: TValue, initialValue?: TValue): TValue {
    const [deferredValue, setDeferredValue] = this.useState<TValue>(
      (() => initialValue ?? value) as InitialState<TValue>,
      'background',
    );

    this.useEffect(() => {
      setDeferredValue((() => value) as NewState<TValue>);
    }, [value]);

    return deferredValue;
  }

  useEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.Effect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updater.enqueuePassiveEffect(
          new InvokeEffectHook(currentHook, callback),
        );
      }

      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type: HookType.Effect,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updater.enqueuePassiveEffect(new InvokeEffectHook(hook, callback));
    }

    this._hookIndex++;
  }

  useEvent<THandler extends (...args: any[]) => any>(
    handler: THandler,
  ): (
    this: ThisType<THandler>,
    ...args: Parameters<THandler>
  ) => ReturnType<THandler> {
    const handlerRef = this.useRef<THandler | null>(null);

    this.useLayoutEffect(() => {
      handlerRef.current = handler;
    });

    return this.useCallback(function (
      this: ThisType<THandler>,
      ...args: Parameters<THandler>
    ) {
      const currentHandler = handlerRef.current!;
      return currentHandler.call(this, args);
    }, []);
  }

  useLayoutEffect(callback: EffectCallback, dependencies?: unknown[]): void {
    const currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<EffectHook>(HookType.Effect, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        this._updater.enqueueLayoutEffect(
          new InvokeEffectHook(currentHook, callback),
        );
      }

      currentHook.dependencies = dependencies;
    } else {
      const hook: EffectHook = {
        type: HookType.Effect,
        dependencies,
        cleanup: undefined,
      };
      this._hooks.push(hook);
      this._updater.enqueueLayoutEffect(new InvokeEffectHook(hook, callback));
    }

    this._hookIndex++;
  }

  useMemo<TResult>(factory: () => TResult, dependencies: unknown[]): TResult {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<MemoHook<TResult>>(HookType.Memo, currentHook);

      if (dependenciesAreChanged(currentHook.dependencies, dependencies)) {
        currentHook.value = factory();
        currentHook.dependencies = dependencies;
      }
    } else {
      currentHook = {
        type: HookType.Memo,
        value: factory(),
        dependencies,
      };
      this._hooks.push(currentHook);
    }

    this._hookIndex++;

    return currentHook.value;
  }

  useReducer<TState, TAction>(
    reducer: (state: TState, action: TAction) => TState,
    initialState: InitialState<TState>,
    priority?: TaskPriority,
  ): [TState, (action: TAction) => void] {
    let currentHook = this._hooks[this._hookIndex];

    if (currentHook !== undefined) {
      ensureHookType<ReducerHook<TState, TAction>>(
        HookType.Reducer,
        currentHook,
      );
    } else {
      const hook: ReducerHook<TState, TAction> = {
        type: HookType.Reducer,
        state:
          typeof initialState === 'function' ? initialState() : initialState,
        dispatch: (action: TAction) => {
          const nextState = reducer(hook.state, action);
          if (!Object.is(hook.state, nextState)) {
            hook.state = nextState;
            this._component.requestUpdate(
              priority ?? this._updater.getCurrentPriority(),
              this._updater,
            );
          }
        },
      };
      currentHook = hook;
      this._hooks.push(hook);
    }

    this._hookIndex++;

    return [currentHook.state, currentHook.dispatch];
  }

  useRef<T>(initialValue: T): RefObject<T> {
    return this.useMemo(() => ({ current: initialValue }), []);
  }

  useState<TState>(
    initialState: InitialState<TState>,
    priority?: TaskPriority,
  ): [TState, (newState: NewState<TState>) => void] {
    return this.useReducer(
      (state, action) =>
        typeof action === 'function' ? action(state) : action,
      initialState,
      priority,
    );
  }

  useSyncEnternalStore<T>(
    subscribe: (subscruber: () => void) => Cleanup | void,
    getSnapshot: () => T,
    priority?: TaskPriority,
  ): T {
    this.useEffect(
      () =>
        subscribe(() => {
          this._component.requestUpdate(
            priority ?? this._updater.getCurrentPriority(),
            this._updater,
          );
        }),
      [subscribe, priority],
    );
    return getSnapshot();
  }
}

class InvokeEffectHook implements Effect {
  private readonly _hook: EffectHook;

  private readonly _callback: () => void;

  constructor(hook: EffectHook, callback: () => void) {
    this._hook = hook;
    this._callback = callback;
  }

  commit(): void {
    if (this._hook.cleanup !== undefined) {
      this._hook.cleanup();
      this._hook.cleanup = undefined;
    }

    const callback = this._callback;

    this._hook.cleanup = callback();
  }
}

export function ensureHookType<TExpectedHook extends Hook>(
  expectedType: TExpectedHook['type'],
  hook: Hook,
): asserts hook is TExpectedHook {
  if (hook.type !== expectedType) {
    throw new Error(
      `Unexpected hook type. Expected "${expectedType}" but got "${hook.type}".`,
    );
  }
}
