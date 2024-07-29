import { ensureDirective, reportPart } from '../error.js';
import {
  type Binding,
  type ChildNodePart,
  type Effect,
  type Part,
  PartType,
  type TaskPriority,
  type Template,
  type TemplateDirective,
  type TemplateFragment,
  type UpdateBlock,
  type UpdateContext,
  type Updater,
  comparePriorities,
  directiveTag,
  nameOf,
  nameTag,
} from '../types.js';

const FLAG_NONE = 0;
const FLAG_CONNECTED = 1 << 0;
const FLAG_UPDATING = 1 << 1;
const FLAG_MUTATING = 1 << 2;

export class TemplateResult<TData = unknown, TContext = unknown>
  implements TemplateDirective<TData, TContext>
{
  private readonly _template: Template<TData, TContext>;

  private readonly _data: TData;

  constructor(template: Template<TData, TContext>, data: TData) {
    this._template = template;
    this._data = data;
  }

  get template(): Template<TData, TContext> {
    return this._template;
  }

  get data(): TData {
    return this._data;
  }

  get [nameTag](): string {
    return 'TemplateResult(' + nameOf(this._template) + ')';
  }

  [directiveTag](
    part: Part,
    updater: Updater<TContext>,
  ): TemplateResultBinding<TData, TContext> {
    if (part.type !== PartType.ChildNode) {
      throw new Error(
        'TemplateResult directive must be used in a child node, but it is used here:\n' +
          reportPart(part),
      );
    }
    return new TemplateResultBinding(this, part, updater.getCurrentBlock());
  }
}

export class TemplateResultBinding<TData, TContext>
  implements
    Binding<TemplateResult<TData, TContext>, TContext>,
    Effect,
    UpdateBlock<TContext>
{
  private _directive: TemplateResult<TData, TContext>;

  private readonly _part: ChildNodePart;

  private readonly _parent: UpdateBlock<TContext> | null;

  private _pendingFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedFragment: TemplateFragment<TData, TContext> | null = null;

  private _memoizedTemplate: Template<TData, TContext> | null = null;

  private _flags = FLAG_NONE;

  private _priority: TaskPriority = 'user-blocking';

  constructor(
    directive: TemplateResult<TData, TContext>,
    part: ChildNodePart,
    parent: UpdateBlock<TContext> | null,
  ) {
    this._directive = directive;
    this._part = part;
    this._parent = parent;
  }

  get value(): TemplateResult<TData, TContext> {
    return this._directive;
  }

  get part(): ChildNodePart {
    return this._part;
  }

  get startNode(): ChildNode {
    return this._memoizedFragment?.startNode ?? this._part.node;
  }

  get endNode(): ChildNode {
    return this._part.node;
  }

  get parent(): UpdateBlock<TContext> | null {
    return this._parent;
  }

  get priority(): TaskPriority {
    return this._priority;
  }

  get isUpdating(): boolean {
    return !!(this._flags & FLAG_UPDATING);
  }

  shouldUpdate(): boolean {
    if (!(this._flags & FLAG_UPDATING)) {
      return false;
    }
    let current: UpdateBlock<TContext> | null = this;
    while ((current = current.parent) !== null) {
      if (current.isUpdating) {
        return false;
      }
    }
    return true;
  }

  cancelUpdate(): void {
    this._flags &= ~FLAG_UPDATING;
  }

  requestUpdate(priority: TaskPriority, updater: Updater<TContext>): void {
    if (!(this._flags & FLAG_CONNECTED)) {
      return;
    }

    if (
      !(this._flags & FLAG_UPDATING) ||
      comparePriorities(priority, this._priority) > 0
    ) {
      this._flags |= FLAG_UPDATING;
      this._priority = priority;
      updater.enqueueBlock(this);
      updater.scheduleUpdate();
    }
  }

  performUpdate(
    _context: UpdateContext<TContext>,
    updater: Updater<TContext>,
  ): void {
    const { template, data } = this._directive;

    if (this._pendingFragment !== null) {
      if (this._memoizedTemplate!.isSameTemplate(template)) {
        // If fragment is changed, we must remount it.
        if (this._memoizedFragment !== this._pendingFragment) {
          this._requestMutation(updater);
        }

        this._pendingFragment.bind(data, updater);
      } else {
        // The template has been changed, so first, we unbind data from the current
        // fragment.
        this._pendingFragment.unbind(updater);

        // Next, unmount the old fragment and mount the new fragment.
        this._requestMutation(updater);

        // Finally, render the new template.
        this._pendingFragment = template.render(data, updater);
      }
    } else {
      // Mount the new fragment before the template hydration.
      this._requestMutation(updater);
      this._pendingFragment = template.render(data, updater);
    }

    this._memoizedTemplate = template;
    this._flags &= ~FLAG_UPDATING;
  }

  connect(updater: Updater<TContext>): void {
    this._forceUpdate(updater);
  }

  bind(newValue: TemplateResult<TData, TContext>, updater: Updater): void {
    DEBUG: {
      ensureDirective(TemplateResult, newValue, this._part);
    }
    this._directive = newValue;
    this._forceUpdate(updater);
  }

  unbind(updater: Updater<TContext>): void {
    // Detach data from the current fragment before its unmount.
    this._pendingFragment?.unbind(updater);

    this._requestMutation(updater);

    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  disconnect(): void {
    this._pendingFragment?.disconnect();

    this._flags &= ~(FLAG_CONNECTED | FLAG_UPDATING);
  }

  commit(): void {
    if (this._flags & FLAG_CONNECTED) {
      if (this._memoizedFragment !== this._pendingFragment) {
        this._memoizedFragment?.unmount(this._part);
        this._pendingFragment?.mount(this._part);
        this._memoizedFragment = this._pendingFragment;
      }
    } else {
      this._memoizedFragment?.unmount(this._part);
      this._memoizedFragment = null;
    }

    this._flags &= ~FLAG_MUTATING;
  }

  private _forceUpdate(updater: Updater<TContext>): void {
    if (!(this._flags & FLAG_UPDATING)) {
      this._flags |= FLAG_UPDATING;
      if (this._parent !== null) {
        this._priority = this._parent.priority;
      }
      updater.enqueueBlock(this);
    }

    this._flags |= FLAG_CONNECTED;
  }

  private _requestMutation(updater: Updater<TContext>): void {
    if (!(this._flags & FLAG_MUTATING)) {
      this._flags |= FLAG_MUTATING;
      updater.enqueueMutationEffect(this);
    }
  }
}
