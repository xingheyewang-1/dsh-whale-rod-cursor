/**
 * ============================================================================
 * dsh-whale-rod-cursor —— 浏览器半侧（browser half）· 源码
 * ============================================================================
 * ⚠️ 本文件是**源码**：素材位置写的是占位符 __WHALE_PNG_DATAURI__，
 *    由 build.cjs 注入真实 base64 后生成 lib/client.js（真正被加载的那份）。
 *    **要改逻辑请改本文件，然后重新 build**，别直接改 client.js（会被覆盖）。
 *
 * 【这是什么】
 *   在 DSH Web 界面上挂一根鱼竿：**鼠标位置 = 竿尖**，一条**带弹性的绳**
 *   吊着 **Q 版鲸鱼娘（鱼饵）**。鼠标一动，鱼饵被猛拽、再指数衰减、
 *   最后只留下一点点软软的跟手弹性；甩猛了会冒萌语气泡。
 *
 * 【v7 的改动（用户 2026-09-15："鼠标鲸鱼也弄个停顿几秒后开启小剧场…先写20条用着"）】
 *   新增**闲置小剧场**：鼠标停下来（默认 6 秒）就自己开演，台词池 20 条，
 *   主题围绕「吊鲸鱼 / 钓鱼佬 / 空军」—— 一半嘲讽（"钓鱼佬今天又空军了吧～"），
 *   一半卖萌（"要不要我给你咬一口？就一口哦"）。台词间隔默认 7 秒，不连着重复；
 *   与尖叫/平静台词共用"上次说话时刻"闸门，所以永远是你一句我一句、不会抢麦；
 *   DSH 在干活（work 姿态）时她不插嘴。
 *
 * 【v6 的改动（用户 2026-09-15："直接做多姿态吧，尾巴就不做了"）】
 *   姿态包 idle(平时) / work(在忙) / done(干完了)，三张图都已抠好，构建期各自量挂点。
 *   两种驱动来源（设置页可切）：
 *     · 跟着 DSH 干活状态（默认）：读官方客户端服务 `ctx.get('sessions')` 的列表
 *       快照 `{ current, byId }`，取当前会话那一行的 `running` 布尔值 ——
 *       在跑 → work；跑完 → done 停 2.5 秒 → 回 idle。
 *       （服务不可用时自动退化成"跟着甩动"，绝不报错）
 *     · 跟着甩动：她被甩飞 → work（手忙脚乱）；静下来 → done（喘口气）→ idle。
 *   三张图都内嵌成三个 <image>，切换只改 display —— 零解码、零闪烁、零每帧开销。
 *   （额外约 180KB base64，一次性解析；鼠标路径完全不受影响）
 *
 * 【v5 的改动（用户 2026-09-14 三次反馈："线还是没连到头上，差了一点点"）】
 *   真凶：**素材画布上方有透明留白**。绳末端钉在画布中线的最顶端，而她
 *   在画布中线处的头顶其实从下面几像素才开始 —— 数学上"接上了"，视觉上差一截。
 *   现在挂点由 **build.cjs 每次构建用 jimp 扫 alpha 现量**（画布中线往下第一个
 *   实体像素 = 她的头顶），注入 __WHALE_META__，并存档 lib/whale-anchor.json；
 *   Q 弹压缩的支点也改成"内容中心"，换素材不用手改任何常数。
 *
 * 【v4 的四处改动（用户 2026-09-14 二次反馈）】
 *   1. 阻尼换回"低阻尼"手感：**要能把鲸鱼娘甩飞出去**（v3 那版阻尼太大、
 *      她只会乖乖滑回来，没有甩飞的爽感）。递进刚度保留（初始猛拽不变）。
 *   2. 修线材：鲸鱼娘原来的变换序列是
 *        translate → rotate → translate(0,H/2) → scale(sx·S) → translate(0,-H/2)
 *      缩放挂在"半高"锚点上，导致她的**头顶被抬到锚点上方约 25px**，
 *      绳末端其实插在她脑袋里（看起来就是"线没连上"）。改为
 *        translate → rotate → scale(S) → translate(0,H/2) → scale(sx,sy) → translate(0,-H/2)
 *      整体缩放放外层、Q 弹压缩绕中心 —— 头顶严格落在绳末端。
 *   3. 气泡字号跟着甩动力度长：力度越大字越大，尖叫声最大**和鲸鱼娘一样大**。
 *   4. 平静下来后补一句"求饶/卖萌/生气"台词，停留 2–3 秒（默认 2.6s）。
 *
 * 【v3 的改动（保留）】
 *   竿子朝向修正（竿身朝右下 = 与箭头光标同朝向）、整体尺寸 0.72 倍、
 *   递进刚度（初始拉力极大 → 指数衰减）、气泡改由鼠标瞬时加速度触发、
 *   新增"鱼竿当光标"模式（Alt+Esc 应急切换）。
 *
 * 【为什么默认"鱼竿当光标"】
 *   悬停输入框/按钮/按下时鱼竿会变色，等于**把光标语义画在了鱼竿上**，
 *   所以藏掉系统光标也不丢信息；而且竿尖严格跟手（不做平滑），零延迟。
 *   想换回"真光标 + 拖挂"：设置页切一下，或按 **Alt+Esc** 临时切换（应急用）。
 *   安全网：窗口失焦 / 标签页隐藏 / 组件卸载时**立即恢复系统光标**，绝不让你找不到鼠标。
 *
 * 【素材出处与授权（重要，勿删）】
 *   内嵌的 Q 版鲸鱼娘 PNG 取自上游插件：
 *     yanzwzz/dsh-whale-girl-pet   (MIT License)
 *     源文件: assets/preview/preview-idle.gif
 *   加工：由 **星河野望** 从其 GIF 首帧裁出角色、透明化（四边洪水填充抠背景）、
 *         缩放到 144×180 后内嵌。上游版权与 MIT 条款完整保留。
 *   完整声明见包根目录 NOTICE.md。
 *
 * 【力学公式的参考出处（只取公式形式，未复制实现）】
 *   Q 弹振荡与阻尼/重力的调参基准，参考自 DSH 社区插件
 *     dsh-think-bounce-pet（作者 9livewolf，其 package.json 声明 MIT）：
 *       其常量 DEFORM_OMEGA(2π×7) / DEFORM_TAU(170ms) / DEFORM_SQUASH(0.55)
 *                / GRAVITY_BASE(1500) / MAX_DT(0.034)
 *   本插件**只借用这些物理量的取值与公式形式**：
 *       · 阻尼余弦振荡：amp = A·e^(-t/τ)，形变 ∝ amp·cos(ωt)
 *       · 指数阻尼：v *= e^(-λ·dt)
 *       · 单帧积分上限：dt = min(dt, 0.034)
 *   代码结构、注释与全部 UI **均按本插件主题独立重写**，未复制其任何实现或界面。
 *
 * 【弹性绳模型（v3：递进刚度 + 相对阻尼）】
 *   锚点 = 竿尖（鼠标）；质量点 = 鲸鱼娘。
 *       相对速度   vrel    = v_bait - v_mouse
 *       递进刚度   k_eff   = k_soft + k_yank · clamp(|vrel| / YANK_REF, 0, 1)
 *       弹力       F_spring= -k_eff · (|p - anchor| - L) · dir        (Hooke)
 *       阻尼       F_damp  = -c · vrel        （跟手拖拽感的主要来源）
 *       重力       F_grav  = g
 *       指数阻尼   v *= e^(-λ·dt)
 *       半隐式欧拉 v += a·dt; p += v·dt
 *
 *   → 甩动瞬间 |vrel| 大 ⇒ k_eff ≈ 360 ⇒ 拉力极大，鱼饵被"拽"出去；
 *     追上鼠标后 |vrel| 迅速变小 ⇒ k_eff 回落 ⇒ 拉力**指数级衰减**；
 *     静止时只剩 k_soft(=60) 与微小重力沉降（≈ g/k_soft = 25px）⇒ 软软跟手。
 *
 * 【工程约定】
 *   - 手写的 window.__ModuleLoader__.load({ id, factory }) 形态，零构建步骤
 *   - React 由 DSH 外壳提供（require('react')），**不自己打包**
 *   - 每帧只改 transform / SVG 属性，绝不碰 layout 属性
 *   - 单个 rAF 主循环；标签页隐藏时暂停
 *   - 套渲染错误围栏：出错只显示错误文本，绝不抛到框架导致 overlay 条目被卸载
 * ============================================================================
 */
window.__ModuleLoader__.load({
	// 插件唯一 ID，必须与 package.json 里声明的一致
	id: 'dsh-whale-rod-cursor',

	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		// 客户端版本暗号 —— 控制台输入 __WHALE_ROD_CURSOR_VER__ 可确认加载到的是哪版
		try { if (typeof window !== 'undefined') window.__WHALE_ROD_CURSOR_VER__ = '2026-09-15-v7-theater'; } catch (e) { /* ignore */ }

		let react = require('react');

		// ====================================================================
		// 素材（占位符由 build.cjs 注入）
		//   POSES 是构建期用 jimp 扫 alpha 量出来的，别手改：
		//     { idle|work|done: { src: dataURI, meta: { w,h,ax,ay,cx,cy,ch,box } } }
		//   ax/ay = 绳该挂的像素（画布中线往下第一个实体像素 = 她中线处的头顶）
		//   cx/cy = 内容中心相对挂点的偏移（Q 弹压缩绕它做）· ch 内容高度
		//   "线没连到头上"就是画布上方有透明留白造成的：绳末端原先钉在画布顶端，
		//   而她在画布中线处的头顶其实在下面几像素才开始。
		// ====================================================================
		const POSES = __WHALE_POSES__;
		const POSE_KEYS = ['idle', 'work', 'done'];
		const META_OF = (key) => (POSES[key] && POSES[key].meta) || POSES.idle.meta;

		// 宿主 ctx（apply 时抓住），用来读 DSH 的会话状态
		let LIVE_CTX = null;

		// ====================================================================
		// 力学常量（取值参考上游，见文件头「力学公式的参考出处」）
		// ====================================================================
		const GRAVITY_BASE = 1500;                 // 重力基准 px/s²（上游 50 档）
		const MAX_DT = 0.034;                      // 单帧积分上限（秒）—— 上游同值
		const DEFORM_OMEGA = Math.PI * 2 * 7;      // Q弹角频率 ≈ 7Hz —— 上游同值
		const DEFORM_TAU = 170;                    // 振幅指数衰减常数(ms) —— 上游同值
		const DEFORM_TTL_MS = 640;                 // 单次 Q弹 时长上限(ms) —— 上游同值
		const DEFORM_SQUASH = 0.55;                // 峰值压缩比 —— 上游同值
		const DEFORM_RETRIGGER_MS = 300;           // Q弹 最小重触发间隔，避免连续抖动
		const YANK_REF = 1600;                     // 相对速度参考值(px/s)：到这速度刚度加满
		const SCREAM_MUL = 3;                      // 加速度超过阈值的 3 倍 → 尖叫语录
		const MOUSE_V_ALPHA = 0.35;                // 鼠标速度 EMA（用于算相对速度）
		const BUBBLE_BASE_PX = 13;                 // 平静台词字号
		const CALM_SPEED = 150;                    // 相对速度低于它算"平静"(px/s)
		const CALM_QUIET_S = 0.7;                  // 要平静这么久才补台词（秒）

		// ====================================================================
		// 设置（localStorage 持久化；MUT 是运行时可变的活对象，动画每帧读它）
		// ====================================================================
		const SETTINGS_KEY = 'dsh-whale-rod-cursor.settings';
		const SETTINGS_EVT = 'dsh-rod-cursor-settings';
		const NONE_CLASS = 'dsh-rod-cursor-none';  // 挂在 <html> 上：隐藏系统光标

		const DEFAULT_QUOTES = [
			'晃晕啦～',
			'杀鲸啦！',
			'别钓我啦～',
			'我是鲸鱼不是鱼饵！',
			'快放我下来！',
			'呜哇——！',
			'呼……吓死鲸了',
			'转圈圈好晕哦',
			'线要断啦！',
			'我只是一条鱼……',
		];

		// 甩到失控时才喊的
		const SCREAM_QUOTES = [
			'啊啊啊啊啊——',
			'啊啊啊啊啊——！',
			'呜哇啊啊啊啊——',
		];

		// 平静下来之后才说的（求饶 / 卖萌 / 生气），停留 2–3 秒
		const CALM_QUOTES = [
			'不钓了嘛…我错了',
			'放我回海里好不好～',
			'我保证不偷 Token 了…',
			'诶嘿嘿～',
			'摸摸头嘛～',
			'我是不是全世界最可爱的鲸鱼呀',
			'尾巴给你摸摸！',
			'哼！不理你了',
			'再甩我就咬线！',
			'你等着，我记仇的',
		];

		// 闲置小剧场（鼠标停一会儿就自己开演）：主题 = 吊鲸鱼 / 钓鱼佬 / 空军
		// 注意：是"你钓鱼佬空军"，不是"我鲸鱼空军" —— 她负责嘲讽与卖萌
		const IDLE_QUOTES = [
			// —— 嘲讽钓鱼佬 ——
			'钓鱼佬今天又空军了吧～',
			'钓鲸鱼？你有那体格吗～',
			'你把鼠标当鱼漂甩，钓得到才有鬼',
			'报告钓鱼佬：本鲸鱼今天不上钩～',
			'空军司令您好，敬礼！',
			'人家钓鱼佬是钓鱼，你是钓了个寂寞',
			'你这竿抖得…我有点想笑',
			'鱼护空空的，要不要我下去给你捞两条？',
			'甩这么猛，你是钓鱼还是打羽毛球？',
			'别灰心，下辈子你就是钓鱼大师了',
			'我在水底下看着你空军，都笑出气泡了',
			// —— 卖萌 / 关心 ——
			'被吊着好晕…不过还挺好玩的',
			'钓我？先准备一吨小鱼干再说',
			'钓到大鱼要记得放生哦…比如我',
			'要不要我给你咬一口？就一口哦',
			'本鲸鱼今天心情好，允许你摸一下头',
			'鱼竿举这么久，手酸不酸呀～',
			'我这么可爱，你舍得拿我当鱼饵吗',
			'别钓了，去睡觉吧，梦里全是大鱼',
			'你这么闲，是不是在等我说话呀～',
		];

		const MUT = {
			on: true,
			mode: 'replace',   // 'replace' = 鱼竿就是光标（隐藏系统光标）/ 'attach' = 真光标+拖挂
			scale: 0.72,       // 整体尺寸（鱼竿 + 挂件一起缩）
			lineLen: 62,       // 绳的自然长度（px）
			kSoft: 70,         // 软跟随刚度：静止时只剩它 → 软软跟手
			kYank: 320,        // 瞬间拉力：甩动时额外刚度 → 初始拽力极大
			dampRel: 2.6,      // 阻尼系数 c：小 = 甩得飞、甩完还会荡；大 = 乖乖滑回来
			dampAbs: 1.2,      // 绝对阻尼 λ（指数衰减，防永动）
			gravity: 1,        // 重力倍率（1 = GRAVITY_BASE）
			cooldownMs: 4500,  // 气泡冷却上限（ms）；甩得越猛实际冷却越短
			accelTrigger: 45000, // 甩动灵敏度：鼠标瞬时加速度阈值（px/s²）
			calmMs: 2600,      // 平静台词停留时长（ms）
			poseOn: true,      // 姿态包开关（关掉就一直用 idle）
			poseSource: 'dsh', // 'dsh' = 跟着 DSH 干活状态 / 'swing' = 跟着甩动
			doneMs: 2500,      // "干完了"姿态停留多久（ms）
			idleOn: true,      // 闲置小剧场开关
			idleStartMs: 6000, // 鼠标停多久开始演小剧场（ms）
			idleGapMs: 7000,   // 小剧场台词之间的间隔（ms）
			quotes: DEFAULT_QUOTES.slice(),
			screamQuotes: SCREAM_QUOTES.slice(),
			calmQuotes: CALM_QUOTES.slice(),
			idleQuotes: IDLE_QUOTES.slice(),
		};

		function clampNum(v, lo, hi, fb) {
			const n = Number(v);
			if (!isFinite(n)) return fb;
			return Math.min(hi, Math.max(lo, n));
		}

		function cleanList(v, fb) {
			if (!Array.isArray(v)) return fb;
			const list = v.filter((s) => typeof s === 'string' && s.trim());
			return list.length ? list : fb;
		}

		function loadSettings() {
			try {
				const raw = window.localStorage.getItem(SETTINGS_KEY);
				if (raw) {
					const j = JSON.parse(raw);
					if (typeof j.on === 'boolean') MUT.on = j.on;
					if (j.mode === 'attach' || j.mode === 'replace') MUT.mode = j.mode;
					MUT.scale = clampNum(j.scale, 0.5, 1.2, MUT.scale);
					MUT.lineLen = clampNum(j.lineLen, 30, 160, MUT.lineLen);
					MUT.kSoft = clampNum(j.kSoft, 20, 160, MUT.kSoft);
					MUT.kYank = clampNum(j.kYank, 0, 800, MUT.kYank);
					MUT.dampRel = clampNum(j.dampRel, 0, 8, MUT.dampRel);
					MUT.dampAbs = clampNum(j.dampAbs, 0, 6, MUT.dampAbs);
					MUT.gravity = clampNum(j.gravity, 0, 2.5, MUT.gravity);
					MUT.cooldownMs = clampNum(j.cooldownMs, 800, 12000, MUT.cooldownMs);
					MUT.accelTrigger = clampNum(j.accelTrigger, 5000, 200000, MUT.accelTrigger);
					MUT.calmMs = clampNum(j.calmMs, 1000, 5000, MUT.calmMs);
					if (typeof j.poseOn === 'boolean') MUT.poseOn = j.poseOn;
					if (j.poseSource === 'dsh' || j.poseSource === 'swing') MUT.poseSource = j.poseSource;
					MUT.doneMs = clampNum(j.doneMs, 800, 8000, MUT.doneMs);
					if (typeof j.idleOn === 'boolean') MUT.idleOn = j.idleOn;
					MUT.idleStartMs = clampNum(j.idleStartMs, 2000, 60000, MUT.idleStartMs);
					MUT.idleGapMs = clampNum(j.idleGapMs, 2500, 60000, MUT.idleGapMs);
					MUT.quotes = cleanList(j.quotes, MUT.quotes);
					MUT.screamQuotes = cleanList(j.screamQuotes, MUT.screamQuotes);
					MUT.calmQuotes = cleanList(j.calmQuotes, MUT.calmQuotes);
					MUT.idleQuotes = cleanList(j.idleQuotes, MUT.idleQuotes);
				}
			} catch (e) { /* 配额 / 隐私模式：用默认值 */ }
			return MUT;
		}

		function saveSettings(patch) {
			Object.assign(MUT, patch);
			try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(MUT)); } catch (e) { /* ignore */ }
			try { window.dispatchEvent(new CustomEvent(SETTINGS_EVT)); } catch (e) { /* ignore */ }
		}

		loadSettings();

		// ====================================================================
		// 配色 —— 承载"可交互性"信息，不是装饰
		//   基础态    深海青蓝   安静、不抢眼
		//   悬停输入框 亮青绿   "这里可以打字"
		//   悬停可点   淡金     "这个能点"
		//   按下鼠标   橙红     闪一下 = "点到了"
		// ====================================================================
		const C_BASE = '#4FA3D1';
		const C_INPUT = '#5FE3B0';
		const C_BTN = '#F2B23E';
		const C_CLICK = '#F2603E';

		// ====================================================================
		// 样式（内联注入 <style>）
		// ====================================================================
		const CSS = `
.dsh-rod-host {
  position: fixed; inset: 0; pointer-events: none;
  z-index: 2147483000;
  opacity: 0; transition: opacity .3s ease;
  --rod-color: ${C_BASE};
}
.dsh-rod-host.dsh-rod-visible { opacity: 1; }
/* 鱼竿当光标模式：藏掉系统光标（整层 pointer-events:none，不影响任何交互） */
html.${NONE_CLASS}, html.${NONE_CLASS} * { cursor: none !important; }
.dsh-rod-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.dsh-rod-line {
  stroke: var(--rod-color); stroke-width: 1.1; stroke-linecap: round;
  opacity: .8; transition: stroke .18s ease;
}
.dsh-rod-stick { stroke: var(--rod-color); stroke-width: 2.4; stroke-linecap: round; transition: stroke .18s ease; }
.dsh-rod-grip  { stroke: var(--rod-color); stroke-width: 4.2; stroke-linecap: round; opacity: .78; transition: stroke .18s ease; }
.dsh-rod-tip   { fill: var(--rod-color); transition: fill .18s ease; }
.dsh-rod-whale { will-change: transform; filter: drop-shadow(0 3px 6px rgba(0,0,0,.35)); }
.dsh-rod-bubble-wrap {
  position: absolute; left: 0; top: 0;
  transform: translate3d(-9999px,-9999px,0);
  will-change: transform; pointer-events: none;
}
.dsh-rod-bubble {
  transform: translate(-50%, -100%);
  /* padding / 边框用 em：字号一变大，气泡整体跟着长 */
  padding: .18em .6em; border-radius: 999px;
  border: .07em solid var(--rod-color);
  background: color-mix(in srgb, var(--dsw-alias-bg-base, #16203a) 88%, transparent);
  color: var(--dsw-alias-label-primary, #e8eef8);
  font-size: 13px; line-height: 1.35; white-space: nowrap; font-weight: 600;
  opacity: 0; transition: opacity .22s ease;
  text-shadow: 0 1px 2px rgba(0,0,0,.5);
}
.dsh-rod-bubble.dsh-rod-bubble-on { opacity: 1; }
.dsh-rod-note { font-size: 12px; line-height: 1.7; color: var(--dsw-alias-label-secondary, #9fb0c8); margin: 4px 0 8px; }
.dsh-rod-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(128,128,128,.16); font-size: 13px; }
.dsh-rod-input { width: 110px; padding: 4px 8px; border-radius: 8px; border: 1px solid #cfe4ff; font-size: 12px; background: transparent; color: inherit; }
.dsh-rod-btn { border: 1px solid #cfe4ff; border-radius: 8px; padding: 4px 14px; cursor: pointer; font-size: 12px; background: transparent; color: inherit; }
.dsh-rod-ta { width: 100%; box-sizing: border-box; min-height: 92px; padding: 6px 8px; border-radius: 8px; border: 1px solid #cfe4ff; font-size: 12px; line-height: 1.7; background: transparent; color: inherit; resize: vertical; }
`;

		// 把样式插进 <head>（只插一次；用固定 id 方便排查）
		try {
			if (typeof document !== 'undefined' && !document.getElementById('dsh-rod-cursor-style')) {
				const styleEl = document.createElement('style');
				styleEl.id = 'dsh-rod-cursor-style';
				styleEl.textContent = CSS;
				(document.head || document.documentElement).appendChild(styleEl);
			}
		} catch (e) { /* 注入失败也不影响物理逻辑 */ }

		// 藏/还系统光标 —— 唯一的"有风险"操作，所以给两条安全网：
		//   ① 窗口失焦、鼠标离开、标签页隐藏、组件卸载、渲染出错 → 立即还回去
		//   ② Alt+Esc 应急切换回"真光标 + 拖挂"模式
		function setNativeCursorHidden(hide) {
			try {
				const el = document.documentElement;
				if (!el || !el.classList) return;
				if (hide && MUT.mode === 'replace') el.classList.add(NONE_CLASS);
				else el.classList.remove(NONE_CLASS);
			} catch (e) { /* ignore */ }
		}

		// ====================================================================
		// 渲染错误围栏（照 dsh-whale-girl-pet 的 guarded() 思路）
		// 槽位条目一旦向上抛异常，框架会卸载整个条目 —— 对 shell.overlay
		// 来说就是"整块消失"。所以出错只显示错误文本，绝不 rethrow。
		// ====================================================================
		class RodBoundary extends react.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(error) {
				return { error };
			}
			componentDidCatch(error, info) {
				try {
					console.error('[whale-rod-cursor] 渲染出错（已隔离）：' + this.labelText(), error, info);
				} catch (e) { /* ignore */ }
				setNativeCursorHidden(false);   // 出事必须把光标还回去
			}
			labelText() {
				return (this.props && this.props.label) ? this.props.label : '鱼竿光标';
			}
			render() {
				if (this.state.error) {
					return react.createElement('div', {
						style: { padding: 12, color: '#c24040', fontSize: 12, lineHeight: 1.6, pointerEvents: 'auto' },
					}, '🎣 ' + this.labelText() + '渲染出错：' + String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error));
				}
				return this.props.children;
			}
		}

		function guarded(Component, label) {
			function GuardedEntry(props) {
				return react.createElement(RodBoundary, { label: label }, react.createElement(Component, props));
			}
			try { Object.defineProperty(GuardedEntry, 'name', { value: label + 'Guarded', configurable: true }); } catch (e) { /* ignore */ }
			return GuardedEntry;
		}

		// ====================================================================
		// 主组件：鱼竿（=光标）+ 弹性绳 + 鱼饵（Q 版鲸鱼娘）+ 气泡
		// ====================================================================
		function RodCursor() {
			const hostRef = react.useRef(null);
			const rodRef = react.useRef(null);
			const lineRef = react.useRef(null);
			const whaleRef = react.useRef(null);
			// 三张姿态图各有自己的 ref（顺序固定，hook 数量稳定）
			const poseRefs = {
				idle: react.useRef(null),
				work: react.useRef(null),
				done: react.useRef(null),
			};
			const wrapRef = react.useRef(null);
			const bubbleRef = react.useRef(null);
			const [cfg, setCfg] = react.useState({ on: MUT.on, mode: MUT.mode });

			// 设置页改动 → 同步（同一页面内跨组件通信）
			react.useEffect(() => {
				const sync = () => setCfg({ on: MUT.on, mode: MUT.mode });
				window.addEventListener(SETTINGS_EVT, sync);
				return () => window.removeEventListener(SETTINGS_EVT, sync);
			}, []);

			react.useEffect(() => {
				if (!cfg.on) return undefined;
				const host = hostRef.current;
				if (!host) return undefined;

				// ---- 运行时状态 ----
				let mx = window.innerWidth / 2, my = window.innerHeight / 2;
				let tx = mx, ty = my;                      // 竿尖
				let bx = mx, by = my + MUT.lineLen;        // 鱼饵（鲸鱼娘）
				let vx = 0, vy = 0;                        // 鱼饵速度
				let mvx = 0, mvy = 0;                      // 鼠标速度（EMA，供相对阻尼用）
				let lastMx = mx, lastMy = my;
				let deformAmp = 0, deformT = 0;            // Q弹 振荡状态
				let deformAt = -1e9;
				let visible = false;
				let state = 'base';
				let clickUntil = 0;
				let lastBubble = -1e9;
				let bubbleCool = MUT.cooldownMs;           // 动态冷却：甩得越猛越短
				let bubbleTimer = 0;
				let lastSay = -1e9;                        // 上次说话时刻（任意台词）
				let lastMoveAtMs = performance.now();      // 鼠标最后动过的时间（闲置小剧场用）
				let agitated = false;                      // 刚被甩过 → 平静后补一句
				let calmT = 0;                             // 已平静持续时长（秒）
				let raf = 0;
				let last = performance.now();
				let paused = false;
				// 鼠标瞬时加速度（在 mousemove 监听里算，见 onMove）
				let hasPrev = false, lastMoveAt = 0, pmx = 0, pmy = 0, spEMA = 0, accEMA = 0;

				function applyColor(nowMs) {
					let c = C_BASE;
					if (nowMs < clickUntil) c = C_CLICK;
					else if (state === 'input') c = C_INPUT;
					else if (state === 'btn') c = C_BTN;
					host.style.setProperty('--rod-color', c);
				}

				function show() {
					if (visible) return;
					visible = true;
					host.classList.add('dsh-rod-visible');
					setNativeCursorHidden(true);
				}

				function hideRod() {
					visible = false;
					try { host.classList.remove('dsh-rod-visible'); } catch (e) { /* ignore */ }
					setNativeCursorHidden(false);
				}

				// ------------------------------------------------------------
				// 姿态包：idle 平时 / work 在忙 / done 干完了
				// 三张图都在 DOM 里，切换只改 display —— 不重新解码、不闪烁、
				// 也不占每帧时间（只在状态真的变了才动一次）。
				// ------------------------------------------------------------
				let pose = 'idle';
				function setPose(next) {
					if (next === pose || POSE_KEYS.indexOf(next) < 0) return;
					try {
						const prevEl = poseRefs[pose] && poseRefs[pose].current;
						if (prevEl && prevEl.style) prevEl.style.display = 'none';
						const el = poseRefs[next] && poseRefs[next].current;
						if (el && el.style) el.style.display = '';
					} catch (e) { /* ignore */ }
					pose = next;
				}

				// 读 DSH 当前会话的"在跑"标志：官方客户端服务 sessions 的列表快照
				//   snap = { current: SessionId, byId: { [id]: { running: boolean, ... } }, ... }
				// 服务不存在 / 结构变了 → 返回 null（调用方退化成"跟着甩动"）
				function readDshBusy() {
					try {
						if (!LIVE_CTX || typeof LIVE_CTX.get !== 'function') return null;
						const sessions = LIVE_CTX.get('sessions');
						const list = sessions && sessions.list;
						if (!list || typeof list.getSnapshot !== 'function') return null;
						const snap = list.getSnapshot();
						if (!snap) return null;
						const cur = snap.current;
						const row = (cur && snap.byId) ? snap.byId[cur] : null;
						if (!row) return false;
						return row.running === true;
					} catch (e) { return null; }
				}

				// 姿态状态机（每帧调一次，读的是缓存值，成本就是几次比较）
				let dshBusy = readDshBusy();     // null = 服务不可用
				let wasBusy = false;
				let doneUntil = 0;
				let keptOnce = false;            // 已提示过一次"退化"（不刷屏）
				function updatePose(nowMs, relSp) {
					if (!MUT.poseOn) { setPose('idle'); return; }
					const useDsh = MUT.poseSource === 'dsh' && dshBusy !== null;
					if (MUT.poseSource === 'dsh' && dshBusy === null && !keptOnce) {
						keptOnce = true;
						try { console.info('[whale-rod-cursor] 读不到 DSH 会话状态，姿态改成跟随甩动'); } catch (e) { /* ignore */ }
					}
					if (useDsh) {
						const busy = dshBusy === true;
						if (busy && !wasBusy) { setPose('work'); doneUntil = 0; }
						else if (!busy && wasBusy) { setPose('done'); doneUntil = nowMs + MUT.doneMs; }
						wasBusy = busy;
						if (!busy && doneUntil && nowMs > doneUntil) { doneUntil = 0; setPose('idle'); }
						return;
					}
					// 跟着甩动：被甩飞 → 手忙脚乱；静下来 → 喘口气 → 回到平时
					if (relSp > 400) { setPose('work'); doneUntil = 0; }
					else if (pose === 'work' && relSp < CALM_SPEED) { setPose('done'); doneUntil = nowMs + MUT.doneMs; }
					if (pose === 'done' && doneUntil && nowMs > doneUntil) { doneUntil = 0; setPose('idle'); }
				}

				/**
				 * 说一句话。sizePx = 字号（甩得越猛越大），holdMs = 停留时长。
				 * 字号用 style.fontSize 直接写，气泡的 padding/边框都是 em，
				 * 所以整颗泡泡会跟着字号一起长大。
				 */
				function say(text, sizePx, holdMs) {
					const b = bubbleRef.current;
					if (!b) return false;
					// 兜底：尖叫字号最大能到"和鲸鱼娘一样大"，长句在窄窗口里会顶出屏幕，
					// 所以按字数再夹一次（宽屏下这个上限根本碰不到）。
					let px = sizePx;
					try {
						const maxByWidth = (window.innerWidth * 0.9) / (String(text).length + 1);
						if (px > maxByWidth) px = maxByWidth;
					} catch (e) { /* ignore */ }
					lastSay = performance.now();
					b.textContent = text;
					try { b.style.fontSize = px.toFixed(1) + 'px'; } catch (e) { /* ignore */ }
					b.classList.remove('dsh-rod-bubble-on');
					void b.offsetWidth;                  // 强制重排以重启动画
					b.classList.add('dsh-rod-bubble-on');
					clearTimeout(bubbleTimer);
					bubbleTimer = window.setTimeout(() => {
						try { b.classList.remove('dsh-rod-bubble-on'); } catch (e) { /* ignore */ }
					}, holdMs);
					return true;
				}

				/** 甩动强度 → 字号：1 倍 = 13px，越猛越大，封顶"和鲸鱼娘一样大"。 */
				function bubbleSizePx(intensity) {
					const S = clampNum(MUT.scale, 0.5, 1.2, 0.72);
					const cap = META_OF(pose).ch * S * 0.95;              // ≈ 鲸鱼娘的身高（内容高度）
					return Math.min(cap, BUBBLE_BASE_PX * Math.pow(Math.max(1, intensity), 1.25));
				}

				/** 冒泡。intensity = 瞬时加速度 / 阈值：越大冒得越快、字越大、够大就尖叫。 */
				function popBubble(intensity) {
					const now = performance.now();
					if (now - lastBubble < bubbleCool) return;
					const scream = intensity >= SCREAM_MUL;
					const pool = scream ? MUT.screamQuotes : MUT.quotes;
					if (!pool || !pool.length) return;
					// 甩得越快 → 冷却越短（下限 700ms，避免刷屏）
					bubbleCool = Math.max(700, MUT.cooldownMs / Math.max(1, intensity));
					lastBubble = now;
					agitated = true;             // 记下"刚被甩过"，平静后要补一句台词
					calmT = 0;
					say(pool[(Math.random() * pool.length) | 0], bubbleSizePx(intensity), scream ? 1600 : 1800);
				}

				/** 触发一次 Q 弹：振幅置 1、计时归零（公式见文件头）。 */
				function triggerDeform(nowMs) {
					if (nowMs - deformAt < DEFORM_RETRIGGER_MS) return;
					deformAt = nowMs;
					deformAmp = 1;
					deformT = 0;
				}

				// ---- 闲置小剧场：鼠标停一会儿就自己开演 ----
				// 台词池围绕「吊鲸鱼 / 钓鱼佬 / 空军」，一半嘲讽一半卖萌。
				// 优先级低于尖叫/平静台词：共用 lastSay 闸门，谁刚说完谁占着。
				const idleRecent = [];      // 最近说过的（避免连着重复）
				function sayIdleLine() {
					const pool = MUT.idleQuotes;
					if (!pool || !pool.length) return;
					let idx = 0;
					for (let tries = 0; tries < 8; tries++) {
						idx = (Math.random() * pool.length) | 0;
						if (idleRecent.indexOf(idx) < 0) break;
					}
					idleRecent.push(idx);
					if (idleRecent.length > Math.max(1, Math.min(5, pool.length - 1))) idleRecent.shift();
					say(pool[idx], BUBBLE_BASE_PX, MUT.calmMs);
				}

				// ---- 事件 ----
				function onMove(e) {
					mx = e.clientX; my = e.clientY;
					lastMoveAtMs = performance.now();      // 记下"还在动"，闲置小剧场要等它停
					show();

					// 交互态判定：不写死任何 DSH 的 class 名，界面改版也不失效
					let s = 'base';
					try {
						const t = e.target;
						if (t && typeof t.closest === 'function') {
							if (t.closest('textarea, input, [contenteditable="true"], [contenteditable=""]')) s = 'input';
							else if (t.closest('button, a, [role="button"]')) s = 'btn';
						}
					} catch (err) { /* ignore */ }
					if (s !== state) { state = s; applyColor(performance.now()); }

					// ------------------------------------------------------------
					// 鼠标瞬时加速度（"甩得多猛"）—— 就写在事件监听里
					//   sp  = 本次事件的移动速度(px/s)
					//   acc = 速度的变化率(px/s²)，即瞬时加速度
					// 抗噪三件套：① dt 下限 8ms（160Hz 高刷鼠标的单像素抖动会被放大成
					//   几万 px/s²）② 速度先做 EMA 再用它求导 ③ 加速度再做 EMA。
					// ------------------------------------------------------------
					const now = (typeof e.timeStamp === 'number' && e.timeStamp > 0) ? e.timeStamp : performance.now();
					if (hasPrev) {
						// 停顿太久（>150ms）说明"上一甩"已经结束了：把平滑基准归零
						// （当作从静止起步），否则残留的高速基准会把新的一记抽鞭
						// 误判成"没有加速"。真实甩动会连出好几个事件，照样抓得住。
						if (now - lastMoveAt > 150) { spEMA = 0; accEMA = 0; }
						let dts = now - lastMoveAt;
						if (dts < 8) dts = 8;
						if (dts > 120) dts = 120;        // 停顿之后再动，不算"甩"
						const dist = Math.sqrt((mx - pmx) * (mx - pmx) + (my - pmy) * (my - pmy));
						const sp = dist / dts * 1000;
						const acc = (sp - spEMA) / dts * 1000;
						spEMA += (sp - spEMA) * 0.5;
						accEMA += (Math.abs(acc) - accEMA) * 0.45;
						const intensity = accEMA / Math.max(1, MUT.accelTrigger);
						// 静止时的小抖动不冒泡：要求确实在动
						if (dist > 1 && sp > 260 && intensity > 1) {
							popBubble(intensity);
							triggerDeform(now);
						}
					}
					pmx = mx; pmy = my; lastMoveAt = now; hasPrev = true;
				}

				function onDown() {
					clickUntil = performance.now() + 150;
					applyColor(performance.now());
					triggerDeform(performance.now());
				}
				function onHide() { hideRod(); }
				function onVis() {
					paused = document.hidden === true;
					if (paused) setNativeCursorHidden(false);
					else last = performance.now();
				}
				// 应急出口：光标不见了 / 想换回真光标 → Alt+Esc
				function onKey(e) {
					if (e.altKey && (e.key === 'Escape' || e.key === 'Esc')) {
						const next = MUT.mode === 'replace' ? 'attach' : 'replace';
						saveSettings({ mode: next });
						// 不依赖 React 重渲染，直接落状态（保命优先）
						if (next === 'attach') setNativeCursorHidden(false);
					}
				}

				// ---- 主循环 ----
				function frame(now) {
					raf = window.requestAnimationFrame(frame);
					if (paused) { last = now; return; }
					let dt = (now - last) / 1000;
					last = now;
					// 单帧上限：防止后台标签恢复后一次积太大而"穿模"（上游同值 0.034）
					if (dt > MAX_DT) dt = MAX_DT;
					if (dt <= 0) return;

					const L = clampNum(MUT.lineLen, 30, 160, 70);
					const S = clampNum(MUT.scale, 0.5, 1.2, 0.72);

					// 竿尖：替换光标模式下**严格跟手**（做了平滑就会有 1 帧拖影，
					// 那正是当初否掉"假光标"方案的原因）；挂件模式给一点点弹性。
					if (MUT.mode === 'replace') { tx = mx; ty = my; }
					else {
						const kf = Math.min(1, dt * 30);
						tx += (mx - tx) * kf;
						ty += (my - ty) * kf;
					}

					// 鼠标速度（EMA）→ 用于相对阻尼
					mvx += ((mx - lastMx) / dt - mvx) * MOUSE_V_ALPHA;
					mvy += ((my - lastMy) / dt - mvy) * MOUSE_V_ALPHA;
					lastMx = mx; lastMy = my;

					// ------------------------------------------------------------
					// 弹性绳：递进刚度 + 相对速度阻尼 + 重力 + 指数衰减
					//   锚点 = 竿尖(tx,ty)；质量点 = 鱼饵(bx,by)
					// ------------------------------------------------------------
					const dx = bx - tx, dy = by - ty;
					const d = Math.sqrt(dx * dx + dy * dy) || 1;
					const stretch = d - L;                     // >0 拉长，<0 压缩
					const rvx = vx - mvx, rvy = vy - mvy;      // 相对速度
					const relSp = Math.sqrt(rvx * rvx + rvy * rvy);
					// 递进刚度：甩得越猛越硬 → 初始拉力极大
					const kEff = MUT.kSoft + MUT.kYank * Math.min(1, relSp / YANK_REF);
					// 阻尼系数是**常数**（v4 换回低阻尼）：甩起来会被拽得飞出去、
					// 甩完还会自己荡几下 —— 想要"乖乖滑回来"就把阻尼调大。
					const ax = -kEff * stretch * (dx / d) - MUT.dampRel * rvx;
					const ay = -kEff * stretch * (dy / d) - MUT.dampRel * rvy + GRAVITY_BASE * MUT.gravity;
					// 绝对指数阻尼（学上游 friction 的写法：v *= e^(-λ·dt)）
					const decay = Math.exp(-MUT.dampAbs * dt);
					vx *= decay; vy *= decay;
					// 半隐式欧拉：先速度后位置（比显式欧拉稳定得多）
					vx += ax * dt; vy += ay * dt;
					bx += vx * dt; by += vy * dt;

					// ---- 姿态包：按 DSH 干活状态 / 甩动强度切换 ----
					updatePose(now, relSp);

					// ---- Q 弹：阻尼余弦振荡 ----
					// amp = A·e^(-t/τ)，形变 ∝ amp·cos(ωt)；播完 TTL 就停，
					// 避免常驻振荡看起来像"抖动"而不是"Q 弹"。
					let squash = 0;
					if (deformAmp > 0) {
						deformT += dt * 1000;
						const amp = deformAmp * Math.exp(-deformT / DEFORM_TAU);
						squash = DEFORM_SQUASH * amp * Math.cos(DEFORM_OMEGA * deformT / 1000);
						if (deformT > DEFORM_TTL_MS || amp < 0.012) { deformAmp = 0; deformT = 0; squash = 0; }
					}

					// ---- 平静检测：被甩过之后安静下来 → 补一句求饶/卖萌/生气 ----
					if (relSp < CALM_SPEED) {
						calmT += dt;
						if (agitated && calmT > CALM_QUIET_S && performance.now() - lastSay > MUT.calmMs) {
							const pool = MUT.calmQuotes;
							if (pool && pool.length) say(pool[(Math.random() * pool.length) | 0], BUBBLE_BASE_PX, MUT.calmMs);
							agitated = false;            // 每次"被甩"只补一句，不啰嗦
						}
					} else {
						calmT = 0;
					}

					// ---- 闲置小剧场：鼠标停够久、她也静下来了 → 自己开演 ----
					// 三个闸门：真的没在动 / 已经静下来（不在荡） / 距上次说话够久；
					// DSH 在干活（work 姿态）时不插嘴，专心当"在忙的鲸鱼"。
					if (MUT.idleOn && relSp < CALM_SPEED && pose !== 'work') {
						const idleFor = performance.now() - lastMoveAtMs;
						if (idleFor > MUT.idleStartMs && performance.now() - lastSay > MUT.idleGapMs) {
							sayIdleLine();
						}
					}

					// ---- 渲染 ----
					const deg = Math.atan2(bx - tx, by - ty) * 180 / Math.PI;   // 0 = 正下方
					const rod = rodRef.current, line = lineRef.current, whale = whaleRef.current;
					if (rod) {
						// 竿尖钉在鼠标位置，竿身朝**右下**延伸（与系统箭头光标同朝向）；
						// 缩放也挂在同一个 transform 上，所以改尺寸不用重渲染
						rod.setAttribute('transform', 'translate(' + tx.toFixed(2) + ',' + ty.toFixed(2) + ') scale(' + S.toFixed(3) + ')');
					}
					if (line) {
						line.setAttribute('x1', tx.toFixed(2)); line.setAttribute('y1', ty.toFixed(2));
						line.setAttribute('x2', bx.toFixed(2)); line.setAttribute('y2', by.toFixed(2));
					}
					if (whale) {
						// 变换顺序有讲究（v4 修锚点、v5 修挂点、v6 支持多姿态）：
						//   translate(锚点) → rotate(摆角) → scale(S)            ← 整体缩放放外层
						//   → translate(PX,PY) → scale(sx,sy) → translate(-PX,-PY) ← Q 弹绕"内容中心"压缩
						// 本地 (0,0) 是当前姿态量出来的"头顶挂点"（由 <image> 的 x/y 偏移对齐），
						// 所以绳末端严格落在她头顶上。每张姿态图尺寸/挂点不同，这里按当前姿态取。
						const m = META_OF(pose);
						const sy = 1 - squash;
						const sx = 1 + squash * 0.6;
						const cl = Math.max(-58, Math.min(58, deg));
						whale.setAttribute('transform',
							'translate(' + bx.toFixed(2) + ',' + by.toFixed(2) + ')' +
							' rotate(' + cl.toFixed(2) + ')' +
							' scale(' + S.toFixed(4) + ')' +
							' translate(' + m.cx + ',' + m.cy + ')' +
							' scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')' +
							' translate(' + (-m.cx) + ',' + (-m.cy) + ')');
					}
					const wrap = wrapRef.current;
					if (wrap) wrap.style.transform = 'translate3d(' + bx.toFixed(2) + 'px,' + (by - 8 * S).toFixed(2) + 'px,0)';

					// 点击闪色到期
					if (clickUntil && now > clickUntil) { clickUntil = 0; applyColor(now); }
				}

				// ---- 注册 ----
				// 订阅 DSH 会话列表（干活状态一变立刻跟上）；服务不可用就靠上面的
				// 800ms 轮询兜底，两条都失效则退化成"跟着甩动"，绝不报错。
				let unsub = null;
				try {
					const sessions = LIVE_CTX && typeof LIVE_CTX.get === 'function' ? LIVE_CTX.get('sessions') : null;
					const list = sessions && sessions.list;
					if (list && typeof list.subscribe === 'function') {
						unsub = list.subscribe(() => { dshBusy = readDshBusy(); });
					}
				} catch (e) { /* ignore */ }
				const busyTimer = window.setInterval(() => { dshBusy = readDshBusy(); }, 800);

				window.addEventListener('mousemove', onMove, { passive: true });
				window.addEventListener('mousedown', onDown, { passive: true });
				window.addEventListener('blur', onHide);
				window.addEventListener('keydown', onKey);
				document.addEventListener('mouseleave', onHide);
				document.addEventListener('visibilitychange', onVis);
				raf = window.requestAnimationFrame(frame);

				return () => {
					window.cancelAnimationFrame(raf);
					window.clearTimeout(bubbleTimer);
					window.clearInterval(busyTimer);
					try { if (typeof unsub === 'function') unsub(); } catch (e) { /* ignore */ }
					setNativeCursorHidden(false);          // 卸载必须还光标
					window.removeEventListener('mousemove', onMove);
					window.removeEventListener('mousedown', onDown);
					window.removeEventListener('blur', onHide);
					window.removeEventListener('keydown', onKey);
					document.removeEventListener('mouseleave', onHide);
					document.removeEventListener('visibilitychange', onVis);
				};
			}, [cfg.on, cfg.mode]);

			if (!cfg.on) return null;

			return react.createElement('div', { ref: hostRef, className: 'dsh-rod-host' },
				react.createElement('svg', { className: 'dsh-rod-svg' },
					react.createElement('line', { ref: lineRef, className: 'dsh-rod-line' }),
					react.createElement('g', { ref: rodRef, className: 'dsh-rod-g' },
						// 竿尖(0,0) → 竿身朝右下 → 握把更粗更远（朝向与箭头光标一致）
						react.createElement('line', { className: 'dsh-rod-stick', x1: 0, y1: 0, x2: 13, y2: 18 }),
						react.createElement('line', { className: 'dsh-rod-grip', x1: 13, y1: 18, x2: 22, y2: 31 }),
						react.createElement('circle', { className: 'dsh-rod-tip', cx: 0, cy: 0, r: 1.9 })
					),
					react.createElement('g', { ref: whaleRef, className: 'dsh-rod-whale' },
						// 三张姿态图都挂着，靠 display 切；x/y 取各自挂点的负值，
						// 把"她中线处的头顶"那个像素对到本地 (0,0) = 绳末端。
						POSE_KEYS.map((key) => {
							const p = POSES[key];
							const m = p.meta;
							return react.createElement('image', {
								key: key,
								ref: poseRefs[key],
								href: p.src,
								x: -m.ax, y: -m.ay,
								width: m.w, height: m.h,
								preserveAspectRatio: 'xMidYMin meet',
								style: key === 'idle' ? undefined : { display: 'none' },
							});
						})
					)
				),
				react.createElement('div', { ref: wrapRef, className: 'dsh-rod-bubble-wrap' },
					react.createElement('div', { ref: bubbleRef, className: 'dsh-rod-bubble' })
				)
			);
		}

		// ====================================================================
		// 设置页（DSH 设置 → 鱼竿光标）
		// ====================================================================
		function RodSettingsSection() {
			const [, force] = react.useState(0);
			const bump = () => force((n) => n + 1);
			const [quotesText, setQuotesText] = react.useState(MUT.quotes.join('\n'));
			const [screamText, setScreamText] = react.useState(MUT.screamQuotes.join('\n'));
			const [calmText, setCalmText] = react.useState(MUT.calmQuotes.join('\n'));
			const [idleText, setIdleText] = react.useState(MUT.idleQuotes.join('\n'));

			const row = (label, control) => react.createElement('div', { className: 'dsh-rod-row' },
				react.createElement('span', null, label), control);

			const slider = (key, min, max, step) => react.createElement('input', {
				className: 'dsh-rod-input', type: 'range', min: min, max: max, step: step,
				value: MUT[key],
				onChange: (e) => { saveSettings({ [key]: Number(e.target.value) }); bump(); },
			});

			const btn = (label, active, onClick) => react.createElement('button', {
				className: 'dsh-rod-btn',
				style: active ? { background: '#4D94F5', color: '#fff', borderColor: '#4D94F5' } : undefined,
				onClick: onClick,
			}, label);

			return react.createElement('div', null,
				react.createElement('div', { className: 'dsh-rod-note' },
					'🎣 鼠标位置是竿尖，一条弹性绳吊着 Q 版鲸鱼娘（鱼饵）。甩动时她被猛拽、再指数衰减、最后软软跟手；甩猛了会冒泡，甩到失控就「啊啊啊啊啊——」。',
					react.createElement('br'),
					'颜色 = 可交互性提示：悬停输入框变亮青绿 · 悬停按钮变淡金 · 按下闪橙红。',
					react.createElement('br'),
					'（纯装饰层 pointer-events:none，不影响任何点击与选择；窗口失焦会自动还回系统光标）'
				),

				row('启用鱼竿光标', btn(MUT.on ? '已开启' : '已关闭', MUT.on, () => { saveSettings({ on: !MUT.on }); bump(); })),

				row('光标模式',
					react.createElement('div', { style: { display: 'flex', gap: 6 } },
						btn('鱼竿当光标', MUT.mode === 'replace', () => { saveSettings({ mode: 'replace' }); bump(); }),
						btn('真光标+拖挂', MUT.mode === 'attach', () => { saveSettings({ mode: 'attach' }); bump(); })
					)),

				row('整体尺寸 ' + MUT.scale.toFixed(2) + ' 倍', slider('scale', 0.5, 1.2, 0.02)),

				// ---- 姿态包 ----
				row('姿态包（平时/在忙/干完了）', btn(MUT.poseOn ? '已开启' : '已关闭', MUT.poseOn, () => { saveSettings({ poseOn: !MUT.poseOn }); bump(); })),

				row('姿态来源',
					react.createElement('div', { style: { display: 'flex', gap: 6 } },
						btn('跟着 DSH 状态', MUT.poseSource === 'dsh', () => { saveSettings({ poseSource: 'dsh' }); bump(); }),
						btn('跟着甩动', MUT.poseSource === 'swing', () => { saveSettings({ poseSource: 'swing' }); bump(); })
					)),

				row('"干完了"停留 ' + (MUT.doneMs / 1000).toFixed(1) + ' s', slider('doneMs', 800, 8000, 200)),

				row('绳长 ' + Math.round(MUT.lineLen) + ' px', slider('lineLen', 30, 160, 5)),

				row('软跟随刚度 ' + Math.round(MUT.kSoft), slider('kSoft', 20, 160, 2)),

				row('瞬间拉力 ' + Math.round(MUT.kYank), slider('kYank', 0, 800, 10)),

				row('阻尼 ' + MUT.dampRel.toFixed(1) + '（小=甩得飞）', slider('dampRel', 0, 8, 0.1)),

				row('指数衰减 ' + MUT.dampAbs.toFixed(1), slider('dampAbs', 0, 6, 0.1)),

				row('重力 ' + MUT.gravity.toFixed(2) + ' 倍', slider('gravity', 0, 2.5, 0.05)),

				row('甩动灵敏度 ' + Math.round(MUT.accelTrigger / 1000) + 'k', slider('accelTrigger', 5000, 200000, 5000)),

				row('气泡冷却上限 ' + (MUT.cooldownMs / 1000).toFixed(1) + ' s', slider('cooldownMs', 800, 12000, 200)),

				react.createElement('div', { className: 'dsh-rod-note', style: { marginTop: 12 } },
					'气泡语录（一行一条）· 由鼠标瞬时加速度触发，甩得越快冒得越勤'),
				react.createElement('textarea', {
					className: 'dsh-rod-ta',
					value: quotesText,
					onChange: (e) => {
						setQuotesText(e.target.value);
						saveSettings({ quotes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) });
					},
				}),
				react.createElement('div', { className: 'dsh-rod-note' }, '共 ' + MUT.quotes.length + ' 条 · 改完立即生效（不用重启）'),

				react.createElement('div', { className: 'dsh-rod-note', style: { marginTop: 12 } },
					'尖叫语录（加速度超过阈值 ' + SCREAM_MUL + ' 倍时专用 · 字号会随力度长大到跟鲸鱼娘一样大）'),
				react.createElement('textarea', {
					className: 'dsh-rod-ta',
					style: { minHeight: 64 },
					value: screamText,
					onChange: (e) => {
						setScreamText(e.target.value);
						saveSettings({ screamQuotes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) });
					},
				}),

				row('平静台词停留 ' + (MUT.calmMs / 1000).toFixed(1) + ' s', slider('calmMs', 1000, 5000, 100)),

				react.createElement('div', { className: 'dsh-rod-note' },
					'平静台词（被甩完安静下来时补一句：求饶 / 卖萌 / 生气）'),
				react.createElement('textarea', {
					className: 'dsh-rod-ta',
					style: { minHeight: 92 },
					value: calmText,
					onChange: (e) => {
						setCalmText(e.target.value);
						saveSettings({ calmQuotes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) });
					},
				}),

				react.createElement('div', { className: 'dsh-rod-note' },
					'应急：按 Alt+Esc 可在两种光标模式间快速切换（万一找不到鼠标了）'),

				// ---- 闲置小剧场 ----
				react.createElement('div', { className: 'dsh-rod-note', style: { marginTop: 16, fontWeight: 600 } },
					'🎭 闲置小剧场（鼠标停下来自己开演 · 吊鲸鱼 / 钓鱼佬 / 空军）'),
				row('小剧场', btn(MUT.idleOn ? '已开启' : '已关闭', MUT.idleOn, () => { saveSettings({ idleOn: !MUT.idleOn }); bump(); })),
				row('停下多久开演 ' + (MUT.idleStartMs / 1000).toFixed(1) + ' s', slider('idleStartMs', 2000, 60000, 500)),
				row('台词间隔 ' + (MUT.idleGapMs / 1000).toFixed(1) + ' s', slider('idleGapMs', 2500, 60000, 500)),
				react.createElement('textarea', {
					className: 'dsh-rod-ta',
					style: { minHeight: 150 },
					value: idleText,
					onChange: (e) => {
						setIdleText(e.target.value);
						saveSettings({ idleQuotes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) });
					},
				}),
				react.createElement('div', { className: 'dsh-rod-note' },
					'共 ' + MUT.idleQuotes.length + ' 条 · 不会连着重复；说台词时优先让位给尖叫与平静台词')
			);
		}

		// ====================================================================
		// 插件三件套（Cordis Loader 需要）
		// ====================================================================
		const name = 'rod-cursor';
		const inject = ['slots'];

		function apply(ctx) {
			LIVE_CTX = ctx;   // 抓住宿主 ctx：姿态包要读 ctx.get('sessions') 的干活状态

			// 全屏装饰层（不抢焦点、不挡点击）
			ctx.slots.inject('shell.overlay', function* () {
				yield ctx.slots.register({
					name: 'shell.overlay',
					id: 'whale-rod-cursor',
					order: 900,
				}, guarded(RodCursor, '鱼竿光标'));
			});

			// 设置页
			ctx.slots.inject('settings.section', function* () {
				yield ctx.slots.register({
					name: 'settings.section',
					id: 'whale-rod-cursor',
					order: 32,
					label: '鱼竿光标',
				}, guarded(RodSettingsSection, '鱼竿光标设置'));
			});
		}

		exports.name = name;
		exports.inject = inject;
		exports.apply = apply;

		// ⚠️ 必须返回 module.exports —— 模块加载器取的是 factory 的返回值，
		//    只写 exports.xxx 而不 return 的话，加载器拿到 undefined，
		//    插件会被静默判定为"没有导出"，界面上一片安静（真的踩过）。
		return module.exports;
	},
});
