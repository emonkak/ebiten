import { ensureDirective, reportPart } from '../error.js';
import {
  type Binding,
  type ChildNodePart,
  type Directive,
  type Part,
  PartType,
  type UpdateContext,
  type Updater,
  directiveTag,
} from '../types.js';

export function unsafeHTML(content: string): UnsafeHTML {
  return new UnsafeHTML(content);
}

export class UnsafeHTML implements Directive {
  private readonly _content: string;

  constructor(content: string) {
    this._content = content;
  }

  get content(): string {
    return this._content;
  }

  [directiveTag](
    part: Part,
    _context: UpdateContext<unknown>,
  ): UnsafeHTMLBinding {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'UnsafeHTML directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new UnsafeHTMLBinding(this, part);
  }
}

export class UnsafeHTMLBinding implements Binding<UnsafeHTML> {
  private _value: UnsafeHTML;

  private readonly _part: ChildNodePart;

  private _childNodes: ChildNode[] = [];

  private _dirty = false;

  constructor(value: UnsafeHTML, part: ChildNodePart) {
    this._value = value;
    this._part = part;
  }

  get value(): UnsafeHTML {
    return this._value;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._childNodes[0] ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  connect(context: UpdateContext<unknown>): void {
    this._requestMutation(context.updater);
  }

  bind(newValue: UnsafeHTML, context: UpdateContext<unknown>): void {
    DEBUG: {
      ensureDirective(UnsafeHTML, newValue, this._part);
    }
    const oldValue = this._value;
    if (oldValue.content !== newValue.content) {
      this._value = newValue;
      this._requestMutation(context.updater);
    }
  }

  unbind(context: UpdateContext<unknown>): void {
    const { content } = this._value;
    if (content !== '') {
      this._value = new UnsafeHTML('');
      this.connect(context);
    }
  }

  disconnect(): void {}

  commit(): void {
    const { content } = this._value;

    for (let i = 0, l = this._childNodes.length; i < l; i++) {
      this._childNodes[i]!.remove();
    }

    if (content !== '') {
      const template = document.createElement('template');
      const reference = this._part.node;

      template.innerHTML = content;
      this._childNodes = [...template.content.childNodes];
      reference.before(template.content);
    } else {
      this._childNodes = [];
    }

    this._dirty = false;
  }

  private _requestMutation(updater: Updater<unknown>): void {
    if (!this._dirty) {
      this._dirty = true;
      updater.enqueueMutationEffect(this);
    }
  }
}
