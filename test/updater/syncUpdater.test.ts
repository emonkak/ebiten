import { describe, expect, it, vi } from 'vitest';

import { SyncUpdater } from '../../src/updater/syncUpdater.js';
import { MockRenderHost, MockUpdateBlock } from '../mocks.js';

describe('SyncUpdater', () => {
  describe('.getCurrentPriority()', () => {
    it('should return "user-blocking"', () => {
      const updater = new SyncUpdater(new MockRenderHost());

      expect(updater.getCurrentPriority()).toBe('user-blocking');
    });
  });

  describe('.isPending()', () => {
    it('should return true if there is a pending block', () => {
      const updater = new SyncUpdater(new MockRenderHost());

      updater.enqueueBlock(new MockUpdateBlock());
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending mutation effect', () => {
      const updater = new SyncUpdater(new MockRenderHost());

      updater.enqueueMutationEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending layout effect', () => {
      const updater = new SyncUpdater(new MockRenderHost());

      updater.enqueueLayoutEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return true if there is a pending passive effect', () => {
      const updater = new SyncUpdater(new MockRenderHost());

      updater.enqueuePassiveEffect({ commit() {} });
      expect(updater.isPending()).toBe(true);
    });

    it('should return false if there are no pending tasks', () => {
      const updater = new SyncUpdater(new MockRenderHost());

      expect(updater.isPending()).toBe(false);
    });
  });

  describe('.isScheduled()', () => {
    it('should return whether an update is scheduled', async () => {
      const updater = new SyncUpdater(new MockRenderHost());

      expect(updater.isScheduled()).toBe(false);

      updater.scheduleUpdate();
      expect(updater.isScheduled()).toBe(true);

      await updater.waitForUpdate();
      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.scheduleUpdate()', () => {
    it('should do nothing if already scheduled', async () => {
      const updater = new SyncUpdater(new MockRenderHost());
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.scheduleUpdate();
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();
    });

    it('should update the block on a microtask', async () => {
      const updater = new SyncUpdater(new MockRenderHost());

      const block = new MockUpdateBlock();
      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };
      const performUpdateSpy = vi
        .spyOn(block, 'performUpdate')
        .mockImplementation((_context, updater) => {
          expect(updater.getCurrentBlock()).toBe(block);
          updater.enqueueMutationEffect(mutationEffect);
          updater.enqueueLayoutEffect(layoutEffect);
          updater.enqueuePassiveEffect(passiveEffect);
        });
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueBlock(block);
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
      expect(performUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should cancel the update of the block if shouldUpdate() returns false ', async () => {
      const updater = new SyncUpdater(new MockRenderHost());

      const block = new MockUpdateBlock();
      const performUpdateSpy = vi.spyOn(block, 'performUpdate');
      const shouldUpdateSpy = vi
        .spyOn(block, 'shouldUpdate')
        .mockReturnValue(false);
      const cancelUpdateSpy = vi.spyOn(block, 'cancelUpdate');
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueBlock(block);
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(performUpdateSpy).not.toHaveBeenCalled();
      expect(shouldUpdateSpy).toHaveBeenCalledOnce();
      expect(cancelUpdateSpy).toHaveBeenCalledOnce();
    });

    it('should commit effects on a microtask', async () => {
      const updater = new SyncUpdater(new MockRenderHost());

      const mutationEffect = { commit: vi.fn() };
      const layoutEffect = { commit: vi.fn() };
      const passiveEffect = { commit: vi.fn() };
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask');

      updater.enqueueMutationEffect(mutationEffect);
      updater.enqueueLayoutEffect(layoutEffect);
      updater.enqueuePassiveEffect(passiveEffect);
      updater.scheduleUpdate();

      expect(queueMicrotaskSpy).toHaveBeenCalledOnce();

      await updater.waitForUpdate();

      expect(mutationEffect.commit).toHaveBeenCalledOnce();
      expect(layoutEffect.commit).toHaveBeenCalledOnce();
      expect(passiveEffect.commit).toHaveBeenCalledOnce();
    });

    it('should cancel the update when flushed', () => {
      const updater = new SyncUpdater(new MockRenderHost());

      updater.scheduleUpdate();
      updater.flush();

      expect(updater.isScheduled()).toBe(false);
    });
  });

  describe('.waitForUpdate()', () => {
    it('should returns a resolved Promise if not scheduled', () => {
      const updater = new SyncUpdater(new MockRenderHost());

      expect(
        Promise.race([
          updater.waitForUpdate().then(
            () => true,
            () => false,
          ),
          Promise.resolve().then(
            () => false,
            () => false,
          ),
        ]),
      ).resolves.toBe(true);
    });
  });
});
