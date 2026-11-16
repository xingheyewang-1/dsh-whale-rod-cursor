# v0.1.12 — 修 DSH 0.2.2 下「点会话菜单整页卡死」（不再搬 React 节点，改用 portal）

这一版**不新增玩法、不改视觉**，只修一个致命 bug：在 **DSH 0.2.2** 上，
**点会话旁的 `⋯` / 删除 / 新建会话 → 整页卡死**，连 F12 都点不开。

## 🐛 症状（实测于 DSH 0.2.2-rc.3）

- 点 `⋯` 的瞬间页面僵住，鼠标能动但界面完全不响应，标签页等于死了
- 控制台**一次点击刷出 76,809 条**同一个错误：

```
slot entry crashed in 'shell.overlay':
  Failed to execute 'removeChild' on 'Node':
  The node to be removed is not a child of this node.
```

- 停用本插件后立刻恢复正常 → 确认是本插件引起的

## 🔍 根因：把 **React 托管的节点** 搬出了槽位

v9 为了解决"弹窗一开，鱼竿就被盖住"，做了这件事：

```js
// 旧做法（危险）
const host = hostRef.current;        // ← 这是 React 渲染出来的节点
document.getElementById('dsh-rod-cursor-top').appendChild(host);   // 搬到 body 下
```

层级问题确实解决了（弹窗是 `z-index:1000` 的 body 子树，我们搬到同一层再压过去），
但**节点的所有权在 React 手里**：React 以为 `host` 还是 `shell.overlay` 容器的子节点，
等到下一次提交（点菜单就是一个提交）去插/删兄弟节点时就扑空了 —— 于是抛
`removeChild`。错误边界接住后重试，再抛，再重试……主线程被 7 万多次异常打满，
页面表现为"卡死"，而错误又被归到**插槽边界**，所以报的是
`slot entry crashed in 'shell.overlay'`，看不出是我们。

## ✅ 修法：改成 React 正规 portal

```js
// 新做法
const [portalEl] = react.useState(() => ensureLiftHost());   // 容器在**首次渲染前**就建好
...
return react.createElement(react.Fragment, null,
  react.createElement('span', { style: { display: 'none' } }),   // 槽位里只留不可见锚点
  reactDom.createPortal(visual, portalEl));                      // 视觉由 React 渲染进我们的容器
```

要点三条：

1. **容器在首次渲染前同步建好** —— 绝不能"先渲染进槽位、拿到容器后再迁移"，
   那会重演同一类 `removeChild`（开发过程中真的踩到了第二次）。
2. **节点所有权永远在 React 手里** —— 我们只提供容器，不搬它的节点。
3. `liftHost()` **退役为空操作**（返回 `false`，永不移动），调用点全部删除。

顺带的安全网：`RodBoundary` 错误围栏保留；`frame()` 加了 try/catch 且
**出错超过 5 帧即停算** —— 万一将来再出问题，最多几行日志，不会再把主线程打死。

## ✔️ 验证

| 项 | 结果 |
|---|---|
| 自检冒烟 | **204 项通过 / 0 失败**（其中 3 条旧断言按新设计重写） |
| 真机 DSH 0.2.2-rc.3 | `⋯` 菜单正常弹出；鱼竿、鲸鱼娘、气泡全部正常 |
| 诊断输出 | 控制台过滤 `rod-diag` **无任何输出**（无异常） |
| 版本戳 | `__WHALE_ROD_CURSOR_VER__ = '2026-11-16-v16-portal-0.1.12'` |

## 📦 兼容性

- peer 依赖未变（从 v0.1.11 起就是 `@deepseek-ai/dsh-client-*: ^0.2.0-rc.2`），
  所以 DSH 0.2.0 / 0.2.1 / 0.2.2 都能装。
- v0.1.11 的全部功能保留：拖拽惯性、断线/脱钩、破防四档、气泡与台词池、
  静息快车道（性能）、Alt+Esc 应急切真光标。

## ↩️ 回滚

- 构建回滚点：`.build-cache/client.js.prev`
- 源码可回退到 `lib/client.src.js` 的上一版（`git log`），或直接用构建缓存里的产物覆盖 `lib/client.js`。
