import {
  Binding,
  Directive,
  directiveTag,
  ensureDirective,
  resolveBinding,
} from './binding.js';
import { Context } from './context.js';
import { UsableObject, usableTag } from './hook.js';
import { LinkedList } from './linkedList.js';
import type { Part } from './part.js';
import type { Updater } from './types.js';

export type Subscriber = () => void;

export type Subscription = () => void;

type UnwrapSignals<TValue> = TValue extends any[]
  ? {
      [P in keyof TValue]: TValue[P] extends Signal<infer Value>
        ? Value
        : never;
    }
  : never;

export abstract class Signal<TValue>
  implements Directive, UsableObject<TValue, Context>
{
  abstract get value(): TValue;

  abstract get version(): number;

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(
    selector: (value: TValue) => TResult,
  ): ProjectedSignal<TValue, TResult> {
    return new ProjectedSignal(this, selector);
  }

  scan<TResult>(
    accumulator: (result: TResult, value: TValue) => TResult,
    seed: TResult,
  ): ScannedSignal<TValue, TResult> {
    return new ScannedSignal(this, accumulator, seed);
  }

  toJSON(): TValue {
    return this.value;
  }

  valueOf(): TValue {
    return this.value;
  }

  [directiveTag](part: Part, updater: Updater): SignalBinding<TValue> {
    return new SignalBinding(this, part, updater);
  }

  [usableTag](context: Context): TValue {
    context.useEffect(
      () =>
        this.subscribe(() => {
          context.requestUpdate();
        }),
      [this],
    );
    return this.value;
  }
}

export class SignalBinding<TValue> implements Binding<Signal<TValue>> {
  private _signal: Signal<TValue>;

  private readonly _binding: Binding<TValue>;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<TValue>, part: Part, updater: Updater) {
    this._signal = signal;
    this._binding = resolveBinding(signal.value, part, updater);
  }

  get part(): Part {
    return this._binding.part;
  }

  get startNode(): ChildNode {
    return this._binding.startNode;
  }

  get endNode(): ChildNode {
    return this._binding.endNode;
  }

  get value(): Signal<TValue> {
    return this._signal;
  }

  get binding(): Binding<TValue> {
    return this._binding;
  }

  bind(newValue: Signal<TValue>, updater: Updater) {
    DEBUG: {
      ensureDirective(Signal, newValue);
    }
    if (this._signal !== newValue) {
      this._signal = newValue;
      this._subscription?.();
      this._subscription = null;
    }
    this._binding.bind(newValue.value, updater);
    this._subscription ??= this._subscribeSignal(newValue, updater);
  }

  rebind(updater: Updater): void {
    this._binding.rebind(updater);
    this._subscription ??= this._subscribeSignal(this._signal, updater);
  }

  unbind(updater: Updater): void {
    this._binding.unbind(updater);
    this._subscription?.();
    this._subscription = null;
  }

  disconnect(): void {
    this._binding.disconnect();
    this._subscription?.();
    this._subscription = null;
  }

  private _subscribeSignal(
    signal: Signal<TValue>,
    updater: Updater,
  ): Subscription {
    return signal.subscribe(() => {
      this._binding.bind(signal.value, updater);
      updater.scheduleUpdate();
    });
  }
}

export class AtomSignal<TValue> extends Signal<TValue> {
  private _value: TValue;

  private _version = 0;

  private readonly _subscribers = new LinkedList<Subscriber>();

  constructor(initialValue: TValue) {
    super();
    this._value = initialValue;
  }

  get value(): TValue {
    return this._value;
  }

  set value(newValue: TValue) {
    this._value = newValue;
    this.forceUpdate();
  }

  get version(): number {
    return this._version;
  }

  forceUpdate() {
    this._version += 1;
    for (
      let node = this._subscribers.front();
      node !== null;
      node = node.next
    ) {
      const subscriber = node.value;
      subscriber();
    }
  }

  setUntrackedValue(newValue: TValue): void {
    this._value = newValue;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const node = this._subscribers.pushBack(subscriber);
    return () => {
      this._subscribers.remove(node);
    };
  }
}

export class ComputedSignal<
  TResult,
  const TDependencies extends Signal<any>[],
> extends Signal<TResult> {
  private readonly _factory: (...signals: TDependencies) => TResult;

  private readonly _dependencies: TDependencies;

  private _memoizedValue: TResult | null = null;

  private _memoizedVersion = -1; // -1 is indicated an uninitialized signal.

  static compose<TResult, const TDependencies extends Signal<any>[]>(
    factory: (...signals: UnwrapSignals<TDependencies>) => TResult,
    dependencies: TDependencies,
  ): ComputedSignal<TResult, TDependencies> {
    return new ComputedSignal((...dependencies) => {
      const values = dependencies.map(
        (dependency) => dependency.value,
      ) as UnwrapSignals<TDependencies>;
      return factory(...values);
    }, dependencies);
  }

  constructor(
    factory: (...signals: TDependencies) => TResult,
    dependencies: TDependencies,
  ) {
    super();
    this._factory = factory;
    this._dependencies = dependencies;
  }

  get value(): TResult {
    const { version } = this;
    if (this._memoizedVersion < version) {
      const factory = this._factory;
      this._memoizedVersion = version;
      this._memoizedValue = factory(...this._dependencies);
    }
    return this._memoizedValue!;
  }

  get version(): number {
    const dependencies = this._dependencies;
    let version = 0;
    for (let i = 0, l = dependencies.length; i < l; i++) {
      version += dependencies[i]!.version;
    }
    return version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    const subscriptions = this._dependencies.map((dependency) =>
      dependency.subscribe(subscriber),
    );
    return () => {
      for (let i = 0, l = subscriptions.length; i < l; i++) {
        subscriptions[i]!();
      }
    };
  }
}

export class ProjectedSignal<TValue, TResult> extends Signal<TResult> {
  private readonly _signal: Signal<TValue>;

  private readonly _selector: (value: TValue) => TResult;

  constructor(signal: Signal<TValue>, selector: (value: TValue) => TResult) {
    super();
    this._signal = signal;
    this._selector = selector;
  }

  get value(): TResult {
    const selector = this._selector;
    return selector(this._signal.value)!;
  }

  get version(): number {
    return this._signal.version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._signal.subscribe(subscriber);
  }
}

export class ScannedSignal<TValue, TResult> extends Signal<TResult> {
  private readonly _signal: Signal<TValue>;

  private readonly _accumulator: (result: TResult, value: TValue) => TResult;

  private _memoizedResult: TResult;

  private _memoizedVersion: number;

  constructor(
    signal: Signal<TValue>,
    accumulator: (result: TResult, value: TValue) => TResult,
    seed: TResult,
  ) {
    super();
    this._signal = signal;
    this._accumulator = accumulator;
    this._memoizedResult = accumulator(seed, signal.value);
    this._memoizedVersion = signal.version;
  }

  get value(): TResult {
    const { version } = this._signal;
    if (this._memoizedVersion < version) {
      const accumulator = this._accumulator;
      this._memoizedResult = accumulator(
        this._memoizedResult,
        this._signal.value,
      );
      this._memoizedVersion = version;
    }
    return this._memoizedResult;
  }

  get version(): number {
    return this._signal.version;
  }

  subscribe(subscriber: Subscriber): Subscription {
    return this._signal.subscribe(subscriber);
  }
}
