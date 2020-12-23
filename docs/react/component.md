本篇介绍`React.Component`与`React.PureComponent`源码：




# Component&PureComponent

`Component`与`PureComponent`是我们工作中经常使用的两个API, 它们的源码`ReactBaseClasses.js`文件中, 根据文件最后一行可以知道, 这个文件只导出了`Component`和`PureComponent`.



## Component

首先, 我们来看`Component`:

```javascript
function Component(props, context, updater) {
  this.props = props;
  this.context = context;
  // If a component has string refs, we will assign a different object later.
  this.refs = emptyObject;
  // We initialize the default updater but the real one gets injected by the
  // renderer.
  this.updater = updater || ReactNoopUpdateQueue;
}

Component.prototype.isReactComponent = {};

Component.prototype.setState = function(partialState, callback) {
  this.updater.enqueueSetState(this, partialState, callback, 'setState');
}

Component.prototype.forceUpdate = function(callback) {
  this.updater.enqueueForceUpdate(this, callback, 'forceUpdate');
};
```

由此可以看出, `Component`其实就是定义的一个构造函数, 实例属性有`props`, `context`, `refs`和`updater`, 原型上挂载了`isReactComponent`对象, `setState()`方法和`forceUpdate()`方法.

## PureComponent

```javascript
function PureComponent(props, context, updater) {
  this.props = props;
  this.context = context;
  // If a component has string refs, we will assign a different object later.
  this.refs = emptyObject;
  this.updater = updater || ReactNoopUpdateQueue;
}
```

`PureComponent`的定义就更简单了, 只定义了实例属性, 它的原型属性是通过继承`Component`来实现.



## 继承

```javascript
function ComponentDummy() {}
ComponentDummy.prototype = Component.prototype;

const pureComponentPrototype = (PureComponent.prototype = new ComponentDummy());
pureComponentPrototype.constructor = PureComponent;
// Avoid an extra prototype jump for these methods.
Object.assign(pureComponentPrototype, Component.prototype);
pureComponentPrototype.isPureReactComponent = true;
```

那么这个继承是怎么实现的呢, 我们先来看js实现继承的几种方案:

### 1. 原型式继承

```javascript
function object(obj) {
  function F() {};
  F.prototype = obj;
  return new F();
}
```

通过一个函数的原型以另一个对象为基础来生成两个相似的对象, 从而继承传入的obj.

### 2. 寄生式继承

```javascript
function inheritPrototype(child, parent) {
  const childPrototype = object(parent.prototype);
  childPrototype.constructor = parent;
  child.prototype = childPrototype;
}
```

寄生式继承可以理解为原型式继承的加强版, 通过`object`生成新的原型之后, 再对这个原型进行加强.



到这里基本就理解`PureComponen`实现继承的原理了, 其实就是通过寄生式继承来实现, `ComponentDummy`就是扮演了原型式继承中函数`F`的作用. 最后`Object.assign(pureComponentPrototype, Component.prototype);`官方说法是为了避免原型跳跃, 我想这种做法的好处是把原型的属性尽可能提前, 暴露在最外层原型上, 节省原型查找的时间.



不得不说, `React`的工程师还是很牛逼的!



