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
| 取用文件 | **上游仓库内**的 `assets/preview/preview-{idle,work,done}.gif`（三张预览动图）——注意：这些 GIF **在本仓库里没有**，此处只说明上游来源 |
| 取了什么 | **每个 GIF 的第 1 帧**里的角色本体 |
| 加工方式 | ① 抽出首帧 → ② 从四边做洪水填充（阈值 26）抠掉背景得到透明通道 → ③ 等比缩放（高统一 180）→ ④ base64 内嵌进 `lib/client.js` |
| 加工者 | 星河野望 |
| 成品文件 | 抠好的三张（本地制作目录 `F:\DSH_Workspace\ref\cursor-candidates\`，**仅存于作者本机、未随仓库分发**）：`keyed-idle.png`（144×180，65.0 KB）<br>`keyed-work.png`（159×180，68.9 KB）<br>`keyed-done.png`（160×180，69.6 KB）<br>**实际分发形态**：三张图以 **base64 内嵌**在 `lib/client.js` 里，本仓库不再单独分发原始 PNG/GIF |
| 在插件里的用途 | v6 起作为**姿态包**：idle＝平时 / work＝DSH 在跑 / done＝跑完了（切换只改 `display`，三张都在 DOM 里） |

**上游的 MIT 版权声明与许可条款完整保留**，未做任何删除或修改。
换句话说：这三张画的著作权仍是上游作者的，MIT 允许我们这样用（含再分发），
但**不能说成"我自己画的"**，也不能去掉这份声明。

> v1 只用了 idle 一张；v6 起三张全用上（work / done 的声明在此补齐）。
> **`assets/preview/*.png`（README 里的真机截图 / 特写 / 小剧场）同样包含本节的鲸鱼娘形象**，
> 属同一份 MIT 声明覆盖范围，不得声称该形象为截图作者原创。
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

## 四、版本沿革（本插件自己的代码，逐版记下"改了什么、为什么"）

> 收录要求里最重要的一条是"**如实说明这是什么**"，所以这里把本插件从 v1 到现在的
> 每一次**功能升级与缺陷修复**都列出来。作者是星河野望，实现由 DSH 会话协作完成；
> 内嵌素材的著作权仍属上游（见第一、二节）。

### 4.1 主版本速览

| 版本 | 一句话 | 关键内容 |
| --- | --- | --- |
| **v0.1.9**（当前） | 性能优先 | 静息快车道 · DOM 写入去重 · 轮询改按需 · 破防四档 + 真脱钩完整版 |
| v0.1.8 | 脱钩打磨 | 宕机期鼠标不再牵引她 · 沉底整身可见 · 浮在水里的轻晃 |
| v0.1.7 | 手感与台词校正 | 门槛按气泡冷却标定（约 3 秒可断钩）· 断钩那一鞭只说一句 |
| v0.1.6 | 真脱钩 | 鱼线淡出 + 断线头 + 绳子不施力，她往下沉 |
| v0.1.5 | 修正两条实测问题 | 滚动窗口计数 · 发抖限时 · 腹黑台词池 |
| v0.1.4 | 破防四档 | 晃晕 → 求饶 → 破防 → 摆烂，门槛/冷却全可调 |
| v0.1.3 | 修弹窗遮挡 | 鱼竿层搬进 `document.body` 顶层容器（所有弹窗一次修好） |
| v0.1.2 | 尖叫池扩容 | 3 → 13 条（求饶 / 哭唧唧）+ 台词池版本合并机制 |
| v0.1.1 | 修"被甩飞却没气泡" | 触发搬进物理循环（相对速度）+ 甩飞灵敏度 + 绳末随形变 |
| v0.1.0 | 首个发布版 | 鱼竿当光标 · 弹性绳物理 · 气泡 · 姿态包 · 闲置小剧场 |

### 4.2 逐版明细（时间倒序）

**v15 / v0.1.9 —— 性能优先（"这是鼠标，不能影响鼠标的性能"）**
- 新增**静息快车道**：鼠标没动、她彻底静下来、无演出/抖动/姿态待办时，**整帧跳过计算与 DOM 写入**
  （动画帧照旧续着，任何输入下一帧立刻恢复；另留每 ~0.5 秒心跳帧兜底）
- **DOM 写入去重**：鱼竿 / 鱼线两端 / 鲸鱼娘变换 / 气泡位置，值没变就不写
- **轮询改按需**：只在拿不到会话订阅时才启 800ms 轮询 → 正常情况下**零常驻定时器**
- 闲置小剧场判定从"每帧"改为"每 8 帧"
- 实测：静息 120 帧 **5 次** DOM 写入 vs 鼠标狂动 120 帧 **858 次**
- 自检新增性能组：静息/活动写入比、计数封顶（时刻表 ≤64）、零常驻 interval、监听器不重复注册

**v14 / v0.1.8 —— 脱钩打磨**
- 修"宕机期鼠标还能轻轻牵动她"：脱钩期间不再把鼠标速度代入物理
- 修"沉底只露三分之一脑袋"：边界改按**整身**（缩放后身高）计算，整个身子都在屏内
- 新增**浮沉**：沉底后像浮在水里轻轻上下晃（可调，0 = 不动）

**v13 / v0.1.7 —— 手感与台词校正**
- ④ 门槛按**气泡冷却下限**重新标定（窗口 8s、门槛 2/4/6）→ 实测认真甩约 **3 秒**可断钩
- 断钩那一鞭**只说一句**罢工宣言（不再先蹦一句"还没断线"的台词）
- 台词池判定改为读**运行时活池子**（避免误判）

**v12 / v0.1.6 —— 真脱钩**
- 摆烂档从"虚线但还拉得动"升级为**真脱钩**：鱼线淡出 + 竿尖留断线头 + 绳子完全不再施力
- 保命：飘出可视区前被边界接住；鱼竿照旧跟鼠标（光标语义不丢）；脱钩期间不冒泡

**v11 / v0.1.5 —— 修正两条实测问题**
- 计数改**滚动窗口**（原来"连续不中断"在物理上凑不到门槛）
- 发抖改**限时**（原来"档位 ≥③ 就永远抖"，像卡了 bug）；档位会自然回归
- 闲置小剧场 20 → 32 条、平静台词 10 → 15 条（新增腹黑嘲讽系）

**v10 / v0.1.4 —— 破防四档**
- ① 晃晕 → ② 求饶 → ③ 破防（限时发抖 + 连发两条）→ ④ 摆烂（罢工）
- 每一档的门槛、冷却、发抖时长、台词池**全部可在设置页调**
- 门槛自动理顺（防止手改配置导致 ③/④ 永远轮不到）

**v9 / v0.1.3 —— 修"弹窗一开鱼竿就看不见"**
- 根因：官方弹窗是挂到 `document.body` 的，而本插件浮层在槽位里、深处祖先链，
  祖先的 `overflow/transform/filter` 会毁掉 `position:fixed` 与层级
- 修法：把浮层节点搬进一个挂在 `body` 下的顶层容器 → **所有弹窗一次修好**
- 附带：全屏元素兜底（趁其进入顶层前先压低其 z-index）

**v8 / v0.1.2 —— 气泡触发与尖叫池**
- 气泡改由**物理循环触发**（强度 = max(瞬时加速度, 她与鼠标的相对速度)）→
  修掉"被甩飞那半秒完全没泡、切回窗口反而尖叫"
- 尖叫池 3 → 13 条（纯尖叫 / 求饶 / 哭唧唧）；字号随力度长到"和她一样大"
- 绳末端在 Q 弹形变中跟随头顶（不再看起来脱钩）

**v7 / v0.1.1 —— 闲置小剧场 + 上架准备**
- 鼠标停 6 秒开演：钓鲸鱼 / 钓鱼佬 / 空军主题 20 条（一半嘲讽一半卖萌）
- 三套语录共用"上次说话时刻"闸门 → 永远一句一句、不抢麦

**v6 —— 姿态包**
- idle 平时 / work 在忙 / done 干完了，读官方会话服务的 `running`
- 三张图同时挂在 DOM 里，切姿态只改 `display`（不重新解码、每帧零开销）
- 读不到服务时自动退化为"跟着甩动"且不报错

**v5 —— 挂点修正**
- 用 jimp 扫 alpha 发现：画布中线那一列要到 y=10 才有实体像素（顶端是留白）
- 挂点改为**构建期现量**（中线列第一个 alpha>40 的像素），绳末端误差 0.000px

**v4 —— 手感与台词**
- 阻尼换回低阻尼常数（要能"甩飞"）；递进刚度保留
- 修"线没连到头上"（变换序列把缩放挂错锚点）
- 惊恐台词随力度变大（最大 ≈ 她身高）；甩完平静下来补一句求饶/卖萌/生气

**v3 —— 朝向、尺寸、手感、气泡触发**
- 鱼竿朝向改为与箭头光标同向；新增"鱼竿当光标"模式（Alt+Esc 应急切换）
- 递进刚度 + 阻尼比换算；气泡由鼠标瞬时加速度触发

**v2 / v1 —— 起步**
- 独立插件骨架（双面插件）、`shell.overlay` 全屏装饰层、静态 PNG 跑通

### 4.3 已知边界（如实说明）

- 本插件是**手工放进 `node_modules`** 的形态之一（`install-to-profile.mjs` 幂等安装），
  若在 profile 里跑 `pnpm install` / `pnpm prune` 有可能被清掉，重跑安装脚本即可复原
- 修改 `lib/client.js`（浏览器半边）后**必须重启 `dsh web`**，硬刷新不够（bundle 在启动时进内存缓存）
- 全屏场景：浏览器"顶层"里的全屏元素优先级高于任何 z-index，本插件靠"趁其进入前先压低"
  兜底，极端情况下（别人动态改回 z-index）可能被覆盖
- 形象与手感常数来自上游（见第一、二节），**不是原创美术**

---

## 五、致谢

- **yanzwzz** —— 鲸鱼娘本体形象的作者，没有这个项目就没有这只鲸鱼
- **9livewolf** —— Q 弹手感的调参基准（那组常数确实调得很好用）
- **DeepSeek Harness** 官方插件（如 `dsh-client-ui-goal`）—— 客户端 bundle 形态的参考范式

---

## 六、附录：上游 MIT 许可全文（随包保留）

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
