# NOTICE —— 素材出处、授权与致谢

`dsh-whale-rod-cursor`（鱼竿鲸鱼娘光标）本身由 **星河野望** 编写，以 MIT 许可发布。
但它**不是凭空长出来的**：鲸鱼娘的形象来自上游开源项目，弹簧的调参基准来自社区插件。
按规矩，下面把"拿了什么、从哪拿的、拿了多少"逐条写清楚。

> **范围说明**：同目录的 `LICENSE` 是 **MIT 原文，只覆盖本插件自己的代码**（这样做是为了让
> GitHub / npm 能自动识别出 MIT 许可证）。**内嵌的第三方素材与参考不在那条许可的覆盖范围内**，
> 它们各自的出处、许可与上游许可全文都在本文件里，请一并阅读并随分发保留。
> 第三方素材的著作权属于上游作者：内嵌的鲸鱼娘形象 **不得**被说成是本插件作者画的。

---

## 一、Q 版鲸鱼娘形象（内嵌 PNG · 三张姿态）

| 项 | 内容 |
| --- | --- |
| 上游项目 | [`yanzwzz/dsh-whale-girl-pet`](https://github.com/yanzwzz/dsh-whale-girl-pet) |
| 上游许可 | **MIT License** |
| 取用文件 | 包内 `assets/preview/preview-{idle,work,done}.gif`（三张仓库预览动图） |
| 取了什么 | **每个 GIF 的第 1 帧**里的角色本体 |
| 加工方式 | ① 抽出首帧 → ② 从四边做洪水填充（阈值 26）抠掉背景得到透明通道 → ③ 等比缩放（高统一 180）→ ④ base64 内嵌进 `lib/client.js` |
| 加工者 | 星河野望 |
| 成品文件 | `H:\DSH_Workspace\ref\cursor-candidates\keyed-idle.png`（144×180，65.0 KB）<br>`keyed-work.png`（159×180，68.9 KB）<br>`keyed-done.png`（160×180，69.6 KB） |
| 在插件里的用途 | v6 起作为**姿态包**：idle＝平时 / work＝DSH 在跑 / done＝跑完了（切换只改 `display`，三张都在 DOM 里） |

**上游的 MIT 版权声明与许可条款完整保留**，未做任何删除或修改。
换句话说：这三张画的著作权仍是上游作者的，MIT 允许我们这样用（含再分发），
但**不能说成"我自己画的"**，也不能去掉这份声明。

> v1 只用了 idle 一张；v6 起三张全用上（work / done 的声明在此补齐）。
> 上游同项目还有更多动作素材（`assets/thumb/*.webm`，上百个），
> 若要继续取用，需按「扒素材前置流程」逐项补声明。

## 二、弹簧力学公式的取值基准

| 项 | 内容 |
| --- | --- |
| 参考项目 | `dsh-think-bounce-pet`（作者 **9livewolf**，其 `package.json` 声明 MIT） |
| 参考方式 | 阅读其 `lib/client.js`，**只借用物理量的取值与公式形式** |
| 具体借用的量 | `DEFORM_OMEGA = 2π×7`、`DEFORM_TAU = 170ms`、`DEFORM_SQUASH = 0.55`、`GRAVITY_BASE = 1500`、`FRICTION_SCALE = 0.04`、`MAX_DT = 0.034` |
| 具体借用的公式 | ① 阻尼余弦振荡：`amp = A·e^(-t/τ)`，形变 ∝ `amp·cos(ωt)`；② 指数阻尼：`v *= e^(-λ·dt)`；③ 单帧积分上限 `dt = min(dt, 0.034)` |
| **没有**借用的东西 | 它的 UI 结构、组件划分、DOM 布局、槽位用法、CSS、注释、命名、代码行 |

本插件的绳子模型是**自己写的**：把它的"砖块弹跳"换成
**Hooke 弹簧 + 重力 + 指数阻尼 + 半隐式欧拉** 的鱼竿吊挂模型
（`F = -k·(|p-anchor| - L)·dir`），锚点逐帧跟随鼠标，
静止时弹力与重力平衡，稳定悬停在锚点下方约 `g/k` 处。

## 三、明确**没有**照抄的部分

- 未复制 `dsh-think-bounce-pet` 的任何代码行、类名、变量名或界面结构
- 未使用它的素材、音频、图标
- 本插件的鱼竿、吊线、气泡、设置页、颜色反馈逻辑均为独立实现

## 四、致谢

- **yanzwzz** —— 鲸鱼娘本体形象的作者，没有这个项目就没有这只鲸鱼
- **9livewolf** —— Q 弹手感的调参基准（那组常数确实调得很好用）
- **DeepSeek Harness** 官方插件（如 `dsh-client-ui-goal`）—— 客户端 bundle 形态的参考范式

---

## 五、附录：上游 MIT 许可全文（随包保留）

下面这段是 `yanzwzz/dsh-whale-girl-pet` 的 LICENSE 原文，按 MIT 要求随本包一起保留。
内嵌的三张姿态图（idle / work / done）的著作权属于上游，授权条款如下：

```
MIT License

Copyright (c) 2026 dsh-whale-girl-pet contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

*如果你是本插件的接收方：这份声明与 `package.json` 里的 `author` 字段请一起保留。
去除上游署名后再分发，是不礼貌的，也可能违反 MIT 的版权声明保留要求。*
