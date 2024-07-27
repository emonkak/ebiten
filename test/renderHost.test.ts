import { describe, expect, it, vi } from 'vitest';

import { RenderContext } from '../src/renderContext.js';
import { RenderHost } from '../src/renderHost.js';
import { EffectPhase, type Hook, HookType, PartType } from '../src/types.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockTemplate, MockUpdateBlock } from './mocks.js';

describe('RenderHost', () => {
  describe('.flushEffects()', () => {
    it('should perform given effects', () => {
      const host = new RenderHost();
      const effect1 = {
        commit: vi.fn(),
      };
      const effect2 = {
        commit: vi.fn(),
      };
      host.flushEffects([effect1, effect2], EffectPhase.Passive);

      expect(effect1.commit).toHaveBeenCalledOnce();
      expect(effect1.commit).toHaveBeenCalledWith(EffectPhase.Passive);
      expect(effect2.commit).toHaveBeenCalledOnce();
      expect(effect2.commit).toHaveBeenCalledWith(EffectPhase.Passive);
    });
  });

  describe('.getHTMLTemplate()', () => {
    it('should create a HTML template from tokens', () => {
      const host = new RenderHost();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getHTMLTemplate(tokens, data);

      expect(template.holes).toEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<div>Hello, !</div>');
    });

    it('should get a HTML template from cache if avaiable', () => {
      const host = new RenderHost();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getHTMLTemplate(tokens, data);

      expect(template).toBe(host.getHTMLTemplate(tokens, data));
    });
  });

  describe('.getSVGTemplate()', () => {
    it('should create a SVG template from tokens', () => {
      const host = new RenderHost();
      const [tokens, data] = tmpl`<text>Hello, ${'World'}!</text>`;
      const template = host.getSVGTemplate(tokens, data);

      expect(template.holes).toEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<text>Hello, !</text>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
    });

    it('should get a SVG template from cache if avaiable', () => {
      const host = new RenderHost();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getSVGTemplate(tokens, data);

      expect(template).toBe(host.getSVGTemplate(tokens, data));
    });
  });

  describe('.getScopedValue()', () => {
    it('should get a scoped value from global scope', () => {
      const host = new RenderHost(new Map([['foo', 123]]));
      const block = new MockUpdateBlock();

      expect(host.getScopedValue('foo')).toBe(123);
      expect(host.getScopedValue('foo', block)).toBe(123);
    });

    it('should get a scoped value from block scope', () => {
      const host = new RenderHost(new Map([['foo', 123]]));
      const block = new MockUpdateBlock();

      host.setScopedValue('foo', 456, block);
      expect(host.getScopedValue('foo', block)).toBe(456);

      host.setScopedValue('foo', 789, block);
      expect(host.getScopedValue('foo', block)).toBe(789);
    });

    it('should get a scoped value from the parent', () => {
      const host = new RenderHost(new Map([['foo', 123]]));
      const parent = new MockUpdateBlock();
      const block = new MockUpdateBlock(parent);

      host.setScopedValue('foo', 456, parent);

      expect(host.getScopedValue('foo', block)).toBe(456);
    });
  });

  describe('.renderComponent()', () => {
    it('should return the component', () => {
      const host = new RenderHost();
      const template = new MockTemplate();
      const props = {
        data: {},
      };
      const component = vi.fn().mockImplementation((props, context) => {
        context.useEffect(() => {});
        return { template, data: props.data };
      });
      const hooks: Hook[] = [];
      const block = new MockUpdateBlock();
      const updater = new SyncUpdater(host);
      const result = host.renderComponent(
        component,
        props,
        hooks,
        block,
        updater,
      );

      expect(result.template).toBe(template);
      expect(result.data).toEqual(props.data);
      expect(component).toHaveBeenCalledOnce();
      expect(component).toHaveBeenCalledWith(props, expect.any(RenderContext));
      expect(hooks).toEqual([
        expect.objectContaining({ type: HookType.Effect }),
        { type: HookType.Finalizer },
      ]);
    });
  });
});

function tmpl(
  tokens: TemplateStringsArray,
  ...data: unknown[]
): [TemplateStringsArray, unknown[]] {
  return [tokens, data];
}