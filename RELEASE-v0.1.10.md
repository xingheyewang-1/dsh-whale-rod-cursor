# v0.1.10 — 回钩不再串台词 · ④冷却交给玩家自己调 · 发布流程加守卫

这一版没有新玩法，全是**修手感**和**修工程风险** —— 但其中一条是用户实测出来的真 bug，
另一条是"能把自己装崩"的发布事故隐患。

## 🐛 修掉的真问题

### ① 回钩路上吐的是甩动台词，不是回钩台词
**用户实测**：脱钩摆烂结束后，她飘回来重新挂上钩子那一段，本该说「我回来啦」这类
回钩台词，结果蹦的是甩动/尖叫台词 —— 串台。

**根因**：甩飞判定用的是「她与鼠标的**相对速度**」（`relSp`），这个量**分不清**
"被她甩离锚点"和"被绳子拉回来"。于是：

- 脱钩后往回飘的位移 → 判成"被甩飞" → 冒甩动台词
- 挂回钩子后的**绳子回弹**同样超阈值 → 继续顶掉回钩台词

**修法**：给 `popBubble()` 加**回钩静默期**，条件是**状态驱动**（不是固定时长）：

| 参数 | 默认 | 作用 |
| --- | --- | --- |
| `bkReturnQuietUntil` | 说话后 1.5s | 最短：保证那句回钩台词说完不被抢 |
| `bkReturnQuietMax` | 说话后 6s | 兜底：万一她一直没归位，最多静默这么久 |
| `RETURN_CALM_NEED_MS` | **1200ms** | 归位后还要"**持续安静**这么久"才真正放行 |

> 为什么不是"归位即放行"：挂回钩子上之后绳子**还会回弹荡几下**，那几下照样超过甩飞阈值，
> 台词又被顶掉。所以判据是「**归位 + 回弹衰减完（持续安静 1.2s）**」，回弹会反复重置计时器。

### ② ④脱钩要等 5 分钟才有第二次，体感像坏了
`break4CoolMs` 默认 **300000（5 分钟）** —— "珍贵感"是设计意图，但实际体验是"等不起"。

**修法**：默认改成 **2 分钟**，并在设置面板加**一键预设按钮**：
`30 秒 / 1 分钟 / 2 分钟 / 5 分钟（旧默认）/ 10 分钟` —— **交给玩的人自己挑**，滑条也照旧可用。

## 🛡️ 工程改动：发布流程加"守卫"

**起因**：修 bug 期间曾把 `cordis.patch.yml` 临时改成空数组 `[]`、并删掉 package.json 的
`dsh.bundle` 声明。这种改动**本地看不出问题**（本地靠 profile 的 patch 手工挂着），
但**用户装上会"插件没有挂载条目 → 鱼竿根本不出现"**。

**修法**：新增 `release-guard.mjs`，并接入同步流程（sync → 校验 → **守卫** → 才允许 push）。
守卫会拦下：

- `dsh.bundle.patch` 缺失 / 指向不存在的文件
- `cordis.patch.yml` 是空数组 `[]`、缺 `- insert:`、缺 `- id:`
- 缺 `dsh.client.platform`
- 发布清单里的文件缺失

并给出两类提醒：版本戳里不含版本号；**用户 profile 里若也有同 id 的手工 `insert` → 会 duplicate**。

## ⚠️ 升级注意（重要）

本插件的 patch **自带挂载声明**（`- insert: id: rod-cursor`），所以：

> **如果你的 profile（`~/.dsh/profiles/web/cordis.patch.yml`）里也手工写过
> `- insert: id: rod-cursor`，升级后必须把自己那条删掉** —— 两条同 id 的 insert
> 会让 dsh 启动时报 `duplicate loader entry id: rod-cursor`。

## 自检

```
node smoke-test.cjs   →  203 项全过（零失败）
```

## 安装 / 升级

```bash
dsh plugin --profile web add github:xingheyewang-1/dsh-whale-rod-cursor
dsh plugin --profile web update dsh-whale-rod-cursor
```

装完**重启 `dsh web`**（客户端 bundle 是启动时进内存缓存的，硬刷新不够），然后硬刷新页面。
`lib/client.js` 已随仓库提供，不需要构建步骤。

## 声明

Q 版鲸鱼娘形象来自 [`yanzwzz/dsh-whale-girl-pet`](https://github.com/yanzwzz/dsh-whale-girl-pet)（MIT）；
力学常数取值基准参考 `9livewolf/dsh-think-bounce-pet`（声明 MIT）。完整声明见 [NOTICE.md](NOTICE.md)。
本插件不读写用户文件、不起进程、不联网、无遥测。