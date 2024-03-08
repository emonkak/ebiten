import { Context } from './context.js';
import { TaggedTemplate } from './taggedTemplate.js';
import type { Hook, Renderable, Scope, Template, Updater } from './types.js';

type Varibales = { [key: PropertyKey]: unknown };

export class LocalScope implements Scope<Context> {
  private readonly _globalVariables: Varibales;

  private readonly _marker: string;

  private readonly _variableScope: WeakMap<Renderable<Context>, Varibales> =
    new WeakMap();

  private readonly _templateCaches: WeakMap<
    TemplateStringsArray,
    TaggedTemplate
  > = new WeakMap();

  constructor(globalVariables: Varibales = {}) {
    this._globalVariables = globalVariables;
    this._marker = `?${getUUID()}?`;
  }

  getVariable(key: PropertyKey, renderable: Renderable<Context>): unknown {
    return (
      this._variableScope.get(renderable)?.[key] ?? this._globalVariables[key]
    );
  }

  setVariable(
    key: PropertyKey,
    value: unknown,
    renderable: Renderable<Context>,
  ): void {
    const variables = this._variableScope.get(renderable);
    if (variables !== undefined) {
      variables[key] = value;
    } else {
      this._variableScope.set(renderable, { [key]: value });
    }
  }

  createContext(
    renderable: Renderable<Context>,
    hooks: Hook[],
    updater: Updater<Context>,
  ): Context {
    return new Context(renderable, hooks, updater, this);
  }

  createHTMLTemplate(
    tokens: TemplateStringsArray,
    _values: unknown[],
  ): Template {
    let template = this._templateCaches.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseHTML(tokens, this._marker);
      this._templateCaches.set(tokens, template);
    }

    return template;
  }

  createSVGTemplate(
    tokens: TemplateStringsArray,
    _values: unknown[],
  ): Template {
    let template = this._templateCaches.get(tokens);

    if (template === undefined) {
      template = TaggedTemplate.parseSVG(tokens, this._marker);
      this._templateCaches.set(tokens, template);
    }

    return template;
  }
}

function getUUID(): ReturnType<typeof crypto.randomUUID> {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const s = [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const p1 = s.slice(0, 8);
  const p2 = s.slice(8, 12);
  const p3 = s.slice(12, 16);
  const p4 = s.slice(16, 20);
  const p5 = s.slice(20, 32);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}