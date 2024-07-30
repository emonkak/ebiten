import { describe, expect, it, vi } from 'vitest';

import { NodeBinding } from '../../src/binding.js';
import { DynamicBinding, dynamic } from '../../src/directives/dynamic.js';
import {
  PartType,
  createUpdateContext,
  directiveTag,
  nameTag,
} from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockUpdateHost, TextBinding, TextDirective } from '../mocks.js';

describe('dynamic()', () => {
  it('should construct a new Dynamic', () => {
    const directive = dynamic('foo');

    expect(directive.value).toBe('foo');
  });
});

describe('Dynamic', () => {
  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(dynamic('foo')[nameTag]).toBe('Dynamic(foo)');
      expect(dynamic(new TextDirective())[nameTag]).toBe(
        'Dynamic(TextDirective)',
      );
    });
  });

  describe('[directiveTag]()', () => {
    it('should return an instance of DynamicBinding from the non-directive value', () => {
      const directive = dynamic('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = directive[directiveTag](part, context);
      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });

    it('should return an instance of DynamicBinding from the directive', () => {
      const directive = dynamic(new TextDirective());
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = directive[directiveTag](part, context);
      const getPartSpy = vi.spyOn(binding.binding, 'part', 'get');
      const getStartNodeSpy = vi.spyOn(binding.binding, 'startNode', 'get');
      const getEndNodeSpy = vi.spyOn(binding.binding, 'endNode', 'get');

      expect(binding.value).toBe(directive);
      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(getPartSpy).toHaveBeenCalledOnce();
      expect(getStartNodeSpy).toHaveBeenCalledOnce();
      expect(getEndNodeSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('DynamicBinding', () => {
  describe('.connect()', () => {
    it('should delegate to the current binding', () => {
      const directive = dynamic('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new DynamicBinding(directive, part, context);
      const connectSpy = vi.spyOn(binding.binding, 'connect');

      binding.connect(context);

      expect(connectSpy).toHaveBeenCalledOnce();
      expect(connectSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.bind()', () => {
    it('should bind a new value to the current binding if old and new values are non-directive', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new DynamicBinding(dynamic('foo'), part, context);
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(dynamic('bar'), context);
      updater.flushUpdate(host);

      expect(part.node.nodeValue).toBe('bar');
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).not.toHaveBeenCalled();
    });

    it('should bind a new value to the current binding if old and new values are the same directive', () => {
      const directive = new TextDirective();
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new DynamicBinding(
        dynamic(new TextDirective()),
        part,
        context,
      );
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(dynamic(new TextDirective()), context);
      updater.flushUpdate(host);

      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(bindSpy).toHaveBeenCalledWith(directive, context);
      expect(unbindSpy).not.toHaveBeenCalled();
    });

    it('should unbind the old binding and connect a new binding if old and new values are directive and non-directive', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new DynamicBinding(
        dynamic(new TextDirective()),
        part,
        context,
      );
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      updater.flushUpdate(host);

      binding.bind(dynamic('foo'), context);
      updater.flushUpdate(host);

      expect(part.node.nodeValue).toBe('foo');
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalled();
    });

    it('should unbind the old binding and connect a new binding if old and new values are non-directive and directive', () => {
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new DynamicBinding(dynamic('foo'), part, context);
      const bindSpy = vi.spyOn(binding.binding, 'bind');
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);
      updater.flushUpdate(host);

      let isConnected = false;
      const directive = new TextDirective();

      vi.spyOn(directive, directiveTag).mockImplementation((part) => {
        const binding = new TextBinding(directive, part);
        vi.spyOn(binding, 'connect').mockImplementation(() => {
          isConnected = true;
        });
        return binding;
      });

      binding.bind(dynamic(directive), context);
      updater.flushUpdate(host);

      expect(isConnected).toBe(true);
      expect(binding.binding).toBeInstanceOf(TextBinding);
      expect(bindSpy).not.toHaveBeenCalled();
      expect(unbindSpy).toHaveBeenCalled();
    });
  });

  describe('.unbind()', () => {
    it('should delegate to the current binding', () => {
      const directive = dynamic('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new DynamicBinding(directive, part, context);
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unbindSpy).toHaveBeenCalledWith(context);
    });
  });

  describe('.disconnect()', () => {
    it('should delegate to the current binding', () => {
      const directive = dynamic('foo');
      const part = {
        type: PartType.ChildNode,
        node: document.createComment(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new DynamicBinding(directive, part, context);
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.disconnect();

      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});
