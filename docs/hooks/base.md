本篇介绍`react hooks`对外暴露的`API`：

## 1. 简单介绍

`React Hooks`是`React`在`v16.8.0`版本推出的一系列新`API`，目的是让`function component`也能拥有内部状态，而且`React Hooks`在一定程度上能缩短我们的代码行数，使我们的代码看起来更简洁。

其实我本人并不十分推崇完全拥抱`Hooks`，尤其当组件逻辑较复杂时，因为你会发现在一个长达几百行的`function`中梳理代码逻辑是很痛苦的一件事，正如[React官网](https://zh-hans.reactjs.org/docs/hooks-intro.html)所说：

>   **最重要的是，Hook 和现有代码可以同时工作，你可以渐进式地使用他们。** 不用急着迁移到 Hook。我们建议避免任何“大规模重写”，尤其是对于现有的、复杂的 class 组件。开始“用 Hook 的方式思考”前，需要做一些思维上的转变。按照我们的经验，最好先在新的不复杂的组件中尝试使用 Hook，并确保团队中的每一位成员都能适应。



## 2. 对外暴露的Hooks

在源码`/packages/react/src/React.js`文件中，有对`Hooks`源码的导出，如下：

```javascript
export {
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useDebugValue,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
  useDeferredValue,
  useResponder,
}
```



## 3. 追根溯源

在`React.js`文件顶部，我们能找到`import { xxx } from './ReactHooks'`，由此来看，这些`Hooks`方法来自同目录下的`ReactHooks.js`文件。

### 3.1 ReactCurrentDispatcher

在`ReactHooks.js`文件中，我们能找到所有`React Hooks`方法的定义，如下：

```javascript
import ReactCurrentDispatcher from './ReactCurrentDispatcher';

function resolveDispatcher() {
  const dispatcher = ReactCurrentDispatcher.current;
  return dispatcher;
}

// other hooks ...

export function useState<S>(
  initialState: (() => S) | S,
): [S, Dispatch<BasicStateAction<S>>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useReducer<S, I, A>(
  reducer: (S, A) => S,
  initialArg: I,
  init?: I => S,
): [S, Dispatch<A>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useReducer(reducer, initialArg, init);
}

// other hooks ...

```

由以上内容可见，所有的`Hooks`方法都从`resolveDispatcher()`方法中拿到了`dispatcher`对象，然后再根据情况调用`dispatcher`对象下的方法。而`resolveDispatch()`方法返回的是`ReactCurrentDispatcher.current`。



根据文件顶部的导入可以找到`ReactCurrentDispatcher`来自`./ReactCurrentDispatcher.js`文件，

```javascript
import type {Dispatcher} from 'react-reconciler/src/ReactFiberHooks';

const ReactCurrentDispatcher = {
  current: (null: null | Dispatcher),
};

export default ReactCurrentDispatcher;
```

需要注意的是在`ReactCurrentDispatcher.js`文件中，`ReactCurrentDispatcher.current`默认为`null`，也就是说默认不挂载`Hooks`方法，只有当调度执行到`function component`时才会挂载所有的`Hooks`方法。



### 3.2 renderWithHooks

接下来我们找一下什么时候挂载这些`Hooks`方法：



如果你已经阅读了之前的文档，你应该知道`React.js`在`render`阶段会调用`beginWork()`方法来对不同类型的`fiber`进行处理，在处理到`function component`时，会调用`updateFunctionComponent()`方法，在`updateFunctionComponent()`方法内部调用了`renderWithHooks()`方法，在`Hooks`出世之前，这里并不会调用`renderWithHooks()`方法，而是直接执行了`function component`方法。



以下是新老版本`updateFunctionComponent`的差异：

```javascript
// 老版本updateFunctionComponent
function updateFunctionComponent () {
  // type保存的就是function component对应的那个function
  const fn = workInProgress.type;
  // 直接调用function component执行获取children
  nextChildren = fn(nextProps, context);
}

// 新版本updateFunctionComponent
function updateFunctionComponent() {
  // 调用renderWithHooks处理Hooks
  nextChildren = renderWithHooks(params...);
}
```



`renderWithHooks()`方法在`packages/react-reconciler/src/ReactFiberHooks.js`中，大致看一下本文件，你会发现，这个文件就是`Hooks`的大本营，`Hooks`的所有处理逻辑都在这里。



在`renderWithHooks()`方法中，也会执行`workInProgress.type`上的方法，只是在执行前后会进行`Hooks`的处理：

```javascript
// Component是上一个函数传进来的workInProgress.type,代表function component的执行函数
function renderWithHooks(Component, ...otherParams) {
  // 判断是第一挂载时给current挂上HooksDispatcherOnMount
  // 如果已经更新过，挂上HooksDispatcherOnUpdate
  ReactCurrentDispatcher.current =
      current === null || current.memoizedState === null
        ? HooksDispatcherOnMount
        : HooksDispatcherOnUpdate;
  
  // 执行function(props, context){}
  let children = Component(props, secondArg);
  
  // 卸载current上挂载的方法
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;
}

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
}

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
}

// 这个时候除了调用readContext，其他都是报错
export const ContextOnlyDispatcher: Dispatcher = {
  readContext,

  useCallback: throwInvalidHookError,
  useContext: throwInvalidHookError,
  useEffect: throwInvalidHookError,
  useImperativeHandle: throwInvalidHookError,
  useLayoutEffect: throwInvalidHookError,
  useMemo: throwInvalidHookError,
  useReducer: throwInvalidHookError,
  useRef: throwInvalidHookError,
  useState: throwInvalidHookError,
  useDebugValue: throwInvalidHookError,
  useResponder: throwInvalidHookError,
  useDeferredValue: throwInvalidHookError,
  useTransition: throwInvalidHookError,
};

```

### 3.3 ReactCurrentDispatcher变量共享

到目前为止，还存在一个问题，那就是我们从`react`包中引入`useState,useEffect`这些`Hoos`，但是这些方法的挂载却是在`react-reconciler`包的`renderWithHooks()`方法中，那么怎么做到变量共享呢？其实很简单，***全局变量***。



1.  在`packages/react-reconciler/src/ReactFiberHooks.js`文件的顶部找到：

```javascript
// shared/ReactSharedInternals文件导出在2中
import ReactSharedInternals from 'shared/ReactSharedInternals';
// ReactSharedInternals从字面意思上看代表了react共享变量
const { ReactCurrentDispatcher, ReactCurrentBatchConfig } = ReactSharedInternals;
```

2.  在`packages/shared/ReactSharedInternals.js`文件中 ：

```javascript
// React.js文件导出部分在3中
import * as React from 'react';
const ReactSharedInternals = React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED; // 这个变量名很有意思
export default ReactSharedInternals;
```

3.  在`packages/react/src/React.js`文件中找到了当初`react`包导出时导出了那个另类的变量：

```javascript
// ReactSharedInternals文件导出部分在4中
import ReactSharedInternals from './ReactSharedInternals';
export {
	ReactSharedInternals as __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
}
```

4.  在`ReactSharedInternals.js`中找到

```javascript
import assign from 'object-assign';
import ReactCurrentDispatcher from './ReactCurrentDispatcher';
import ReactCurrentBatchConfig from './ReactCurrentBatchConfig';
import ReactCurrentOwner from './ReactCurrentOwner';
import ReactDebugCurrentFrame from './ReactDebugCurrentFrame';
import IsSomeRendererActing from './IsSomeRendererActing';

const ReactSharedInternals = {
  // 这就是我们需要的ReactCurrentDispatcher
  ReactCurrentDispatcher,
  ReactCurrentBatchConfig,
  ReactCurrentOwner,
  IsSomeRendererActing,
  // Used by renderers to avoid bundling object-assign twice in UMD bundles:
  assign,
};
```



可以看出来，`react`官方是把一系列需要共享的变量都放在了`__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`变量中，从而做到全局共享，随时修改，随时生效。