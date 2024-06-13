import {
  type Binding,
  type Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import type { Part, Updater } from '../types.js';

export class UnitDirective implements Directive {
  static instance: UnitDirective = new UnitDirective();

  private constructor() {
    if (UnitDirective.instance !== undefined) {
      throw new Error('UnitDirective constructor cannot be called directly.');
    }
  }

  [directiveTag](part: Part, _updater: Updater): UnitBinding {
    return new UnitBinding(part);
  }
}

export class UnitBinding implements Binding<UnitDirective> {
  private readonly _part: Part;

  constructor(part: Part) {
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
    return UnitDirective.instance;
  }

  bind(newValue: UnitDirective, _updater: Updater): void {
    DEBUG: {
      ensureDirective(UnitDirective, newValue);
    }
  }

  rebind(_updater: Updater): void {}

  unbind(_updater: Updater): void {}

  disconnect(): void {}
}

export const unit = UnitDirective.instance;
