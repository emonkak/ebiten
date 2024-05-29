import { Binding, Directive, directiveTag } from '../binding.js';
import { AttributePart, Part, PartType } from '../part.js';
import type { Effect, Updater } from '../types.js';

export type ClassSpecifier = string | { [key: string]: boolean };

export function classNames(
  ...classSpecifiers: ClassSpecifier[]
): ClassNamesDirective {
  return new ClassNamesDirective(classSpecifiers);
}

export class ClassNamesDirective implements Directive {
  private readonly _classSpecifiers: ClassSpecifier[];

  constructor(classSpecifiers: ClassSpecifier[]) {
    this._classSpecifiers = classSpecifiers;
  }

  get classSpecifiers(): ClassSpecifier[] {
    return this._classSpecifiers;
  }

  [directiveTag](part: Part, updater: Updater): ClassNamesBinding {
    if (part.type !== PartType.Attribute || part.name !== 'class') {
      throw new Error(
        'ClassNamesDirective must be used in the "class" attribute.',
      );
    }

    const binding = new ClassNamesBinding(this, part);

    binding.bind(updater);

    return binding;
  }
}

export class ClassNamesBinding implements Effect, Binding<ClassNamesDirective> {
  private readonly _part: AttributePart;

  private _value: ClassNamesDirective;

  private _dirty = false;

  constructor(value: ClassNamesDirective, part: AttributePart) {
    this._value = value;
    this._part = part;
  }

  get part(): AttributePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get value(): ClassNamesDirective {
    return this._value;
  }

  set value(newValue: ClassNamesDirective) {
    this._value = newValue;
  }

  bind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    this._value = new ClassNamesDirective([]);

    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  disconnect(): void {}

  commit(): void {
    const { classList } = this._part.node;
    const { classSpecifiers } = this._value;
    const addedClasses: string[] = [];

    for (let i = 0, l = classSpecifiers.length; i < l; i++) {
      const classSpecifier = classSpecifiers[i]!;
      if (typeof classSpecifier === 'string') {
        classList.add(classSpecifier);
        addedClasses.push(classSpecifier);
      } else {
        for (const className in classSpecifier) {
          const enabled = classSpecifier[className];
          classList.toggle(className, enabled);
          if (enabled) {
            addedClasses.push(className);
          }
        }
      }
    }

    if (addedClasses.length === 0) {
      classList.value = '';
    } else if (addedClasses.length < classList.length) {
      for (let i = classList.length - 1; i >= 0; i--) {
        const className = classList[i]!;
        if (!addedClasses.includes(className)) {
          classList.remove(className);
        }
      }
    }

    this._dirty = false;
  }
}
