import { Binding, Directive, directiveTag } from '../binding.js';
import type { Part } from '../part.js';
import type { Updater } from '../types.js';

export class UnitDirective implements Directive {
  static instance: UnitDirective = new UnitDirective();

  private constructor() {
    if (UnitDirective.instance !== undefined) {
      throw new Error('UnitDirective constructor cannot be called directly.');
    }
  }

  [directiveTag](part: Part, _updater: Updater): UnitBinding {
    return new UnitBinding(this, part);
  }
}

export class UnitBinding implements Binding<UnitDirective> {
  private readonly _part: Part;

  private _value: UnitDirective;

  constructor(value: UnitDirective, part: Part) {
    this._value = value;
    this._part = part;
  }

  get part(): Part {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): UnitDirective {
    return this._value;
  }

  set value(newValue: UnitDirective) {
    this._value = newValue;
  }

  bind(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}
