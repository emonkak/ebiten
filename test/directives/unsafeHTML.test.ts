import { describe, expect, it, vi } from 'vitest';

import {
  PartType,
  createUpdateContext,
  directiveTag,
} from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost } from '../mocks.js';

import {
  UnsafeHTMLBinding,
  unsafeHTML,
} from '../../src/directives/unsafeHTML.js';

describe('unsafeHTML()', () => {
  it('should construct a new UnsafeHTML', () => {
    const content = '<span>foo</span>bar';
    const directive = unsafeHTML(content);

    expect(directive.content).toBe(content);
  });
});

describe('UnsafeHTML', () => {
  describe('[directiveTag]()', () => {
    it('should return a new instance of ClassMapBinding', () => {
      const directive = unsafeHTML('<span>foo</span>bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = directive[directiveTag](part, context);

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
    });

    it('should throw an error if the part is not a ChildNodePart', () => {
      const directive = unsafeHTML('foo<span>bar</span>');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      expect(() => directive[directiveTag](part, context)).toThrow(
        'UnsafeHTML directive must be used in a child node,',
      );
    });
  });
});

describe('UnsafeHTMLBinding', () => {
  describe('.connect()', () => {
    it('should insert the single node parsed from an unsafe HTML content before the part', () => {
      const directive = unsafeHTML('<div><span>foo</span>bar</div>');
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeHTMLBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      container.appendChild(part.node);
      binding.connect(context);
      updater.flushUpdate(host);

      expect(binding.startNode).toBeInstanceOf(HTMLElement);
      expect((binding.startNode as HTMLElement).outerHTML).toBe(
        '<div><span>foo</span>bar</div>',
      );
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe('<div><span>foo</span>bar</div><!---->');
    });

    it('should insert the multiple nodes parsed from an unsafe HTML content before the part', () => {
      const directive = unsafeHTML('<span>foo</span>bar');
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeHTMLBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      container.appendChild(part.node);
      binding.connect(context);
      updater.flushUpdate(host);

      expect(binding.startNode).toBeInstanceOf(HTMLElement);
      expect((binding.startNode as HTMLElement).outerHTML).toBe(
        '<span>foo</span>',
      );
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe('<span>foo</span>bar<!---->');
    });

    it('should not insert any nodese if the unsafe HTML content is empty', () => {
      const directive = unsafeHTML('');
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeHTMLBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      container.appendChild(part.node);
      binding.connect(context);
      updater.flushUpdate(host);

      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe('<!---->');
    });

    it('should do nothing if the update is already scheduled', () => {
      const directive = unsafeHTML('Hello, <strong>World!</strong>');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeHTMLBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const enqueueMutationEffectSpy = vi.spyOn(
        updater,
        'enqueueMutationEffect',
      );

      binding.connect(context);
      binding.connect(context);

      expect(enqueueMutationEffectSpy).toHaveBeenCalledOnce();
      expect(enqueueMutationEffectSpy).toHaveBeenCalledWith(binding);
    });
  });

  describe('.bind()', () => {
    it('should replace the old nodes with the nodes parsed from a new unsafe HTML content', () => {
      const directive1 = unsafeHTML('<span>foo</span>bar');
      const directive2 = unsafeHTML('bar<span>baz</span>');
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeHTMLBinding(directive1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      container.appendChild(part.node);
      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(directive2, context);
      updater.flushUpdate(host);

      expect(binding.value).toBe(directive2);
      expect(binding.startNode).toBeInstanceOf(Text);
      expect(binding.startNode.nodeValue).toBe('bar');
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe('bar<span>baz</span><!---->');
    });

    it('should skip an update if the styles are the same as the previous one', () => {
      const directive1 = unsafeHTML('<span>foo</span>bar');
      const directive2 = unsafeHTML(directive1.content);
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeHTMLBinding(directive1, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(directive2, context);

      expect(binding.value).toBe(directive1);
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });

    it('should throw an error if the new value is not UnsafeHTML directive', () => {
      const directive = unsafeHTML('<span>foo</span>bar');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeHTMLBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      expect(() => binding.bind(null as any, context)).toThrow(
        'A value must be a instance of UnsafeHTML directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should remove all nodes parsed from the current unsafe HTML content', () => {
      const directive = unsafeHTML('foo<span>bar</span>');
      const container = document.createElement('div');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeHTMLBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      container.appendChild(part.node);
      binding.connect(context);
      updater.flushUpdate(host);

      binding.unbind(context);
      updater.flushUpdate(host);

      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(container.innerHTML).toBe('<!---->');
    });

    it('should skip an update if the current unsafe HTML content is empty', () => {
      const directive = unsafeHTML('');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeHTMLBinding(directive, part);
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);

      binding.connect(context);
      updater.flushUpdate(host);

      binding.unbind(context);

      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.disconnect()', () => {
    it('should do nothing', () => {
      const directive = unsafeHTML('Hello, <strong>World!</strong>');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const binding = new UnsafeHTMLBinding(directive, part);

      binding.disconnect();
    });
  });
});
