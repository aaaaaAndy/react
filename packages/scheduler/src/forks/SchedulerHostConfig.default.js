/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {enableIsInputPending} from '../SchedulerFeatureFlags';

export let requestHostCallback;
export let cancelHostCallback;
export let requestHostTimeout;
export let cancelHostTimeout;
export let shouldYieldToHost;
export let requestPaint;
export let getCurrentTime;
export let forceFrameRate;

if (
  // If Scheduler runs in a non-DOM environment, it falls back to a naive
  // implementation using setTimeout.
  typeof window === 'undefined' ||
  // Check if MessageChannel is supported, too.
  typeof MessageChannel !== 'function'
) {
  // If this accidentally gets imported in a non-browser environment, e.g. JavaScriptCore,
  // fallback to a naive implementation.
  let _callback = null;
  let _timeoutID = null;
  const _flushCallback = function() {
    if (_callback !== null) {
      try {
        const currentTime = getCurrentTime();
        const hasRemainingTime = true;
        _callback(hasRemainingTime, currentTime);
        _callback = null;
      } catch (e) {
        setTimeout(_flushCallback, 0);
        throw e;
      }
    }
  };
  const initialTime = Date.now();
  getCurrentTime = function() {
    return Date.now() - initialTime;
  };
  requestHostCallback = function(cb) {
    if (_callback !== null) {
      // Protect against re-entrancy.
      setTimeout(requestHostCallback, 0, cb);
    } else {
      _callback = cb;
      setTimeout(_flushCallback, 0);
    }
  };
  cancelHostCallback = function() {
    _callback = null;
  };
  requestHostTimeout = function(cb, ms) {
    _timeoutID = setTimeout(cb, ms);
  };
  cancelHostTimeout = function() {
    clearTimeout(_timeoutID);
  };
  shouldYieldToHost = function() {
    return false;
  };
  requestPaint = forceFrameRate = function() {};
} else {
  // Capture local references to native APIs, in case a polyfill overrides them.
  const performance = window.performance;
  const Date = window.Date;
  const setTimeout = window.setTimeout;
  const clearTimeout = window.clearTimeout;

  if (typeof console !== 'undefined') {
    // TODO: Scheduler no longer requires these methods to be polyfilled. But
    // maybe we want to continue warning if they don't exist, to preserve the
    // option to rely on it in the future?
    const requestAnimationFrame = window.requestAnimationFrame;
    const cancelAnimationFrame = window.cancelAnimationFrame;
    // TODO: Remove fb.me link
    if (typeof requestAnimationFrame !== 'function') {
      // Using console['error'] to evade Babel and ESLint
      console['error'](
        "This browser doesn't support requestAnimationFrame. " +
          'Make sure that you load a ' +
          'polyfill in older browsers. https://fb.me/react-polyfills',
      );
    }
    if (typeof cancelAnimationFrame !== 'function') {
      // Using console['error'] to evade Babel and ESLint
      console['error'](
        "This browser doesn't support cancelAnimationFrame. " +
          'Make sure that you load a ' +
          'polyfill in older browsers. https://fb.me/react-polyfills',
      );
    }
  }

  if (
    typeof performance === 'object' &&
    typeof performance.now === 'function'
  ) {
    getCurrentTime = () => performance.now();
  } else {
    const initialTime = Date.now();
    getCurrentTime = () => Date.now() - initialTime;
  }

  let isMessageLoopRunning = false;
  let scheduledHostCallback = null;
  let taskTimeoutID = -1;

  // Scheduler periodically yields in case there is other work on the main
  // thread, like user events. By default, it yields multiple times per frame.
  // It does not attempt to align with frame boundaries, since most tasks don't
  // need to be frame aligned; for those that do, use requestAnimationFrame.
  let yieldInterval = 5;
  let deadline = 0;

  // TODO: Make this configurable
  // TODO: Adjust this based on priority?
  let maxYieldInterval = 300;
  let needsPaint = false;

  if (
    enableIsInputPending &&
    navigator !== undefined &&
    navigator.scheduling !== undefined &&
    navigator.scheduling.isInputPending !== undefined
  ) {
    const scheduling = navigator.scheduling;
    shouldYieldToHost = function() {
      const currentTime = getCurrentTime();
      if (currentTime >= deadline) {
        // There's no time left. We may want to yield control of the main
        // thread, so the browser can perform high priority tasks. The main ones
        // are painting and user input. If there's a pending paint or a pending
        // input, then we should yield. But if there's neither, then we can
        // yield less often while remaining responsive. We'll eventually yield
        // regardless, since there could be a pending paint that wasn't
        // accompanied by a call to `requestPaint`, or other main thread tasks
        // like network events.
        if (needsPaint || scheduling.isInputPending()) {
          // There is either a pending paint or a pending input.
          return true;
        }
        // There's no pending input. Only yield if we've reached the max
        // yield interval.
        return currentTime >= maxYieldInterval;
      } else {
        // There's still time left in the frame.
        return false;
      }
    };

    requestPaint = function() {
      needsPaint = true;
    };
  } else {
    // `isInputPending` is not available. Since we have no way of knowing if
    // there's pending input, always yield at the end of the frame.
    shouldYieldToHost = function() {
      return getCurrentTime() >= deadline;
    };

    // Since we yield every frame regardless, `requestPaint` has no effect.
    requestPaint = function() {};
  }

  // 这个方法其实是 Scheduler 包提供给开发者的公共 API，
  // 允许开发者根据不同的设备刷新率设置调度间隔
  // 其实就是因地制宜的考虑
  forceFrameRate = function(fps) {
    if (fps < 0 || fps > 125) {
      // Using console['error'] to evade Babel and ESLint
      console['error'](
        'forceFrameRate takes a positive int between 0 and 125, ' +
          'forcing framerates higher than 125 fps is not unsupported',
      );
      return;
    }
    if (fps > 0) {
      yieldInterval = Math.floor(1000 / fps);
    } else {
      // 显然，如果没传或者传了个负的，就重置为 5ms，提升了一些鲁棒性
      // reset the framerate
      yieldInterval = 5;
    }
  };

  const performWorkUntilDeadline = () => {
    // [A]：先检查当前的 scheduledHostCallback 是否存在
    // 换句话说就是当前有没有事需要做
    if (scheduledHostCallback !== null) {
      const currentTime = getCurrentTime();
      // Yield after `yieldInterval` ms, regardless of where we are in the vsync
      // cycle. This means there's always time remaining at the beginning of
      // the message event.
      // 啊，截止时间！
      // 看来就是截止到 yieldInterval 之后，是多少呢？
      // 按前文的内容，应该是 5ms 吧，我们之后再验证
      deadline = currentTime + yieldInterval;
      // 唔，新鲜的截止时间，换句话说就是还有多少时间呗
      // 有了显示的剩余时间定义，无论我们处于 vsync cycle 的什么节点，在收到消息（任务）的时候都有时间了
      const hasTimeRemaining = true;
      try {
        const hasMoreWork = scheduledHostCallback(
          hasTimeRemaining,
          currentTime,
        );
        if (!hasMoreWork) {
          // 如果完成了最后一个任务，就关闭消息循环，并清洗掉 scheduledHostCallback 的引用
          isMessageLoopRunning = false;
          scheduledHostCallback = null;
        } else {
          // If there's more work, schedule the next message event at the end
          // of the preceding one.
          // [C]：如果还有任务要做，就用 port 继续向 channel 的 port2 端口发消息
          // 显然，这是一个类似于递归的操作
          // 那么，如果没有任务了，显然不会走到这儿，为什么还要判断 scheduledHostCallback 呢？往后看
          port.postMessage(null);
        }
      } catch (error) {
        // If a scheduler task throws, exit the current browser task so the
        // error can be observed.
        // 如果当前的任务执行除了故障，则进入下一个任务，并抛出错误
        port.postMessage(null);
        throw error;
      }
    } else {
      // [B]：没事儿做了，那么就不用循环的检查消息了呗
      isMessageLoopRunning = false;
    }
    // Yielding to the browser will give it a chance to paint, so we can
    // reset this.
    needsPaint = false;
  };

  const channel = new MessageChannel();
  const port = channel.port2;
  channel.port1.onmessage = performWorkUntilDeadline;

  // 1.准备好当前要执行的任务（scheduledHostCallback）
  // 2.开启消息循环调度
  // 3.调用 performWorkUntilDeadline
  requestHostCallback = function(callback) {
    // 将传入的 callback 赋值给 scheduledHostCallback
    // 类比 `requestAnimationFrame(() => { /* doSomething */ })` 这样的使用方法，
    // 我们可以推断 scheduledHostCallback 就是当前要执行的任务（scheduled嘛）
    scheduledHostCallback = callback;
    // isMessageLoopRunning 标志当前消息循环是否开启
    // 消息循环干嘛用的呢？就是不断的检查有没有新的消息——即新的任务——嘛
    if (!isMessageLoopRunning) {
      // 如果当前消息循环是关闭的，则 rHC 有权力打开它
      isMessageLoopRunning = true;
      // 打开以后，channel 的 port2 端口将受到消息，也就是开始 performWorkUntilDeadline 了
      port.postMessage(null);
    }
  };

  cancelHostCallback = function() {
    scheduledHostCallback = null;
  };

  requestHostTimeout = function(callback, ms) {
    taskTimeoutID = setTimeout(() => {
      callback(getCurrentTime());
    }, ms);
  };

  cancelHostTimeout = function() {
    clearTimeout(taskTimeoutID);
    taskTimeoutID = -1;
  };
}
