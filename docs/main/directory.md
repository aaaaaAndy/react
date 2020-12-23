本篇简单介绍`react`源码的目录结构



下面以列表形式模拟`react`源码目录结构，也是我们阅读`react`源码需要着重关注的几个包。

-   react
    -   fixtures
    -   packages
        -   react  ———————— react包源码
        -   react-dom  ————— react-dom包源码
        -   react-reconciler  —— 与fiber相关源码，包括react的render与commit阶段源码
        -   scheduler  ————— 与调度相关代码
    -   scripts
    -   package.json
