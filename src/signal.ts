import {
  Binding,
  Directive,
  Part,
  createBinding,
  directiveTag,
} from './binding.js';
import { Context, UsableObject, usableTag } from './context.js';
import { LinkedList } from './linkedList.js';
import type { Updater } from './updater.js';

export type Subscriber = () => void;

export type Subscription = () => void;

type UnwrapSignals<T> = T extends any[]
  ? {
      [P in keyof T]: T[P] extends Signal<infer Value> ? Value : never;
    }
  : never;

export abstract class Signal<T> implements Directive, UsableObject<void> {
  abstract get value(): T;

  abstract get version(): number;

  abstract subscribe(subscriber: Subscriber): Subscription;

  map<TResult>(
    selector: (value: T) => TResult,
  ): ComputedSignal<TResult, [Signal<T>]> {
    return ComputedSignal.compose(selector, [this as Signal<T>]);
  }

  toJSON(): T {
    return this.value;
  }

  valueOf(): T {
    return this.value;
  }

  [usableTag](context: Context): void {
    context.useEffect(
      () =>
        this.subscribe(() => {
          context.requestUpdate();
        }),
      [this],
    );
  }

  [directiveTag](part: Part, updater: Updater): SignalBinding<T> {
    const valueBinding = createBinding(this.value, part, updater);
    const binding = new SignalBinding(this, valueBinding);

    binding.init(updater);

    return binding;
  }
}

export class SignalBinding<T> implements Binding<Signal<T>> {
  private readonly _valueBinding: Binding<T>;

  private _signal: Signal<T>;

  private _subscription: Subscription | null = null;

  constructor(signal: Signal<T>, binding: Binding<T>) {
    this._signal = signal;
    this._valueBinding = binding;
  }

  get part(): Part {
    return this._valueBinding.part;
  }

  get startNode(): ChildNode {
    return this._valueBinding.startNode;
  }

  get endNode(): ChildNode {
    return this._valueBinding.endNode;
  }

  get value(): Signal<T> {
    return this._signal;
  }

  set value(newSignal: Signal<T>) {
    this._signal = newSignal;
  }

  init(updater: Updater): void {
    this._subscription ??= this._trackSignal(updater);
  }

  bind(updater: Updater): void {
    this._valueBinding.value = this._signal.value;
    this._valueBinding.bind(updater);
    this._subscription ??= this._trackSignal(updater);
  }

  unbind(updater: Updater): void {
    this._valueBinding.unbind(updater);
    if (this._subscription !== null) {
      this._subscription();
      this._subscription = null;
    }
  }

  disconnect(): void {
    this._valueBinding.disconnect();
    if (this._subscription !== null) {
      this._subscription();
      this._subscription = null;
    }
  }

  private _trackSignal(updater: Updater): Subscription {
    return this._signal.subscribe(() => {
      this._valueBinding.value = this._signal.value;
      this._valueBinding.bind(updater);
      updater.scheduleUpdate();
    });
  }
}

export class AtomSignal<T> extends Signal<T> {
  private readonly _subscribers = new LinkedList<Subscriber>();

  private _value: T;

  private _version = 0;

  constructor(initialValue: T) {
    super();
    this._value = initialValue;
  }

  get value(): T {
    return this._value;
  }

  set value(newValue: T) {
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
      const args = dependencies.map(
        (dependency) => dependency.value,
      ) as UnwrapSignals<TDependencies>;
      return factory(...args);
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
    const newVersion = this.version;
    if (this._memoizedVersion < newVersion) {
      const factory = this._factory;
      this._memoizedVersion = newVersion;
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
