本篇介绍`useState`和`useReducer`：

### 1. 区分挂载

`useState`是使用最为广泛的`Hooks`，而`useReducer`与`useState`又极为相似，实际上`useState`是`useReducer`的阉割版。所以本篇将这两个`Hooks`放在一起讲解。



从`Hooks`基础章里了解到，`react`会根据是否是第一次渲染来挂载不同的对象：如果是第一次渲染，则挂载`HooksDispatcherOnMount`，如果不是第一次渲染则挂载`HooksDispatcherOnUpdate`：



```javascript
function renderWithHooks() {
  // code...
  ReactCurrentDispatcher.current =
      current === null || current.memoizedState === null
        ? HooksDispatcherOnMount
        : HooksDispatcherOnUpdate;
  // code...
}
```



<!-- panels:start -->

<!-- div:title-panel -->

`Mount`阶段与`Update`阶段`Hooks`的定义：

<!-- div:left-panel -->

```javascript
// Mount 阶段Hooks的定义
const HooksDispatcherOnMount: Dispatcher = {
  readContext,

  useCallback: mountCallback,
  useContext: readContext,
  useEffect: mountEffect,
  useImperativeHandle: mountImperativeHandle,
  useLayoutEffect: mountLayoutEffect,
  useMemo: mountMemo,
  useReducer: mountReducer,
  useRef: mountRef,
  useState: mountState,
  useDebugValue: mountDebugValue,
  useResponder: createDeprecatedResponderListener,
  useDeferredValue: mountDeferredValue,
  useTransition: mountTransition,
};
```

<!-- div:right-panel -->

```javascript
// Update阶段Hooks的定义
const HooksDispatcherOnUpdate: Dispatcher = {
  readContext,

  useCallback: updateCallback,
  useContext: readContext,
  useEffect: updateEffect,
  useImperativeHandle: updateImperativeHandle,
  useLayoutEffect: updateLayoutEffect,
  useMemo: updateMemo,
  useReducer: updateReducer,
  useRef: updateRef,
  useState: updateState,
  useDebugValue: updateDebugValue,
  useResponder: createDeprecatedResponderListener,
  useDeferredValue: updateDeferredValue,
  useTransition: updateTransition,
};
```

<!-- panels:end -->


### 2. Mount

从`HooksDispatcherOnMount`可以得到，`useState`对应方法`mountState`，`useReducer`对应方法`mountReducer`：


<!-- panels:start -->

<!-- div:left-panel -->

```javascript
function mountState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  // 获取当前的Hook节点，同时将当前Hook添加到Hook链表中
  // 挂载一个全局的workInProgressHook
  const hook = mountWorkInProgressHook();

  // Tips1：获取初始值
  if (typeof initialState === 'function') {
    // $FlowFixMe: Flow doesn't like mixed types
    initialState = initialState();
  }

  hook.memoizedState = hook.baseState = initialState;
  // 声明一个链表来存放更新
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    // Tips2：如果是state处理，使用默认的reducer
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: (initialState: any),
  });
  // 返回一个dispatch方法用来修改状态，并将此次更新添加update链表中
  const dispatch: Dispatch<
    BasicStateAction<S>,
  > = (queue.dispatch = (dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue,
  ): any));
  // 返回状态和修改状态的方法
  return [hook.memoizedState, dispatch];
}

```

<!-- div:right-panel -->

```javascript
function mountReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
): [S, Dispatch<A>] {
  // 获取当前的Hook节点，同时将当前Hook添加到Hook链表中
  // 挂载一个全局的workInProgressHook
  const hook = mountWorkInProgressHook();

  // Tips1：获取初始值
  let initialState;
  if (init !== undefined) {
    initialState = init(initialArg);
  } else {
    initialState = ((initialArg: any): S);
  }

  hook.memoizedState = hook.baseState = initialState;
	// 声明一个链表来存放更新
  const queue = (hook.queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: (initialState: any),
  });
  // 返回一个dispatch方法用来修改状态，并将此次更新添加update链表中
  const dispatch: Dispatch<A> = (queue.dispatch = (dispatchAction.bind(
    null,
    currentlyRenderingFiber,
    queue,
  ): any));
  // 返回状态和修改状态的方法
  return [hook.memoizedState, dispatch];
}
```

<!-- panels:end -->



在以上代码中，`mountWorkInProgressHook()`的作用是创建一个用于保存`Hooks`状态的对象，如下

```javascript
function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,

    baseState: null,
    baseQueue: null,
    queue: null,

    next: null,
  };

  if (workInProgressHook === null) {
    // This is the first hook in the list
    // 当前workInProgressHook链表为空的话，
    // 将当前Hook作为第一个Hook
    // currentlyRenderingFiber为当前正在执行的fiber
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    // Append to the end of the list
    // 否则将当前Hook添加到Hook链表的末尾
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}
```



从以上代码中可以知道，`mountState`与`mountReducer`只有获取初始值和使用的`reducer`不同，如果是针对`state`的处理，`react`为其准备了一个默认的`reducer`，那接下里看看这个默认的`reducer`。

```javascript
// 默认直接返回action的值，新的state会作为参数action传入，所以是直接返回
function basicStateReducer<S>(state: S, action: BasicStateAction<S>): S {
  return typeof action === 'function' ? action(state) : action;
}
```



### 3. dispatchAction

由`mountState`源码最后一行可以知道，`dispatchAction`为`Hooks`返回的用于更新状态的方法。代码如下：

 ```javascript
// fiber 就是当前 functionComponent 的 Fiber 对象
// queue 是首次渲染的时候 new 的一个对象，用于存放后续的 dispatchAction 的 action
// action 就是我们写的 setCount(count + 1)
function dispatchAction<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  action: A,
) {
  const currentTime = requestCurrentTimeForUpdate();
  const suspenseConfig = requestCurrentSuspenseConfig();
  const expirationTime = computeExpirationForFiber(
    currentTime,
    fiber,
    suspenseConfig,
  );

  // 创建一个 update
  const update: Update<S, A> = {
    expirationTime,
    suspenseConfig,
    action,
    eagerReducer: null,
    // 提前计算好的这个 update 产生的变化，用于优化性能
    eagerState: null,
    next: (null: any),
  };

  // Append the update to the end of the list.
  const pending = queue.pending;
  if (pending === null) {
    // This is the first update. Create a circular list.
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  
  // 将update挂载到queue.pending上，并计算当前update的eagerState
  // 等scheduleWork调度到当前函数组件进行更新时，计算update对象，获取eagerState，赋值给memoizedState
  queue.pending = update;

  const alternate = fiber.alternate;
  if (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  ) {
    // This is a render phase update. Stash it in a lazily-created map of
    // queue -> linked list of updates. After this render pass, we'll restart
    // and apply the stashed updates on top of the work-in-progress hook.
    // 处理在render时产生的更新，将其标记，待这次更新完成后，再重新开启这次更新
    didScheduleRenderPhaseUpdate = true;
    update.expirationTime = renderExpirationTime;
    currentlyRenderingFiber.expirationTime = renderExpirationTime;
  } else {
    if (
      fiber.expirationTime === NoWork &&
      (alternate === null || alternate.expirationTime === NoWork)
    ) {
    	// 当前fiber上无任务，我们可以直接计算state，如果新老state相同，则跳过这次更新
      // The queue is currently empty, which means we can eagerly compute the
      // next state before entering the render phase. If the new state is the
      // same as the current state, we may be able to bail out entirely.
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        let prevDispatcher;
   
        try {
          const currentState: S = (queue.lastRenderedState: any);
          const eagerState = lastRenderedReducer(currentState, action);
          // Stash the eagerly computed state, and the reducer used to compute
          // it, on the update object. If the reducer hasn't changed by the
          // time we enter the render phase, then the eager state can be used
          // without calling the reducer again.
          update.eagerReducer = lastRenderedReducer;
          update.eagerState = eagerState;
          if (is(eagerState, currentState)) {
            // Fast path. We can bail out without scheduling React to re-render.
            // It's still possible that we'll need to rebase this update later,
            // if the component re-renders for a different reason and by that
            // time the reducer has changed.
            return;
          }
        } catch (error) {
          // Suppress the error. It will throw again in the render phase.
        } finally {}
      }
    }
   
    // 进入render阶段
    scheduleWork(fiber, expirationTime);
  }
}
 ```

从代码中可以看出来，当我们调用`Hooks`返回的更新方法时，最终还是调用了`scheduleWork()`，进入了`fiber`的`render`阶段，这段代码与`updateContainer()`很像，之后就循环调用 `fiber`进行计算，进入`render`阶段。

### 4. Update

`HooksDispatcherOnUpdate`为更新阶段的`Hooks`合集，`useState`在此阶段调用`updateState`，`useReducer`在此阶段调用`updateReducer`。如果深入`updateState`的源码去看，会发现更大的惊喜：

```javascript
function updateState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  return updateReducer(basicStateReducer, (initialState: any));
}
```

从以上代码可以看出来，`updateState`最终还是调用了`updateReducer`，传入了一个默认的`basicStateReducer`，而`basicStateReducer`就是一个简单幂等操作，传入什么，返回什么。这也就是为什么说`useState`是`useReducer`阉割版的原因。

`updateReducer`源码如下：

```javascript
// 1. FunctionComponent 不是一个可以实例化的对象，也就没有 this，没有 state，但是 React 的 Fiber 对象为此提供了可能，
//    由于 Fiber 是一个对象，所以就将 FunctionComponent 中无法挂载的一些值和方法挂载到了 FunctionComponent 对应的 Fiber 对象上，
//    并且起了个名字叫做 Hook。具体就是挂载到 Fiber 对象的 memoizedState 上。
// 2. Fiber 中也使用了 Update 链表的形式存储更新，在本例中，每次点击都会产生一个 update，放入 Hook 对象的 queue 中，
//    然后触发一次任务调度，将这些更新执行。
// 3. Hooks 对外暴露的接口，其实就是用来操作 Hook 对象的，Hook 对象通过 Fiber 和 FunctionComponent 完成绑定，
//    间接控制了 FunctionComponent 的行为。
// 4. Hooks 的一个小优化：产生 update 的时候，如果当前 fiber 上无更新任务，会计算本次 update 的结果，与产生 update 之前的比较，
//    如果没有变化，不会进行任务调度，如果有变化的话，会将结果存储起来，下次调度的时候就不用再计算了。
function updateReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
): [S, Dispatch<A>] {
  // 复制一个当前的 hook 对象最为工作区
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  queue.lastRenderedReducer = reducer;

  const current: Hook = (currentHook: any);

  // The last rebase update that is NOT part of the base state.
  let baseQueue = current.baseQueue;

  // The last pending update that hasn't been processed yet.
  // pendingQueue为待执行的更新队列，需要把pendingQueue队列赋给baseQueue才能执行更新
  let pendingQueue = queue.pending;
  if (pendingQueue !== null) {
    // We have new updates that haven't been processed yet.
    // We'll add them to the base queue.
    // 如果baseQueue队列有内容，则合并baseQueue与pendingQueue
    if (baseQueue !== null) {
      // Merge the pending queue and the base queue.
      let baseFirst = baseQueue.next;
      let pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }

  // 如果baseQueue有内容，则执行更新
  if (baseQueue !== null) {
    // We have a queue to process.
    let first = baseQueue.next;
    let newState = current.baseState;

    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast = null;
    let update = first;
    // 循环完成 update
    do {
      const updateExpirationTime = update.expirationTime;
      if (updateExpirationTime < renderExpirationTime) {
        // Priority is insufficient. Skip this update. If this is the first
        // skipped update, the previous update/state is the new base
        // update/state.
        // 优先级不够，不进行更新
        const clone: Update<S, A> = {
          expirationTime: update.expirationTime,
          suspenseConfig: update.suspenseConfig,
          action: update.action,
          eagerReducer: update.eagerReducer,
          eagerState: update.eagerState,
          next: (null: any),
        };
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }
        // Update the remaining priority in the queue.
        if (updateExpirationTime > currentlyRenderingFiber.expirationTime) {
          currentlyRenderingFiber.expirationTime = updateExpirationTime;
          markUnprocessedUpdateTime(updateExpirationTime);
        }
      } else {
        // This update does have sufficient priority.

        if (newBaseQueueLast !== null) {
          const clone: Update<S, A> = {
            expirationTime: Sync, // This update is going to be committed so we never want uncommit it.
            suspenseConfig: update.suspenseConfig,
            action: update.action,
            eagerReducer: update.eagerReducer,
            eagerState: update.eagerState,
            next: (null: any),
          };
          newBaseQueueLast = newBaseQueueLast.next = clone;
        }

        // Mark the event time of this update as relevant to this render pass.
        // TODO: This should ideally use the true event time of this update rather than
        // its priority which is a derived and not reverseable value.
        // TODO: We should skip this update if it was already committed but currently
        // we have no way of detecting the difference between a committed and suspended
        // update here.
        markRenderEventTimeAndConfig(
          updateExpirationTime,
          update.suspenseConfig,
        );

        // Process this update.
        // 有 eagerReducer，说明这个 action 已经在空闲的时候完成了计算，直接用这个计算结果就行
        if (update.eagerReducer === reducer) {
          // If this update was processed eagerly, and its reducer matches the
          // current reducer, we can use the eagerly computed state.
          newState = ((update.eagerState: any): S);
        } else {
          const action = update.action;
          // 调用 action 计算 newState
          newState = reducer(newState, action);
        }
      }
      // 循环读取baseQueue内容进行计算
      update = update.next;
    } while (update !== null && update !== first);

    if (newBaseQueueLast === null) {
      newBaseState = newState;
    } else {
      newBaseQueueLast.next = (newBaseQueueFirst: any);
    }

    // Mark that the fiber performed work, but only if the new state is
    // different from the current state.
    if (!is(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdate();
    }

    // hook的值更新
    hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;

    queue.lastRenderedState = newState;
  }

  // 这里的dispatch在mount阶段挂载了dispatchAction
  const dispatch: Dispatch<A> = (queue.dispatch: any);
  return [hook.memoizedState, dispatch];
}

```



### 5. 示例

#### 5.1  数据结构

我们以下面代码为例：

```javascript
import React, { useState } from 'react';

function App(props, context) {
	const [name, setName] = useState('andy');
	const [age, setAge] = useState(12);
	const [job, setJob] = useState('student');

	return (
		<div>
			<div onClick={() => { setName('qiqi') }}>
				<span>name:{name}</span>
			</div>
			<div onClick={() => { setAge(11) }}>
				<span>age:{age}</span>
			</div>
			<div onClick={() => { setJob('worker') }}>
				<span>{job}</span>
			</div>
		</div>
	)
}

export default App;
```



对`mount`阶段`debug`，获悉`workInProgress`上的`memoizedState`属性如下：

![useState-memorized](../images/useState-memorized.jpg)

由上图可以知道，在`react`内部，不同的`state`是以链表形式存放在`memoizedState`上，每一个`state`对应一个对象，其实就是`mountState()`函数内部的`mountWorkInProgressHook()`返回的`hook`对象，并且对象内部的`memoizedState`和`baseState`记录对应`state`的当前值，`next`指针指向下一个`state`。

在`update`阶段，`updateReducer()`函数调用`updateWorkInProgressHook()`则是从第一个`state`对象开始返回，直到遍历到最后一个对象，这也就要求`mount`阶段的`state`和`update`阶段的`state`数量，顺序必须是一致的。否则`update`计算的`hook`对象就有可能错误的，这也是为什么不能把`useState`放在`if`条件语句中执行的原因。

#### 5.2 触发action

那么当我们点击了`name:andy`文字，触发了`setName()`事件，会发生什么呢？

1.  `setName`为`mount`阶段返回的`dispatchAction`函数，所以会触发这个函数；

2.  `dispatchAction`函数内部初始化一个`update`对象，并将`update`对象挂载到对应的`queue.pending`上，然后计算`setName`传入的值，更新`update`：

    ```javascript
    // fiber是当前更新的fiber
    // queue从数据结构的图片示例中可以看到，其实就是memoizedState下各个hook对象的queue
    // action是setName传入的参数，setName('qiqi')，即qiqi
    function dispatchAction(fiber, queue, action) {
       // 创建一个 update
      const update: Update<S, A> = {
        expirationTime,
        suspenseConfig,
        // 此action代表setName传入的参数，即:qiqi
        action,
        eagerReducer: null,
        // 提前计算好的这个 update 产生的变化，用于优化性能
        eagerState: null,
        next: (null: any),
      };
      
      // 将update挂载到queue.pending上，并计算当前update的eagerState
      // 等scheduleWork调度到当前函数组件进行更新时，计算update对象，获取eagerState，赋值给memoizedState
      queue.pending = update;
      
      // 在useState中，lastRenderedReducer还是那个默认的reducer
      const lastRenderedReducer = queue.lastRenderedReducer;
      // 此时currentState为上一个state，即andy
      const currentState: S = (queue.lastRenderedState: any);
      // 调用默认的reducer，其实就是传入action,返回action,得到eagerState为qiqi
      const eagerState = lastRenderedReducer(currentState, action);
      
      // 更新update上的两个变量,eagetState为qiqi
      update.eagerReducer = lastRenderedReducer;
      update.eagerState = eagerState;
      
      // 判断如果新老state没有变化的话就不进行更新，否则就进行调度
      if (is(eagerState, currentState)) {
        return;
      }
      
      // scheduleWork对当前fiber展开新一轮的调度
      scheduleWork(fiber, expirationTime);
    }
    ```

3.  `scheduleWork`最终通过调用`beginWork`，再调用`renderWithHooks`。此时在执行`let children = Component(props, secondArg);`时，相当于重新执行了当前的`function component`，也就是说这个`function component`实际上每次更新都会重新执行一遍，所以这就是为什么不同阶段，要给`ReactCurrentDispatcher.current`挂载不同处理方法合集的原因。

4.  `function component`只有第一次挂载时会执行`mount`上对应的方法，在更新阶段都是执行的`update`对象上的方法，例如，此时重新执行·`function component`，调用`const [name, setName] = useState('andy')`时，其实执行的`updateState`方法，而`updateState`方法又调用了`updateReducer`方法。

    ```javascript
    // useState此时调用updateState
    function updateState(initialState) {
      return updateReducer(basicStateReducer, initialState)
    }
    
    // 此时的updateReducer只有一个reducer参数有用，不用再理会传入的其他参数，因为参数，状态已经在第2步挂载到了queue.pending上
    function updateReducer(reducer, initialAra, init) {
      // 复制一个当前的 hook 对象最为工作区
      // 这里从function component执行开始，从第一个useState开始按顺序返回memoizedState上的hook对象，所以要求useState必须按顺序执行，不能有条件语句
      const hook = updateWorkInProgressHook();
      
      // currentHook为当前的hook对象
      const current: Hook = (currentHook: any);
      let baseQueue = current.baseQueue;
      
     	// 在第2步，react将计算结果'qiqi'挂载到了queue.pending上，也就是这里有update需要更新
      // 这里的逻辑是判断queue.pending是否有更新，如果有挂载到baseQueue上，如果baseQueue也有更新，则将queue.pending上的更新合并到baseQueue上
      let pendingQueue = queue.pending;
      if (pendingQueue !== null) {
        if (baseQueue !== null) {
          let baseFirst = baseQueue.next;
          let pendingFirst = pendingQueue.next;
          baseQueue.next = pendingFirst;
          pendingQueue.next = baseFirst;
        }
        current.baseQueue = baseQueue = pendingQueue;
        queue.pending = null;
      }
      
      // 如果经过计算合并，baseQueue上有东西需要更新时
      if (baseQueue !== null) {
        let first = baseQueue.next;
        let update = first;
        do {
          if (update.eagerReducer === reducer) {
            	// 如果新老reducer相同，则直接返回eagerState，即‘qiqi’
              newState = ((update.eagerState: any): S);
            } else {
              const action = update.action;
              // 调用 action 计算 newState
              newState = reducer(newState, action);
            }
        } while(update !== null && update !== first)
      }
      
      // hook的值更新
      hook.memoizedState = newState;
      hook.baseState = newBaseState;
      hook.baseQueue = newBaseQueueLast;
    
      queue.lastRenderedState = newState;
      
      // 返回经过计算的memoizedState
      // dispatch还是那个dispatchAction
      const dispatch: Dispatch<A> = (queue.dispatch: any);
      return [hook.memoizedState, dispatch];
    }
    ```

5.  最终计算出来新的`state`返回给`name`变量，从而在执行`return`时，能取到最新的值`qiqi`。
6.  点击其他的`age`或者`job`，更新流程与此相同。
