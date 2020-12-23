本篇简单介绍`react`包暴露的一些`API`：



`React`的核心包括`react`库和`react-dom`库,`react`仅仅1000多行代码，而`react-dom`却将近2w行. 其实 `react`库中仅仅是定义了我们的一些基础, 导出一些我们常用的API, 而`react-dom`库则包含了大部分框架逻辑.



这一系列文章是在`React16+`的基础上写的, React16相较于之前的版本是核心上的一次重写，虽然主要的API都没有变化，但是增加了很多能力。并且首次引入了`Fiber`的概念，之后新的功能都是围绕`Fiber`进行实现，比如`AsyncMode`，`Profiler`等



下面是`React`暴露出来的一些API: 

```javascript
const Children = {
  map,
  forEach,
  count,
  toArray,
  only,
};

export {
  Children,
  createRef,
  Component,
  PureComponent,
  createContext,
  forwardRef,
  lazy,
  memo,
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
  REACT_FRAGMENT_TYPE as Fragment,
  REACT_PROFILER_TYPE as Profiler,
  REACT_STRICT_MODE_TYPE as StrictMode,
  REACT_SUSPENSE_TYPE as Suspense,
  createElement,
  cloneElement,
  isValidElement,
  ReactVersion as version,
  ReactSharedInternals as __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
  // Deprecated behind disableCreateFactory
  createFactory,
  // Concurrent Mode
  useTransition,
  useDeferredValue,
  REACT_SUSPENSE_LIST_TYPE as SuspenseList,
  withSuspenseConfig as unstable_withSuspenseConfig,
  // enableBlocksAPI
  block,
  // enableDeprecatedFlareAPI
  useResponder as DEPRECATED_useResponder,
  createResponder as DEPRECATED_createResponder,
  // enableFundamentalAPI
  createFundamental as unstable_createFundamental,
  // enableScopeAPI
  createScope as unstable_createScope,
  // enableJSXTransformAPI
  jsx,
  jsxs,
  // TODO: jsxDEV should not be exposed as a name. We might want to move it to a different entry point.
  jsxDEV,
};
```

## Children

这个对象提供了一堆帮你处理`props.children`的方法，因为`children`是一个类似数组但是不是数组的数据结构，如果你要对其进行处理可以用`React.Children`外挂的方法。当你真正了解`React.Children`中方法的基础原理后, 你会先这是一个很方便很强大的API.

## createRef

`React`即将抛弃`<div ref="this.ref" />`这种 `string ref`的写法, 将来只能用下面方式来使用`ref`:

```jsx
// 1. createRef
this.ref = React.createRef();

<div ref={this.ref} />

// 2. 箭头函数
<div ref={(ref) => this.ref = ref } />

// 3. useRef
const ref = React.useRef();

<div ref={ref} />
```

## Component & PureComponent

`Component`是我们使用`React`框架的基础, 我们的类都是继承自`Componet`,而真正看过源码之后才知道,`Component`其实一个自定义的构造函数, 而`PureComponent`也是继承自`Component`, 唯一的区别是`PureComponent`的原型上多了一个标识:

```javascript
// 对props和state的浅比较
if (ctor.prototype && ctor.prototype.isPureReactComponent) {
  return (
    !shallowEqual(oldProps, newProps) || !shallowEqual(oldState, newState)
  );
}
```

## createContext

`createContext`是官方定稿的`context`方案，在这之前我们一直在用的老的`context API`都是React不推荐的API，现在新的API释出，官方也已经确定在17大版本会把老`API`去除。

## forwardRef

`forwardRef`是用来解决HOC组件传递`ref`的问题的，所谓HOC就是`Higher Order Component`,`forwardRef`的使用方法如下：

```javascript
const newComponent = React.forwardRef((props, ref) => (
	<WrapperComponent {...props} ref={ref}>
))
```

## Hooks

几个`use`开头的API是`React`新提供的针对`function component`的Hook方法,

## 类型

下面四个是`React`提供的组件, 在`React`包中,他们只是一个占位符, 真正的处理逻辑在`React-dom`中,在React实际检测到他们的时候会做一些特殊的处理.

```javascript
REACT_FRAGMENT_TYPE as Fragment,
REACT_PROFILER_TYPE as Profiler,
REACT_STRICT_MODE_TYPE as StrictMode,
REACT_SUSPENSE_TYPE as Suspense,
```

## Element操作

- `createElement` : 创建一个`Element`对象
- `cloneElement` : 克隆一个`Element`对象
-  `createFactory` : 创建专门用来创建某一类`ReactElement`的工厂的
-  `isValidElement` : 验证是否是一个`ReactElement`

## jsx & jsxs & jsxDEV

与`React.createElement`类似, 用来创建一个`Element`对象.

