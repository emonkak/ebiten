import { describe, expect, it, vi } from 'vitest';

import { NodeBinding } from '../../src/binding.js';
import { Atom, Computed, SignalBinding } from '../../src/directives/signal.js';
import { RenderContext } from '../../src/renderContext.js';
import {
  type Hook,
  HookType,
  PartType,
  createUpdateContext,
  directiveTag,
  nameTag,
} from '../../src/types.js';
import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockBlock, MockUpdateHost } from '.././mocks.js';

describe('Signal', () => {
  describe('.toJSON()', () => {
    it('should return the value', () => {
      const signal = new Atom('foo');

      expect('foo').toBe(signal.toJSON());
    });
  });

  describe('.value', () => {
    it('should increment the version on update', () => {
      const signal = new Atom('foo');

      signal.value = 'bar';
      expect(signal.value).toBe('bar');
      expect(signal.version).toBe(1);
    });
  });

  describe('.valueOf()', () => {
    it('should return the value of the signal', () => {
      const signal = new Atom('foo');

      expect('foo').toBe(signal.valueOf());
    });
  });

  describe('[nameTag]', () => {
    it('should return a string represented itself', () => {
      expect(new Atom('foo')[nameTag]).toBe('Signal(foo)');
    });
  });

  describe('[directiveTag]()', () => {
    it('should construct a new SignalBinding', () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = signal[directiveTag](part, context);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(signal);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(binding.binding.value).toBe('foo');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('[usableTag]()', () => {
    it('should subscribe the signal and return a signal value', () => {
      const signal = new Atom('foo');
      const hooks: Hook[] = [];
      const block = new MockBlock();
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = new RenderContext(hooks, block, host, updater);

      const requstUpdateSpy = vi.spyOn(block, 'requestUpdate');

      expect(context.use(signal)).toBe('foo');
      context.finalize();
      updater.flushUpdate(host);

      expect(requstUpdateSpy).not.toHaveBeenCalled();

      signal.value = 'bar';

      expect(requstUpdateSpy).toHaveBeenCalledOnce();

      cleanHooks(hooks);
      signal.value = 'baz';

      expect(requstUpdateSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('SignalBinding', () => {
  describe('.constructor', () => {
    it('should construct a new SignalBinding', () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new SignalBinding(signal, part, context);

      expect(binding.part).toBe(part);
      expect(binding.startNode).toBe(part.node);
      expect(binding.endNode).toBe(part.node);
      expect(binding.value).toBe(signal);
      expect(binding.binding).toBeInstanceOf(NodeBinding);
      expect(binding.binding.value).toBe('foo');
      expect(updater.isPending()).toBe(false);
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.connect()', () => {
    it('should subscribe the signal', () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new SignalBinding(signal, part, context);

      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(context);

      expect(binding.binding.value).toBe('foo');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).not.toHaveBeenCalled();

      signal.value = 'bar';

      expect(binding.binding.value).toBe('bar');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.bind()', () => {
    it('should update the the value binding with current signal value', () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new SignalBinding(signal, part, context);

      const unsubscribeSpy = vi.fn();
      const subscribe = vi
        .spyOn(signal, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(context);
      signal.setUntrackedValue('bar');
      binding.bind(signal, context);

      expect(binding.binding.value).toBe('bar');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribe).toHaveBeenCalledOnce();
    });

    it('should unsubscribe the previous subscription if signal changes', () => {
      const signal1 = new Atom('foo');
      const signal2 = new Atom('bar');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new SignalBinding(signal1, part, context);

      const unsubscribe1Spy = vi.fn();
      const unsubscribe2Spy = vi.fn();
      const subscribe1Spy = vi
        .spyOn(signal1, 'subscribe')
        .mockReturnValue(unsubscribe1Spy);
      const subscribe2Spy = vi
        .spyOn(signal2, 'subscribe')
        .mockReturnValue(unsubscribe1Spy);
      const connectSpy = vi.spyOn(binding.binding, 'connect');
      const bindSpy = vi.spyOn(binding.binding, 'bind');

      binding.connect(context);
      binding.bind(signal2, context);

      expect(binding.binding.value).toBe('bar');
      expect(connectSpy).toHaveBeenCalled();
      expect(bindSpy).toHaveBeenCalledOnce();
      expect(unsubscribe1Spy).toHaveBeenCalledOnce();
      expect(unsubscribe2Spy).not.toHaveBeenCalled();
      expect(subscribe1Spy).toHaveBeenCalledOnce();
      expect(subscribe2Spy).toHaveBeenCalledOnce();
    });

    it('should throw the error if the value is not a signal', () => {
      expect(() => {
        const host = new MockUpdateHost();
        const updater = new SyncUpdater();
        const context = createUpdateContext(host, updater);
        const binding = new SignalBinding(
          new Atom('foo'),
          {
            type: PartType.Attribute,
            node: document.createElement('div'),
            name: 'class',
          },
          context,
        );
        binding.bind(null as any, context);
      }).toThrow(
        'A value must be a instance of Signal directive, but got "null".',
      );
    });
  });

  describe('.unbind()', () => {
    it('should unbind the value binding and unsubscribe the signal', () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new SignalBinding(signal, part, context);

      const unsubscribeSpy = vi.fn();
      const subscribeSpy = vi
        .spyOn(signal, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const unbindSpy = vi.spyOn(binding.binding, 'unbind');

      binding.connect(context);

      expect(unbindSpy).not.toHaveBeenCalled();
      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledOnce();

      binding.unbind(context);

      expect(unbindSpy).toHaveBeenCalledOnce();
      expect(unsubscribeSpy).toHaveBeenCalledOnce();
      expect(subscribeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('.disconnect()', () => {
    it('should disconnect the value binding and unsubscribe the signal', () => {
      const signal = new Atom('foo');
      const part = {
        type: PartType.Node,
        node: document.createTextNode(''),
      } as const;
      const host = new MockUpdateHost();
      const updater = new SyncUpdater();
      const context = createUpdateContext(host, updater);
      const binding = new SignalBinding(signal, part, context);

      const unsubscribeSpy = vi.fn();
      const subscribeSpy = vi
        .spyOn(signal, 'subscribe')
        .mockReturnValue(unsubscribeSpy);
      const disconnectSpy = vi.spyOn(binding.binding, 'disconnect');

      binding.connect(context);

      expect(unsubscribeSpy).not.toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).not.toHaveBeenCalled();

      binding.disconnect();

      expect(unsubscribeSpy).toHaveBeenCalledOnce();
      expect(subscribeSpy).toHaveBeenCalledOnce();
      expect(disconnectSpy).toHaveBeenCalledOnce();
    });
  });
});

describe('Atom', () => {
  describe('.value', () => {
    it('should get 0 of the initial version on initalize', () => {
      const signal = new Atom('foo');

      expect(signal.value).toBe('foo');
      expect(signal.version).toBe(0);
    });

    it('should increment the version on update', () => {
      const signal = new Atom('foo');

      signal.value = 'bar';
      expect(signal.value).toBe('bar');
      expect(signal.version).toBe(1);
    });
  });

  describe('.notifyUpdate()', () => {
    it('should increment the version', () => {
      const signal = new Atom(1);

      signal.notifyUpdate();

      expect(1).toBe(signal.value);
      expect(1).toBe(signal.version);
    });
  });

  describe('.setUntrackedValue()', () => {
    it('should set the new value without invoking the callback', () => {
      const signal = new Atom('foo');
      const callback = vi.fn();

      signal.subscribe(callback);
      signal.setUntrackedValue('bar');

      expect(signal.value).toBe('bar');
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const signal = new Atom('foo');
      const callback = vi.fn();

      signal.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(0);

      signal.value = 'bar';
      expect(callback).toHaveBeenCalledTimes(1);

      signal.value = 'baz';
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should not invoke the unsubscribed callback', () => {
      const signal = new Atom('foo');
      const callback = vi.fn();

      signal.subscribe(callback)();
      expect(callback).not.toHaveBeenCalled();

      signal.value = 'bar';
      expect(callback).not.toHaveBeenCalled();

      signal.value = 'baz';
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('Computed', () => {
  describe('.value', () => {
    it('should produce a memoized value by dependent signals', () => {
      const foo = new Atom(1);
      const bar = new Atom(2);
      const baz = new Atom(3);

      const signal = new Computed(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      expect(signal.value).toEqual({ foo: 1, bar: 2, baz: 3 });
      expect(signal.value).toBe(signal.value);
      expect(signal.version).toBe(0);
    });

    it('should increment the version when any dependent signal has been updated', () => {
      const foo = new Atom(1);
      const bar = new Atom(2);
      const baz = new Atom(3);

      const signal = new Computed(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      foo.value = 10;
      expect(signal.value).toEqual({ foo: 10, bar: 2, baz: 3 });
      expect(signal.version).toBe(1);

      let oldValue = signal.value;

      bar.value = 20;
      expect(signal.value).toEqual({ foo: 10, bar: 20, baz: 3 });
      expect(signal.value).not.toBe(oldValue);
      expect(signal.version).toBe(2);

      oldValue = signal.value;

      baz.value = 30;
      expect(signal.value).toEqual({ foo: 10, bar: 20, baz: 30 });
      expect(signal.value).not.toBe(oldValue);
      expect(signal.version).toBe(3);
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const foo = new Atom(1);
      const bar = new Atom(2);
      const baz = new Atom(3);
      const callback = vi.fn();

      const signal = new Computed(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      signal.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(0);

      foo.value++;
      expect(callback).toHaveBeenCalledTimes(1);

      bar.value++;
      expect(callback).toHaveBeenCalledTimes(2);

      baz.value++;
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should not invoke the unsubscribed callback', () => {
      const foo = new Atom(1);
      const bar = new Atom(2);
      const baz = new Atom(3);
      const callback = vi.fn();

      const signal = new Computed(
        (foo, bar, baz) => ({ foo: foo.value, bar: bar.value, baz: baz.value }),
        [foo, bar, baz],
      );

      signal.subscribe(callback)();
      expect(callback).not.toHaveBeenCalled();

      foo.value++;
      expect(callback).not.toHaveBeenCalled();

      bar.value++;
      expect(callback).not.toHaveBeenCalled();

      baz.value++;
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe('Projected', () => {
  describe('.value', () => {
    it('should apply the function to each values', () => {
      const signal = new Atom(1);
      const projectedSignal = signal.map((n) => n * 2);

      expect(projectedSignal.value).toBe(2);
      expect(projectedSignal.version).toBe(0);

      signal.value++;

      expect(projectedSignal.value).toBe(4);
      expect(projectedSignal.version).toBe(1);

      signal.value++;

      expect(projectedSignal.value).toBe(6);
      expect(projectedSignal.version).toBe(2);
    });
  });

  describe('.subscribe()', () => {
    it('should invoke the callback on update', () => {
      const signal = new Atom(1);
      const projectedSignal = signal.map((n) => n * 2);
      const callback = vi.fn();

      projectedSignal.subscribe(callback);
      expect(callback).toHaveBeenCalledTimes(0);

      signal.value++;
      expect(callback).toHaveBeenCalledTimes(1);

      signal.value++;
      expect(callback).toHaveBeenCalledTimes(2);

      signal.value++;
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should not invoke the unsubscribed callback', () => {
      const signal = new Atom(1);
      const projectedSignal = signal.map((n) => n * 2);
      const callback = vi.fn();

      projectedSignal.subscribe(callback)();
      expect(callback).not.toHaveBeenCalled();

      signal.value++;
      expect(callback).not.toHaveBeenCalled();

      signal.value++;
      expect(callback).not.toHaveBeenCalled();

      signal.value++;
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

function cleanHooks(hooks: Hook[]): void {
  for (let i = 0, l = hooks.length; i < l; i++) {
    const hook = hooks[i]!;
    if (hook.type === HookType.Effect) {
      hook.cleanup?.();
    }
  }
}
