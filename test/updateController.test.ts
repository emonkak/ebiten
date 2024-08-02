import { describe, expect, it, vi } from 'vitest';

import {
  EffectPhase,
  type Hook,
  HookType,
  PartType,
  createUpdatePipeline,
  directiveTag,
} from '../src/baseTypes.js';
import { UpdateController } from '../src/updateController.js';
import { SyncUpdater } from '../src/updater/syncUpdater.js';
import { MockBlock, TextBinding, TextDirective } from './mocks.js';

const CONTINUOUS_EVENT_TYPES: (keyof DocumentEventMap)[] = [
  'drag',
  'dragenter',
  'dragleave',
  'dragover',
  'mouseenter',
  'mouseleave',
  'mousemove',
  'mouseout',
  'mouseover',
  'pointerenter',
  'pointerleave',
  'pointermove',
  'pointerout',
  'pointerover',
  'scroll',
  'touchmove',
  'wheel',
];

describe('UpdateController', () => {
  describe('.beginRender()', () => {
    it('should create a new MockRenderContext', () => {
      const host = new UpdateController();
      const updater = new SyncUpdater();
      const block = new MockBlock();
      const hooks: Hook[] = [];
      const pipeline = createUpdatePipeline();

      const context = host.beginRender(updater, block, hooks, pipeline);

      host.finishRender(context);

      expect(hooks).toStrictEqual([{ type: HookType.Finalizer }]);
    });
  });

  describe('.flushEffects()', () => {
    it('should perform given effects', () => {
      const host = new UpdateController();
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

  describe('.getCurrentPriority()', () => {
    it('should return "user-visible" if there is no current event', () => {
      const host = new UpdateController();

      vi.spyOn(globalThis, 'event', 'get').mockReturnValue(undefined);

      expect(host.getCurrentPriority()).toBe('user-visible');
    });

    it('should return "user-blocking" if the current event is not continuous', () => {
      const host = new UpdateController();

      const eventMock = vi
        .spyOn(globalThis, 'event', 'get')
        .mockReturnValue(new MouseEvent('click'));

      expect(host.getCurrentPriority()).toBe('user-blocking');
      expect(eventMock).toHaveBeenCalled();
    });

    it.each(CONTINUOUS_EVENT_TYPES)(
      'should return "user-visible" if the current event is continuous',
      (eventType) => {
        const host = new UpdateController();

        const eventMock = vi
          .spyOn(globalThis, 'event', 'get')
          .mockReturnValue(new CustomEvent(eventType));

        expect(host.getCurrentPriority()).toBe('user-visible');
        expect(eventMock).toHaveBeenCalled();
      },
    );
  });

  describe('.getHTMLTemplate()', () => {
    it('should create a HTML template from tokens', () => {
      const host = new UpdateController();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getHTMLTemplate(tokens, data);

      expect(template.holes).toStrictEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<div>Hello, !</div>');
    });

    it('should get a HTML template from cache if avaiable', () => {
      const host = new UpdateController();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getHTMLTemplate(tokens, data);

      expect(template).toBe(host.getHTMLTemplate(tokens, data));
    });
  });

  describe('.getSVGTemplate()', () => {
    it('should create a SVG template from tokens', () => {
      const host = new UpdateController();
      const [tokens, data] = tmpl`<text>Hello, ${'World'}!</text>`;
      const template = host.getSVGTemplate(tokens, data);

      expect(template.holes).toStrictEqual([{ type: PartType.Node, index: 2 }]);
      expect(template.element.innerHTML).toBe('<text>Hello, !</text>');
      expect(template.element.content.firstElementChild?.namespaceURI).toBe(
        'http://www.w3.org/2000/svg',
      );
    });

    it('should get a SVG template from cache if avaiable', () => {
      const host = new UpdateController();
      const [tokens, data] = tmpl`<div>Hello, ${'World'}!</div>`;
      const template = host.getSVGTemplate(tokens, data);

      expect(template).toBe(host.getSVGTemplate(tokens, data));
    });
  });

  describe('.getScopedValue()', () => {
    it('should get a scoped value from constants', () => {
      const host = new UpdateController({ constants: new Map([['foo', 123]]) });
      const block = new MockBlock();

      expect(host.getScopedValue('foo')).toBe(123);
      expect(host.getScopedValue('foo', block)).toBe(123);
    });

    it('should get a scoped value from the block scope', () => {
      const host = new UpdateController({ constants: new Map([['foo', 123]]) });
      const block = new MockBlock();

      host.setScopedValue('foo', 456, block);
      expect(host.getScopedValue('foo', block)).toBe(456);

      host.setScopedValue('foo', 789, block);
      expect(host.getScopedValue('foo', block)).toBe(789);
    });

    it('should get a scoped value from the parent block scope', () => {
      const host = new UpdateController({ constants: new Map([['foo', 123]]) });
      const parent = new MockBlock();
      const block = new MockBlock(parent);

      host.setScopedValue('foo', 456, parent);

      expect(host.getScopedValue('foo', block)).toBe(456);
    });
  });

  describe('.mount()', () => {
    it('should mount element inside the container', async () => {
      const value = new TextDirective();
      const container = document.createElement('div');
      const host = new UpdateController();
      const updater = new SyncUpdater();
      const directiveSpy = vi.spyOn(value, directiveTag);
      const scheduleUpdateSpy = vi.spyOn(updater, 'scheduleUpdate');

      expect(host.mount(value, container, updater)).toBeInstanceOf(TextBinding);
      expect(directiveSpy).toHaveBeenCalledOnce();
      expect(scheduleUpdateSpy).toHaveBeenCalled();

      await updater.waitForUpdate();

      expect(container.innerHTML).toBe('<!--TextDirective-->');
    });
  });
});

function tmpl(
  tokens: TemplateStringsArray,
  ...data: unknown[]
): [TemplateStringsArray, unknown[]] {
  return [tokens, data];
}
