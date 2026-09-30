# v0.1.11 — 适配 DSH 0.2.0 的兼容性预检（装不上变装得上）

这一版**不改任何玩法、不改一行渲染逻辑**，只修一件事：**DSH 升级到 0.2.0 之后，
本插件会被运行时的兼容性预检拒载** —— 表现是鱼竿整个从界面上消失。

## 🐛 修掉的真问题：DSH ≥0.2.0 拒载（`skipping profile bundle`）

**症状**：内核升到 `0.2.0-rc.2` 后启动 `dsh web`，日志出现

```
dsh: skipping profile bundle "dsh-whale-rod-cursor":
  Error: Plugin dsh-whale-rod-cursor@0.1.10 is incompatible with dsh 0.2.0-rc.2:
  peerDependencies {"@deepseek-ai/dsh-client-runtime":"^0.1.0-rc.6",
                    "@deepseek-ai/dsh-client-ui-slots":"^0.1.0-rc.6"}.
```

鱼竿、鲸鱼娘、气泡、小剧场**全部不出现**，控制台 `__WHALE_ROD_CURSOR_VER__` 也是 `undefined`。

**根因**（不是代码坏了，是 semver 版本闸门）：DSH ≥0.2.0 在启动前会跑
`evaluatePluginCompatibility()`，对每个 bundle 做
`semver.satisfies(runtimeVersion, peerRange, { includePrerelease: true })`。
`^0.1.0-rc.6` 的上界是 **`<0.2.0`**，所以：

```
semver.satisfies('0.2.0-rc.2', '^0.1.0-rc.6') = false    ← 被拒
semver.satisfies('0.2.0-rc.2', '>=0.1.0-rc.6') = true    ← 所以有的插件逃过了
```

（预检**只查** `@deepseek-ai/dsh` 与 `@deepseek-ai/dsh-*` 开头的 peer；
`@deepseek-ai/cordis`、`react` 不参与判定。）

**修法**：把两个 DSH peer 的范围对齐到当前运行时版本线：

```diff
- "@deepseek-ai/dsh-client-runtime": "^0.1.0-rc.6",
- "@deepseek-ai/dsh-client-ui-slots": "^0.1.0-rc.6",
+ "@deepseek-ai/dsh-client-runtime": "^0.2.0-rc.2",
+ "@deepseek-ai/dsh-client-ui-slots": "^0.2.0-rc.2",
```

> **为什么敢直接抬范围**：本插件的宿主半侧是**故意空的 `apply()`**（`lib/index.js`），
> 浏览器半侧的 bundle 全文**只 `require('react')` 一个模块**，一个
> `@deepseek-ai/dsh-client-*` 都没真正调用 —— 这两个 peer 纯属声明。
> 0.2.0 相对 0.1.2 也没有影响本插件的客户端契约变更，所以抬范围是**语义正确的**，
> 不是"骗过预检"。

## ⚠️ 升级注意

- **仍然需要重启 `dsh web` 再硬刷新**：客户端 bundle 是进程启动时载入内存的。
- 如果你的 profile 里手工写过 `- insert: id: rod-cursor`，**升级后要删掉自己那条** ——
  两条同 id 的 insert 会让 dsh 报 `duplicate loader entry id: rod-cursor`（v0.1.10 起的老规矩）。
- 仍在使用 **0.1.x 内核**的用户：本版 peer 范围对 0.1.x **不再满足**，
  会触发同一个预检（0.1.x 上只是警告）。要留在 0.1.x 就继续用 v0.1.10。
- 已经是 **0.2.0-rc.2** 且不想升级本版的用户，也可以只授权一次豁免：
  `dsh plugin --profile web allow-version dsh-whale-rod-cursor@0.1.10 --dsh-version 0.2.0-rc.2 --accept-risk`
  （写入 `~/.dsh/profiles/web/compatibility.json`，一次性、只对该精确版本对生效）。

## 自检

```
node --check lib/client.js
node smoke-test.cjs   →  203 项
```

## 安装 / 升级

```bash
dsh plugin --profile web add github:xingheyewang-1/dsh-whale-rod-cursor
dsh plugin --profile web update dsh-whale-rod-cursor
```

装完**重启 `dsh web`**，然后硬刷新页面。`lib/client.js` 已随仓库提供，不需要构建步骤。

## 声明

Q 版鲸鱼娘形象来自 [`yanzwzz/dsh-whale-girl-pet`](https://github.com/yanzwzz/dsh-whale-girl-pet)（MIT）；
力学常数取值基准参考 `9livewolf/dsh-think-bounce-pet`（声明 MIT）。完整声明见 [NOTICE.md](NOTICE.md)。
本插件不读写用户文件、不起进程、不联网、无遥测。
