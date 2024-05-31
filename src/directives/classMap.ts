import {
  Binding,
  Directive,
  directiveTag,
  ensureDirective,
} from '../binding.js';
import { AttributePart, Part, PartType } from '../part.js';
import type { Effect, Updater } from '../types.js';
import { shallowEqual } from '../utils.js';

export type ClassMap = { [key: string]: boolean };

export function classMap(classMap: ClassMap): ClassMapDirective {
  return new ClassMapDirective(classMap);
}

export class ClassMapDirective implements Directive {
  private readonly _classMap: ClassMap;

  constructor(classMap: ClassMap) {
    this._classMap = classMap;
  }

  get classMap(): ClassMap {
    return this._classMap;
  }

  [directiveTag](part: Part, _updater: Updater): ClassMapBinding {
    if (part.type !== PartType.Attribute || part.name !== 'class') {
      throw new Error(
        'ClassMapDirective must be used in the "class" attribute.',
      );
    }
    return new ClassMapBinding(this, part);
  }
}

export class ClassMapBinding implements Effect, Binding<ClassMapDirective> {
  private _directive: ClassMapDirective;

  private readonly _part: AttributePart;

  private _dirty = false;

  constructor(directive: ClassMapDirective, part: AttributePart) {
    this._directive = directive;
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

  get value(): ClassMapDirective {
    return this._directive;
  }

  bind(newValue: ClassMapDirective, updater: Updater): void {
    DEBUG: {
      ensureDirective(ClassMapDirective, newValue);
    }
    const oldClassMap = this._directive.classMap;
    const newClassMap = newValue.classMap;
    if (!shallowEqual(oldClassMap, newClassMap)) {
      this._directive = newValue;
      this.rebind(updater);
    }
  }

  rebind(updater: Updater): void {
    if (!this._dirty) {
      updater.enqueueMutationEffect(this);
      this._dirty = true;
    }
  }

  unbind(updater: Updater): void {
    const { classMap } = this._directive;
    if (Object.keys(classMap).length > 0) {
      this._directive = new ClassMapDirective({});
      this.rebind(updater);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { classList } = this._part.node;
    const { classMap } = this._directive;
    const addedClasses: string[] = [];

    for (const className in classMap) {
      const enabled = classMap[className];
      classList.toggle(className, enabled);
      if (enabled) {
        addedClasses.push(className);
      }
    }

    if (addedClasses.length < classList.length) {
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
