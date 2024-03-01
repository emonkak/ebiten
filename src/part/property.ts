import { disconnectDirective } from '../directive.js';
import type { Part } from '../part.js';
import type { Updater } from '../updater.js';

export class PropertyPart implements Part {
  private readonly _element: Element;

  private readonly _name: string;

  private _pendingValue: unknown | null = null;

  private _memoizedValue: unknown | null = null;

  private _dirty = false;

  constructor(element: Element, name: string) {
    this._element = element;
    this._name = name;
  }

  get node(): Element {
    return this._element;
  }

  get name(): string {
    return this._name;
  }

  get value(): unknown {
    return this._memoizedValue;
  }

  set value(newValue: unknown,) {
    this._pendingValue = newValue;
    this._dirty = true;
  }

  get dirty(): boolean {
    return this._dirty;
  }

  commit(_updater: Updater): void {
    const newValue = this._pendingValue;

    (this._element as any)[this._name] = newValue;

    this._memoizedValue = newValue;
    this._dirty = false;
  }

  disconnect(updater: Updater) {
    disconnectDirective(this, updater);
  }
}
