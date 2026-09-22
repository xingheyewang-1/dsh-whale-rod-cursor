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
 * 【v8 的改动（用户 2026-09-15："被甩出去好远却没大气泡尖叫，反而切回窗口有大泡"）】
 *   真凶是触发点放错了地方：
 *     ① 气泡/形变只在 `mousemove` 里、只看**加速度** → 匀速快拖（速度大、加速度≈0）
 *        永远不触发，可她明明被拽着在后面飞；
 *     ② 鼠标停下之后她带着惯性继续滑行 —— 那一段**一个 mousemove 事件都没有**，
 *        所以"被甩飞"最壮观的那半秒压根没有任何检查在跑；
 *     ③ 而切回窗口时坐标突变 + 基准归零 → 算出个假的天大加速度 → 误报尖叫。
 *   修法：
 *     · 把触发搬进**物理循环**（每帧都跑），强度用「她与鼠标的相对速度」relSp ——
 *       这才是"被甩得多猛"的物理真相，匀速拖拽和惯性滑行两段都覆盖；
 *       加速度那条（猛一顿/猛一停）保留，两条谁大用谁。
 *     · 新增设置项「甩飞灵敏度」（默认 1400 px/s）
 *     · 指针重新进窗口（focus / mouseenter）时**只立基准、不算速度加速度** → 不再误报。
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
		// [v15.1] 戳里带上包版本号（0.1.10）：用户报问题时能一眼说出装的是哪版，不用猜。
		try { if (typeof window !== 'undefined') window.__WHALE_ROD_CURSOR_VER__ = '2026-09-22-v15.1-0.1.10'; } catch (e) { /* ignore */ }

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
		// [v13] 气泡冷却下限：它同时决定"破防计数能有多快"（每记一次猛甩必须真冒过泡）。
		// 拉到 600ms 让"认真猛甩"能稳定每 0.6s 记一次 → 8s 窗口内够得着 ④ 的门槛。
		const BUBBLE_COOL_MIN = 600;
		const CALM_SPEED = 150;                    // 相对速度低于它算"平静"(px/s)
		const CALM_QUIET_S = 0.7;                  // 要平静这么久才补台词（秒）
		// [v15.1] 回钩静默期的收尾条件：她归位后还得"持续安静"这么久才放行。
		//   为什么不是"归位即放行"：挂回钩子后绳子还会回弹荡几下，那几下同样超过甩飞阈值，
		//   会立刻把回钩台词顶成甩动台词（用户实测）。1.2s 够回弹衰减到她彻底稳住。
		const RETURN_CALM_NEED_MS = 1200;

		// ====================================================================
		// 设置（localStorage 持久化；MUT 是运行时可变的活对象，动画每帧读它）
		// ====================================================================
		const SETTINGS_KEY = 'dsh-whale-rod-cursor.settings';
		const SETTINGS_EVT = 'dsh-rod-cursor-settings';
		const NONE_CLASS = 'dsh-rod-cursor-none';  // 挂在 <html> 上：隐藏系统光标
		// 台词池版本：每次给默认台词池加新句子就 +1，
		// 这样已经用过插件的人（localStorage 里存着旧池子）也能拿到新台词，
		// 同时保留他自己加/改过的那几条。
		const POOL_VER = 4;
		let upgradedPools = false;

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

		// 甩到失控时才喊的（巨大惯性甩飞专用）—— 尖叫 + 求饶 + 哭唧唧
		// 字号会随力度长到"和她一样大"，所以短句更像尖叫、长句自动缩小以免顶出屏幕
		const SCREAM_QUOTES = [
			// 纯尖叫
			'啊啊啊啊啊——',
			'啊啊啊啊啊——！',
			'呜哇啊啊啊啊——',
			// 求饶系
			'求你了别甩了呜呜呜——',
			'我错了我错了！放我下来——',
			'别甩啦别甩啦，我求饶还不行吗——',
			'钓鱼佬饶命啊——',
			'我招了！我承认我是条鱼——',
			'求求你，放我回海里吧呜呜——',
			// 哭唧唧系
			'呜呜呜我要吐了——',
			'哭给你看！呜呜呜呜——',
			'呜——我的呆毛要飞了——',
			'呜呜……我再也不偷吃 Token 了——',
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
			// [v11] 腹黑向（被甩完"平静"下来，笑着扎心那种）
			'我不生气。我只是把你的名字记在小本本上了',
			'（慢慢整理呆毛）你说，我该不该咬线报复一下',
			'没关系，你继续。我等你空军的时候再笑',
			'我原谅你了——这次。次数我记着呢',
			'下次你卡在难题上，我就静静看着，一句话都不说哦',
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
			// —— [v11] 腹黑嘲讽（用户要求："腹黑嘲讽不够多"）——
			// 基调：不骂人，笑着扎心；拿"空军/白干/手速/穷"开刀，但落点还是关心
			'我数了下，你今天抛竿 47 次，鱼护里 0 条。数据不错，很有参考价值',
			'刚有条小鱼问我"上面那个是谁"，我说：一个很努力的人',
			'你把鼠标甩成这样，是不是以为钓的是鲸鱼？是的话…那你也失败了',
			'别急，慢慢来。反正你也没有别的事要干，对吧',
			'空军不可怕，可怕的是你还没发现自己是空军',
			'我给你个建议：把"钓鱼"改成"遛鼠标"，这样你今天就成功了',
			'（小声）我在给你数着呢。已经空军第几天了？',
			'你这个手速，打游戏能赢，钓鱼是真不行',
			'你知道你和专业钓鱼佬的区别吗？他钓得到鱼',
			'我认真研究了下你的操作：很热闹，很努力，很没用',
			'刚才那一下甩得真好——我说的是甩，不是钓',
			'在你钓上来之前，我打算先当一条看戏的鲸鱼',
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

		// [v10] 破防四档：台词按"破防档位"分流。四档 = 晃晕 / 求饶 / 破防骂人 / 摆烂罢工
		//   · ② 求饶档：2 秒内被猛甩够 N 次（连续甩）——比单次尖叫更"软"
		//   · ③ 破防档：继续甩 / 次数更多——骂人 + 哭腔混编（鲸鱼骂人不带脏字）
		//   · ④ 摆烂档：还不停 → 她扒在光标上罢工、绳子变虚线、装死一段时间不理你
		// 冷却是"每次触发后重新计时"，所以越到后面越难再触发（珍贵感）
		const BREAK2_QUOTES = [
			'别、别甩了…我真的会哭的',
			'我错了我错了，我这就乖乖待着',
			'你手酸不酸…我头先晕了',
			'放我下来好不好，我保证不偷吃 Token',
			'呜……你还甩，你是不是不爱我了',
			'我招，我什么都招，我是条鱼',
		];
		const BREAK3_QUOTES = [
			'你是不是有病啊！！我又不是沙包！！',
			'够了！我罢工了！你自己钓吧！',
			'甩甩甩，你是把鼠标当健身器材是吧！！',
			'我恨你！呜——但我还是不敢咬线，线断了我会掉下去',
			'你再甩一下，我就把你的 Token 金币全吃了！',
			'我堂堂一条鲸鱼，被你甩得像条咸鱼！！',
		];
		// ④ 摆烂：扒在光标上罢工（之后"装死"一段时间不理你）
		const SULK_QUOTES = [
			'不干了！！这活我不接了！你钓吧，我回海里了！',
			'罢工！我是鲸鱼不是鱼饵，谁爱当谁当！',
			'（扒在光标上不走了）今天就这样吧，我下班了',
		];
		// 摆烂结束回来撒娇（甩完安静下来她才肯理你）
		const RECOVER_QUOTES = [
			'……哼，我回来了。下次再甩我就真走了',
			'（尾巴重新缠上绳子）…谁让你是我钓鱼佬呢',
			'算你有良心，还知道叫我回来。摸摸头吧',
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
			cooldownMs: 3500,  // 气泡冷却上限（ms）；甩得越猛实际冷却越短（下限 BUBBLE_COOL_MIN）
			accelTrigger: 45000, // 甩动灵敏度：鼠标瞬时加速度阈值（px/s²）—— 抓"猛一顿/猛一停"
			swingTrigger: 1400, // 甩飞灵敏度：她与鼠标的相对速度阈值（px/s）—— 抓"被拽飞/滑行"
			calmMs: 2600,      // 平静台词停留时长（ms）
			poseOn: true,      // 姿态包开关（关掉就一直用 idle）
			poseSource: 'dsh', // 'dsh' = 跟着 DSH 干活状态 / 'swing' = 跟着甩动
			doneMs: 2500,      // "干完了"姿态停留多久（ms）
			idleOn: true,      // 闲置小剧场开关
			idleStartMs: 6000, // 鼠标停多久开始演小剧场（ms）
			idleGapMs: 7000,   // 小剧场台词之间的间隔（ms）
			// ---- [v10] 破防四档 ----
			// ⚠️ [v11] 门槛语义改了：窗口是**滚动**的（只数"最近 window 毫秒内的猛甩"），
			//    不是"连续不中断"。老写法（间隔超过窗口就清零）在物理上根本凑不到。
			// ⚠️ [v13] 门槛必须按"气泡冷却下限"来标定（用户实测："甩半天才断了一次"）：
			//    每记一次猛甩 ⇒ 必须真冒过一次泡 ⇒ 相邻两次至少隔 BUBBLE_COOL_MIN。
			//    所以窗口内**理论上限 ≈ 窗口 ÷ 冷却下限**。老参数窗口 5s、门槛 6：
			//    上限 5000/700 ≈ 7 次，可实际猛甩很难每 700ms 都成功冒泡（探针实测峰值只有 2~5），
			//    于是"永远差一口气"。现在把窗口放到 8s、门槛降到 2/4/6，并放宽冷却上限，
			//    保证"认真甩 3~6 秒"一定看得到脱钩。
			breakOn: true,        // 破防模式总开关（关掉就退回"只有尖叫/普通语录"）
			breakSulkOn: true,    // ④ 摆烂档：允许她罢工装死
			breakWindowMs: 8000,  // 判定窗口（ms）：只数最近这段时间内的猛甩
			break2At: 2,          // 窗口内猛甩 ≥ 这次数 → ② 求饶档
			break3At: 4,          // → ③ 破防档
			break4At: 6,          // → ④ 脱钩档（且脱钩冷却已过）
			break2CoolMs: 8000,   // ② 求饶档冷却（ms）
			break3CoolMs: 20000,  // ③ 破防档冷却（ms）
			// [v15.1] 默认 5 分钟 → 2 分钟：5 分钟太"等不起"，用户实测体感像"坏了"。
			//   想改回去 / 想更频繁：设置面板里有一排一键预设（30秒/1分/2分/5分/10分）。
			break4CoolMs: 120000, // ④ 摆烂档冷却（ms）
			sulkMs: 15000,        // 摆烂装死时长（ms）：这期间怎么甩都不出声（用户："直接脱钩 10 秒"）
			shakeMs: 1600,        // [v11] 升档后"发抖"持续多久（ms）—— 抖完要停，不能抖到天荒地老
			shakesPerYank: true,  // [v11] 每次猛甩都重新抖（连续甩时保持发抖）
			// ---- [v12] ④ 摆烂改成"真脱钩"（用户实测："虚线+还能拉动，体感不强烈"）----
			sulkDetach: true,     // 真的脱钩：鱼线消失 + 绳子不再施力（她飘走，你拉不动）
			sulkFreeFall: true,   // 脱钩期间她受重力慢慢往下飘（关掉=原地悬停不动）
			sulkHideLine: true,   // 脱钩期间把整条鱼线藏掉（= 钩子空了，最直观）
			sulkDamp: 0.5,        // 脱钩期间的阻尼：小=飘得远、大=飘两下就停
			sulkBob: 9,           // [v14] 沉底后"浮在水里"的上下轻晃幅度（px，0=不晃）
			quotes: DEFAULT_QUOTES.slice(),
			screamQuotes: SCREAM_QUOTES.slice(),
			calmQuotes: CALM_QUOTES.slice(),
			break2Quotes: BREAK2_QUOTES.slice(),
			break3Quotes: BREAK3_QUOTES.slice(),
			sulkQuotes: SULK_QUOTES.slice(),
			recoverQuotes: RECOVER_QUOTES.slice(),
			idleQuotes: IDLE_QUOTES.slice(),
			pv: POOL_VER,      // 台词池版本：升级时把新增台词并进用户已存的池子
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

		/** 把新版本新增的默认台词并进用户已保存的池子（保留用户自己加/改的，不重复） */
		function mergePool(saved, defaults) {
			const out = Array.isArray(saved) ? saved.slice() : [];
			for (const line of defaults) if (out.indexOf(line) < 0) out.push(line);
			return out;
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
					MUT.swingTrigger = clampNum(j.swingTrigger, 300, 6000, MUT.swingTrigger);
					MUT.calmMs = clampNum(j.calmMs, 1000, 5000, MUT.calmMs);
					if (typeof j.poseOn === 'boolean') MUT.poseOn = j.poseOn;
					if (j.poseSource === 'dsh' || j.poseSource === 'swing') MUT.poseSource = j.poseSource;
					MUT.doneMs = clampNum(j.doneMs, 800, 8000, MUT.doneMs);
					if (typeof j.idleOn === 'boolean') MUT.idleOn = j.idleOn;
					MUT.idleStartMs = clampNum(j.idleStartMs, 2000, 60000, MUT.idleStartMs);
					MUT.idleGapMs = clampNum(j.idleGapMs, 2500, 60000, MUT.idleGapMs);
					// ---- [v10] 破防四档 ----
					if (typeof j.breakOn === 'boolean') MUT.breakOn = j.breakOn;
					if (typeof j.breakSulkOn === 'boolean') MUT.breakSulkOn = j.breakSulkOn;
					MUT.breakWindowMs = clampNum(j.breakWindowMs, 500, 10000, MUT.breakWindowMs);
					MUT.break2At = clampNum(j.break2At, 2, 20, MUT.break2At);
					MUT.break3At = clampNum(j.break3At, 2, 30, MUT.break3At);
					MUT.break4At = clampNum(j.break4At, 2, 60, MUT.break4At);
					MUT.break2CoolMs = clampNum(j.break2CoolMs, 1000, 300000, MUT.break2CoolMs);
					MUT.break3CoolMs = clampNum(j.break3CoolMs, 1000, 600000, MUT.break3CoolMs);
					MUT.break4CoolMs = clampNum(j.break4CoolMs, 5000, 3600000, MUT.break4CoolMs);
					MUT.sulkMs = clampNum(j.sulkMs, 1000, 60000, MUT.sulkMs);
					MUT.shakeMs = clampNum(j.shakeMs, 300, 8000, MUT.shakeMs);
					if (typeof j.shakesPerYank === 'boolean') MUT.shakesPerYank = j.shakesPerYank;
					// ---- [v12] 真脱钩 ----
					if (typeof j.sulkDetach === 'boolean') MUT.sulkDetach = j.sulkDetach;
					if (typeof j.sulkFreeFall === 'boolean') MUT.sulkFreeFall = j.sulkFreeFall;
					if (typeof j.sulkHideLine === 'boolean') MUT.sulkHideLine = j.sulkHideLine;
					MUT.sulkDamp = clampNum(j.sulkDamp, 0, 6, MUT.sulkDamp);
					MUT.sulkBob = clampNum(j.sulkBob, 0, 40, MUT.sulkBob);
					// 档位门槛必须是"越来越大"，否则 ③/④ 永远轮不到 → 自动理顺
					if (MUT.break3At <= MUT.break2At) MUT.break3At = MUT.break2At + 1;
					if (MUT.break4At <= MUT.break3At) MUT.break4At = MUT.break3At + 1;
					MUT.quotes = cleanList(j.quotes, MUT.quotes);
					MUT.screamQuotes = cleanList(j.screamQuotes, MUT.screamQuotes);
					MUT.calmQuotes = cleanList(j.calmQuotes, MUT.calmQuotes);
					MUT.idleQuotes = cleanList(j.idleQuotes, MUT.idleQuotes);
					MUT.break2Quotes = cleanList(j.break2Quotes, MUT.break2Quotes);
					MUT.break3Quotes = cleanList(j.break3Quotes, MUT.break3Quotes);
					MUT.sulkQuotes = cleanList(j.sulkQuotes, MUT.sulkQuotes);
					MUT.recoverQuotes = cleanList(j.recoverQuotes, MUT.recoverQuotes);
					// 台词池升级：老版本存的池子会把新台词盖掉 → 按版本号把新增的并进去
					if ((Number(j.pv) || 0) < POOL_VER) {
						MUT.screamQuotes = mergePool(MUT.screamQuotes, SCREAM_QUOTES);
						MUT.calmQuotes = mergePool(MUT.calmQuotes, CALM_QUOTES);
						MUT.idleQuotes = mergePool(MUT.idleQuotes, IDLE_QUOTES);
						MUT.break2Quotes = mergePool(MUT.break2Quotes, BREAK2_QUOTES);
						MUT.break3Quotes = mergePool(MUT.break3Quotes, BREAK3_QUOTES);
						MUT.sulkQuotes = mergePool(MUT.sulkQuotes, SULK_QUOTES);
						MUT.recoverQuotes = mergePool(MUT.recoverQuotes, RECOVER_QUOTES);
						MUT.quotes = mergePool(MUT.quotes, DEFAULT_QUOTES);
						MUT.pv = POOL_VER;
						upgradedPools = true;
					}
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
		// 池子升级过 → 顺手落盘一次（否则下次启动还会重复合并）
		if (upgradedPools) {
			try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(MUT)); } catch (e) { /* ignore */ }
		}

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
  opacity: .8; transition: stroke .18s ease, opacity .25s ease;
}
/* [v10] 破防④摆烂：绳子"松了"（虚线 + 蚂蚁线流动）—— 一眼看出她罢工了 */
.dsh-rod-line-slack { stroke-dasharray: 3 5; opacity: .55; animation: dsh-rod-slack 1.1s linear infinite; }
@keyframes dsh-rod-slack { to { stroke-dashoffset: -16; } }
@media (prefers-reduced-motion: reduce) { .dsh-rod-line-slack { animation: none; } }
/* [v12] 真脱钩：整条鱼线淡出（钩子空了）；竿尖留一小截断线头在晃 */
.dsh-rod-line-gone { opacity: 0 !important; }
.dsh-rod-stub { opacity: .9; stroke-dasharray: 2 4; }
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
		// [v9] 顶层容器 —— 修「弹窗一开，鱼竿就看不见了」
		//
		// 根因（2026-09-18 查源码确认，别再踩）：
		//   官方的 Modal（会话重命名、目录选择、各种确认框…）是 React
		//   createPortal 到 **document.body** 的，容器 CSS = position:fixed; z-index:1000。
		//   而我们的宿主是挂在 shell.overlay 槽位里 → 那个槽位是 AppFrame 内部的
		//   `div.overlayLayer{position:absolute;z-index:20}`，深处 #root 的祖先链里。
		//   "fixed + z-index:2147483000" 数值上碾压 1000，可**祖先链会毁掉它**：
		//   祖先里只要有 overflow:hidden / transform / filter / backdrop-filter / contain，
		//   我们的"fixed"就改成相对那个祖先盒子定位，层级也被锁在祖先那一层 → 被盖住。
		//   叠加效应最惨的是 replace 模式：系统光标已被 cursor:none 藏掉，鱼竿又在弹窗底下
		//   → 眼前一根箭头都没有，只能盲操。
		//
		// 修法：把宿主节点"搬"进一个挂在 document.body 下的顶层容器（z-index 顶天）。
		//   这样它跟弹窗站在**同一个层叠根**（body 的），且比弹窗更靠后 → 永远在上面。
		//   所有弹窗一次修好，以后新加的弹窗（官方或别的插件）也自动罩住。
		//
		// 注意（v9 的第二个坑）：搬进 body 后，元素**全屏**（fullscreenchange）会进入
		//   浏览器的"顶层"，那一层**天然压倒一切 z-index** —— 全屏的视频照样能盖住我们。
		//   所以检测到"别人的全屏元素"时，把它的 z-index 压低，保住光标语义。
		//   全屏元素是我们自己（极少见）或读不到时，什么也不做。
		// ====================================================================
		const LIFT_ID = 'dsh-rod-cursor-top';
		const Z_MAX = 2147483000;          // 比 fullscreen 的 2147483647 低一档
		const Z_HOLD = 2147482999;         // 压低"别人的全屏元素"用
		const WATCH_ATTR = 'data-dsh-rod-zfix';
		const canDoc = () => (typeof document !== 'undefined' && document && typeof document.createElement === 'function');
		const inTopLayer = (el) => {
			try {
				return !!(el && typeof el.matches === 'function' && el.matches(':fullscreen, :-webkit-full-screen'));
			} catch (e) { return false; }
		};

		/**
		 * 按需创建（幂等）挂在 document.body 下的顶层容器。
		 * 找不到 document 时返回 null —— 此时调用方原地不动，一切照旧。
		 */
		function ensureLiftHost() {
			if (!canDoc()) return null;
			try {
				let host = document.getElementById(LIFT_ID);
				if (!host) {
					host = document.createElement('div');
					host.id = LIFT_ID;
					// 自身绝不参与层叠（z-index:auto），层级全部由里面那层 dsh-rod-host 决定；
					// 免得以后有人给这个容器设了 z-index，把我们又关进一个新的层叠上下文里。
					host.style.cssText = 'position:static;z-index:auto;pointer-events:none;';
					host.setAttribute('data-dsh-rod-top', '1');
				}
				const body = document.body;
				if (body && typeof body.appendChild === 'function') {
					// 已经挂好了就别重复 append（containing 关系优先，其次看 parentNode）
					const inside = (typeof body.contains === 'function') ? body.contains(host) : (host.parentNode === body);
					if (!inside) body.appendChild(host);
				}
				return host;
			} catch (e) { return null; }
		}

		/** 把宿主节点搬进顶层容器（已经在里面就什么都不做）。 */
		function liftHost(node) {
			try {
				if (!node || typeof node !== 'object') return false;
				const host = ensureLiftHost();
				if (!host || typeof host.appendChild !== 'function') return false;
				if (node.parentNode === host) return false;       // 幂等：已在顶层
				host.appendChild(node);
				syncFullscreenZ();
				return true;
			} catch (e) { return false; }                        // 搬不动就原地待着，功能不受影响
		}

		/** 上层容器现在有几个子节点（含我们自己的宿主）。读不到 = 0。 */
		function liftCount() {
			try {
				const el = canDoc() ? document.getElementById(LIFT_ID) : null;
				return (el && el.children && typeof el.children.length === 'number') ? el.children.length : 0;
			} catch (e) { return 0; }
		}

		/**
		 * 全屏兜底[2]：**趁着还没全屏**先把 z-index 压好。
		 *
		 * 为什么不能等 fullscreenchange：元素一进浏览器"顶层"，那一层天然压倒一切
		 * z-index（连 max z-index 都没用），事件回调里再改已经晚了一帧 → 用户会看到
		 * 全屏那一帧鱼竿被盖住。所以先手压在 body 的直接子元素上，
		 * 等它真进顶层时，z-index 早就在它身上了。
		 *   · 我们自己（鱼竿层 / 顶层容器）绝不碰
		 *   · 已经有 data-dsh-rod-zfix 标记的不重复设（避免每帧写 style）
		 *   · 不能每帧都调 —— 调用方用"容器有子节点 + 至少 N 帧"节流
		 */
		function prePatchTopCandidates() {
			try {
				if (!canDoc() || typeof document.querySelectorAll !== 'function') return 0;
				const list = document.querySelectorAll('body > *:not([data-dsh-rod-top]):not(#dsh-rod-cursor-top):not(.dsh-rod-host)');
				let n = 0;
				for (let i = 0; i < list.length; i++) {
					const el = list[i];
					if (!el || typeof el.setAttribute !== 'function') continue;
					if (el.getAttribute(WATCH_ATTR) === '1') continue;
					el.setAttribute(WATCH_ATTR, '1');
					if (el.style && typeof el.style.setProperty === 'function') {
						el.style.setProperty('z-index', String(Z_HOLD), 'important');
					}
					n++;
				}
				return n;
			} catch (e) { return 0; }
		}

		/**
		 * 全屏兜底[1]：真进了顶层之后，再确认一次（比如别人用别的手段进的）。
		 * 只处理**挂在 body 上的直接子元素**（浏览器的全屏元素总是这种），
		 * 读不到 / 是自己 → 直接返回，绝不误伤。
		 */
		function syncFullscreenZ() {
			try {
				if (!canDoc() || typeof document.querySelectorAll !== 'function') return 0;
				const list = document.querySelectorAll('body > *');
				let n = 0;
				for (let i = 0; i < list.length; i++) {
					const el = list[i];
					if (!el || el.id === LIFT_ID) continue;
					if (!inTopLayer(el)) continue;
					if (el.getAttribute && el.getAttribute(WATCH_ATTR) === '1') continue;
					el.setAttribute && el.setAttribute(WATCH_ATTR, '1');
					if (el.style && el.style.setProperty) el.style.setProperty('z-index', String(Z_HOLD), 'important');
					n++;
				}
				return n;
			} catch (e) { return 0; }
		}

		// 自动化测试用的窄接口（只暴露"搬运/全屏"这几个纯函数，不含任何状态）。
		// 自检脚本靠它验证幂等与卸载清理 —— 真实运行时不依赖它。
		try {
			if (typeof window !== 'undefined') {
				window.__WHALE_ROD_TEST__ = {
					liftHost: liftHost, ensureLiftHost: ensureLiftHost,
					liftCount: liftCount, syncFullscreenZ: syncFullscreenZ,
					prePatchTopCandidates: prePatchTopCandidates,
					saveSettings: saveSettings,   // 自检要能临时改设置（比如"关掉破防"）
					// [v13] 自检要能问"这句台词属于哪个池子"（活池子 = 用户存档 + 已合并的默认台词）
					pools() {
						return {
							quotes: MUT.quotes, screamQuotes: MUT.screamQuotes, calmQuotes: MUT.calmQuotes,
							idleQuotes: MUT.idleQuotes, break2Quotes: MUT.break2Quotes, break3Quotes: MUT.break3Quotes,
							sulkQuotes: MUT.sulkQuotes, recoverQuotes: MUT.recoverQuotes,
						};
					},
					LIFT_ID: LIFT_ID, Z_HOLD: Z_HOLD,
				};
			}
		} catch (e) { /* ignore */ }

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
			const stubRef = react.useRef(null);   // [v12] 断线头（脱钩时显示）
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
				// ---- [v10] 破防四档的运行时状态 ----
				let bkCount = 0;                           // 判定窗口内的"猛甩次数"（滚动计数）
				let bkTimes = [];                          // 每次猛甩的时刻（滚动窗口用）
				let bkLastYankAt = -1e9;                   // 上一次猛甩时刻
				let bkTier = 0;                            // 当前档位 0/2/3/4（1 档 = 普通尖叫，不占变量）
				let bk2At = -1e9, bk3At = -1e9, bk4At = -1e9;   // 各档"上次触发"时刻（算冷却）
				let bkSulkUntil = 0;                       // 摆烂装死到什么时候（0 = 没在摆烂）
				// [v15.1] 回钩静默期：exitSulk() 之后，甩飞气泡一律不冒，**直到她真正归位**。
				//   修的问题（用户实测）：她装死完往回飘、重新挂回钩子时，**回钩位移**
				//   照样会钻进 relSp（她与鼠标的相对速度），于是判成"被甩飞"→ 蹦出甩动台词，
				//   把 exitSulk() 本该说的「我回来啦」类回钩台词抢掉了（串台）。
				//   ⚠️ 第一版用"固定 1200ms"，用户实测**还是不够**：她脱钩时飘出去多远是随机的，
				//      回程时长也就随距离变；固定时间必然在"还没归位"时就到期 → 晃动又被判成甩动。
				//      所以改成**状态驱动**：物理循环里一旦判定她"回到挂点附近且已静止"，
				//      立刻解除静默；bkReturnQuietMax 只是兜底（防止她一直没归位导致永久静默）。
				let bkReturnQuietUntil = 0;                // 最短静默截止（她说话的那一下）
				let bkReturnQuietMax = 0;                  // 最长静默截止（兜底，最多 6s）
				// [v15.1] 归位后还要"安静够久"才真正放行：
				//   她挂回钩子后绳子**还会回弹荡几下**，那几下同样是"甩动"→ 会立刻把
				//   回钩台词顶掉（用户实测："归位就放行的话，回弹就把气泡替换了"）。
				//   所以判定标准不是"归位"，而是"归位 + 持续安静 bkReturnCalmNeedMs"。
				let bkReturnCalmFrom = 0;                  // 从什么时候开始持续安静（0 = 还没开始）
				let bkShakeUntil = 0;                      // [v11] 发抖到什么时候（不是"档位≥③就永远抖"）
				let bkSulkOn = false;                      // 虚线绳标记是否已切过（省写 DOM）
				let bkLineHidden = false;                  // [v12] 脱钩时线已藏？（省写 DOM）
				let bkStubOn = false;                      // [v12] 断线头已显示？（省写 DOM）
				let bkShakeT = 0;                          // [v10] 破防发抖的相位计数
				let bkBobT = 0;                            // [v14] 脱钩"浮沉"相位
				let bkBobSet = false;                      // [v14] 本帧是否要加浮沉
				// [v15] DOM 写入去重（"性能优先"）：值没变就别 setAttribute/style，
				//       每次写入都会让浏览器重算样式；静息时这些写入纯属白烧。
				let lastRodTf = '', lastLineA = '', lastLineB = '', lastWhaleTf = '', lastWrapTf = '';
				let renderedOnce = false;                  // [v15] 至少完整渲染过一帧（快车道的前置条件）
				let lastPoseBusy = null;                   // [v15] 上一帧看到的 dshBusy（变化时才放帧）
				let bxDraw = 0, byDraw = 0;                // [v10] 渲染用位置（= 物理位置 + 发抖偏移）
				let raf = 0;
				let frameNo = 0;                            // [v9] 帧计数（全屏兜底的节流用）
				let originalParent = null;                  // [v9] 宿主的原位置（卸载时还回去）
				let last = performance.now();
				let paused = false;
				// 鼠标瞬时加速度（在 mousemove 监听里算，见 onMove）
				let hasPrev = false, lastMoveAt = 0, pmx = 0, pmy = 0, spEMA = 0, accEMA = 0;
				// [v8] 指针刚进窗口（或刚挂载）→ 下一次 mousemove 直接吸附，不做物理追及
				let needSnap = true;

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

				/**
				 * 冒泡。intensity = 瞬时加速度 / 阈值：越大冒得越快、字越大、够大就尖叫。
				 *
				 * [v13] 顺序改了：**先让破防机记这一次猛甩**（它会决定档位、甚至在 ④ 档直接
				 * 脱钩说话），回来告诉我"这一下要不要说普通/尖叫台词"。
				 * 老顺序是"先冒泡再记"，于是"这一鞭刚好触发了脱钩"时，会先蹦一句
				 * 「快放我下来！」再蹦罢工宣言 —— 用户看到的就是"断线了台词还串台"。
				 */
				function popBubble(intensity) {
					const now = performance.now();
					if (now - lastBubble < bubbleCool) return;
					// [v15.1] 回钩静默期：她正往回飘、以及挂回去之后的**回弹**阶段，一律闭嘴。
					//   ⚠️ 判定不是"归位就放行" —— 挂回钩子后绳子还会荡几下，那几下也够触发甩动台词，
					//      回钩台词照样被顶掉（用户实测）。所以要求：**归位 + 持续安静够久**。
					if (now < bkReturnQuietMax) {
						const _rdx = bx - tx, _rdy = by - ty;
						const _rd = Math.sqrt(_rdx * _rdx + _rdy * _rdy);
						const _restL2 = clampNum(MUT.lineLen, 30, 160, 70);
						const _backAtRest = _rd <= _restL2 * 1.15 && relSp < CALM_SPEED;
						if (_backAtRest) {
							if (bkReturnCalmFrom === 0) bkReturnCalmFrom = now;      // 开始计"安静"
							if (now - bkReturnCalmFrom >= RETURN_CALM_NEED_MS) {     // 安静够久 → 放行
								bkReturnQuietMax = 0; bkReturnCalmFrom = 0;
							}
						} else {
							bkReturnCalmFrom = 0;                                    // 又被晃起来了 → 重新计
						}
						if (bkReturnQuietMax !== 0) return;                          // 还没到时 → 不冒泡
					}
					const scream = intensity >= SCREAM_MUL;
					const pool = scream ? MUT.screamQuotes : MUT.quotes;
					if (!pool || !pool.length) return;
					// 甩得越快 → 冷却越短（下限见 BUBBLE_COOL_MIN，避免刷屏）
					bubbleCool = Math.max(BUBBLE_COOL_MIN, MUT.cooldownMs / Math.max(1, intensity));
					lastBubble = now;
					agitated = true;             // 记下"刚被甩过"，平静后要补一句台词
					calmT = 0;
					// 先登记 → 若这一下把她气到"脱钩"，她会自己开口，我们就不抢话
					const sayGeneric = recordYank();
					if (sayGeneric === false) return;
					say(pool[(Math.random() * pool.length) | 0], bubbleSizePx(intensity), scream ? 1600 : 1800);
				}

				// ============================================================
				// [v10] 破防四档状态机
				//   ① 晃晕（原有行为）：单次甩飞 → 尖叫池随机，字号随力度
				//   ② 求饶：判定窗口内猛甩够 break2At 次 → 求饶池（比尖叫 "软"）
				//   ③ 破防：够 break3At 次 → 骂人+哭腔混编；她开始发抖、气泡连发
				//   ④ 摆烂：够 break4At 次 且 摆烂冷却已过 → 罢工装死 sulkMs
				// 冷却是"每次触发后重新计时"：越往后越难再触发，才显得珍贵。
				// 摆烂期间完全闭嘴（怎么甩都不出声），冷却从**进入摆烂**那一刻起算。
				// ============================================================
				/** 挑一句（尽量不跟刚说过的那句连着重复） */
				function pickLine(pool, recent) {
					if (!pool || !pool.length) return null;
					let idx = 0;
					for (let tries = 0; tries < 8; tries++) {
						idx = (Math.random() * pool.length) | 0;
						if (!recent || recent.indexOf(idx) < 0) break;
					}
					if (recent) { recent.push(idx); if (recent.length > Math.max(1, Math.min(4, pool.length - 1))) recent.shift(); }
					return pool[idx];
				}

				const bkRecent = [];          // 破防台词最近说过的下标
				const sulkRecent = [];
				const recoverRecent = [];

				/** 她此刻是不是在摆烂装死（这期间一律不吭声） */
				function isSulking(nowMs) { return bkSulkUntil > 0 && nowMs < bkSulkUntil; }

				/** 进入摆烂：扒在光标上罢工、绳子变虚线、闭嘴一段时间 */
				function enterSulk(nowMs) {
					bkSulkUntil = nowMs + MUT.sulkMs;
					bkTier = 4;
					bk4At = nowMs;                       // ④ 的冷却是"每次摆烂后重新计时" → 从此刻起算
					bkTimes.length = 0;                  // 想要下一次摆烂，得重新甩够次数
					bkCount = 0;
					bkShakeUntil = nowMs + MUT.sulkMs;   // 装死期间一直微抖（幅度很小）
					agitated = false;                    // 别在恢复时又补一句平静台词
					calmT = 0;
					const line = pickLine(MUT.sulkQuotes, sulkRecent);
					if (line) say(line, BUBBLE_BASE_PX * 1.15, Math.min(4000, MUT.sulkMs));
				}

				/** 装死结束：她回来了（软软一句），档位清零 */
				function exitSulk() {
					bkSulkUntil = 0;
					bkTier = 0;
					bkCount = 0;
					bkTimes.length = 0;
					bkShakeUntil = 0;                    // [v11] 抖也一起停
					// ⚠️ [v12] 这里**不要**去动 bkLineHidden / bkStubOn：
					//    它们记的是"DOM 现在是什么样"。渲染层靠"目标值 ≠ 记的值"来决定要不
					//    要改 DOM（省写入）。这里要是把它们重置成"已恢复"的样子，
					//    渲染层就以为 DOM 早就恢复好了 → 线永远藏着（自检抓到的真 bug）。
					const line = pickLine(MUT.recoverQuotes, recoverRecent);
					if (line) say(line, BUBBLE_BASE_PX, MUT.calmMs);
					// [v15.1] 回钩静默期：她正往回飘、以及挂回去后的**回弹**阶段，甩飞判定一律闭嘴。
					//   「她与鼠标的相对速度」分不清"被甩飞"和"被绳子拉回来/回弹"，
					//   于是这两段都会蹦甩动台词、把上面这句回钩台词抢掉（用户实测的串台）。
					//   这里给两个上限：
					//     bkReturnQuietUntil = 最短（保证她那句话能说完，不被抢）
					//     bkReturnQuietMax   = 兜底（万一她一直没归位/没静下来，最多静默这么久）
					//   两者之间由物理循环按"归位 + 持续安静 RETURN_CALM_NEED_MS"提前解除。
					bkReturnQuietUntil = performance.now() + 1500;
					bkReturnQuietMax = performance.now() + 6000;
					bkReturnCalmFrom = 0;
				}

				/**
				 * 记一次"猛甩"，并决定要不要升档。
				 *
				 * [v11 修正] 计数 = **滚动窗口**内最近的猛甩次数（只数最近 window 毫秒里的），
				 * 不再是"连续不中断"。老写法物理上凑不到，详见 MUT 里的注释。
				 *   ① 晃晕：默认档（外面已经放完普通尖叫/语录，这里不用做事）
				 *   ② 求饶：窗口内 ≥ break2At
				 *   ③ 破防：窗口内 ≥ break3At（顺带让她抖 shakeMs 那么久）
				 *   ④ 摆烂：窗口内 ≥ break4At 且开了摆烂开关
				 * 冷却**只挡"这一档"**：被挡住就不说这档的台词（退回普通尖叫），
				 * 别的档照常。只有"真的说了"才更新该档的冷却 → 语义简单不会绕晕。
				 *
				 * 只在真的冒泡时调用（= 物理循环已认定这是一次猛甩），所以不会误触。
				 *
				 * @returns {boolean} 调用方要不要接着说"普通/尖叫"那句台词。
				 *   - false：这一下已经说过话了（档位台词 / 直接脱钩），**别再抢话**
				 *   - true ：这一下没触发任何档位 → 交给调用方冒普通/尖叫台词
				 */
				function recordYank() {
					if (!MUT.breakOn) return true;
					const now = performance.now();
					if (isSulking(now)) return false;                          // 摆烂中：安静装死，不升不降
					// 滚动计数：把窗口外的旧记录挤出去，再记这一笔
					while (bkTimes.length && now - bkTimes[0] > MUT.breakWindowMs) bkTimes.shift();
					bkTimes.push(now);
					if (bkTimes.length > 64) bkTimes.shift();                  // 上限保护（乱改窗口也不至于爆）
					bkLastYankAt = now;
					bkCount = bkTimes.length;
					// 每来一次猛甩就"续一下发抖"（连续甩期间她一直在抖，停手后抖够 shakeMs 就停）
					if (bkCount >= 2 && MUT.shakesPerYank) bkShakeUntil = now + MUT.shakeMs;

					// ④ 摆烂（最高优先）
					if (MUT.breakSulkOn && bkCount >= MUT.break4At) {
						if (now - bk4At >= MUT.break4CoolMs) { enterSulk(now); return false; }
						// [v13] 冷却中：**不再说 ③ 的骂人台词**，直接让它退回普通/尖叫。
						// 用户实测："断线前还蹦一句没断线的台词，看着像串台"——这一鞭既然已经
						// 到了 ④ 的门槛，就别再往 ③ 的池子里抓句子了（否则一鞭两句话、还先软后硬）。
						return true;
					}
					// ③ 破防
					if (bkCount >= MUT.break3At && now - bk3At >= MUT.break3CoolMs) {
						bk3At = now;
						bkTier = 3;
						bkShakeUntil = now + MUT.shakeMs;                      // [v11] 抖一阵子，抖完就停
						const line = pickLine(MUT.break3Quotes, bkRecent);
						if (line) say(line, BUBBLE_BASE_PX * 1.9, 2200);
						// "连发两条"：过一会儿补一句哭腔嘟囔（复用 bubbleTimer，卸载时会被清掉）
						window.setTimeout(() => {
							try {
								const t = performance.now();
								if (isSulking(t)) return;        // 已经摆烂了就别插嘴
								if (t - lastSay < 900) return;   // 刚说完别的就算了
								const second = pickLine(MUT.calmQuotes, null);
								if (second) say(second, BUBBLE_BASE_PX, 1600);
							} catch (e) { /* ignore */ }
						}, 2300);
						return false;
					}
					// ② 求饶
					if (bkCount >= MUT.break2At && now - bk2At >= MUT.break2CoolMs) {
						bk2At = now;
						if (bkTier < 2) bkTier = 2;
						const line = pickLine(MUT.break2Quotes, bkRecent);
						if (line) say(line, BUBBLE_BASE_PX * 1.5, 2000);
						return false;
					}
					// ① 晃晕：交给调用方冒普通/尖叫台词
					return true;
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
				/**
				 * [v8] 指针重新进入窗口（focus / mouseenter）时只"立基准"，不算速度也不算加速度。
				 * 否则切回窗口时坐标突变会被当成一次天大的加速度 → 误报尖叫气泡
				 * （用户实测："被甩飞没泡，切回窗口反而蹦大泡"）。
				 */
				function onEnter() { hasPrev = false; spEMA = 0; accEMA = 0; needSnap = true; }

				function onMove(e) {
					mx = e.clientX; my = e.clientY;
					lastMoveAtMs = performance.now();      // 记下"还在动"，闲置小剧场要等它停
					show();

					// [v8] 指针是"瞬移"进窗口的（出去时她在隐藏状态，所以看不见这一下）：
					// 直接把她吸附到新锚点上，既不会被假猛拽甩飞，也不会冒出一声莫名其妙的尖叫。
					// [v12] 但她"脱钩罢工"时例外：她本来就该赖在原地飘，鼠标动了也不许把她拽回来
					//       （否则形态上就又成了"拉着她跑"，正是用户说"体感不强烈"的那种）。
					if (needSnap) {
						needSnap = false;
						tx = mx; ty = my;
						if (!isSulking(performance.now())) {
							bx = mx; by = my + MUT.lineLen;
							vx = 0; vy = 0;
						}
						mvx = 0; mvy = 0;
						lastMx = mx; lastMy = my;
						hasPrev = false; spEMA = 0; accEMA = 0;
						calmT = 0;
					}

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
				// [v9] 全屏变化：① 确保我们仍在顶层容器里（别被谁搬走了）
				//      ② 把"别人的全屏元素"压到我们下面，保住光标语义
				function onFullscreen() {
					try {
						const top = ensureLiftHost();
						if (top && host.parentNode !== top) liftHost(host);
					} catch (e) { /* ignore */ }
					syncFullscreenZ();
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
				/**
				 * [v15] 静息快车道（"性能优先"）：鼠标没动、她也彻底静下来、没在演出时，
				 * **跳过这一帧的全部计算与 DOM 写入**（见 frame 里的调用点注释）。
				 * 判据全部是"廉价读"，本身不产生任何分配。
				 */
				function idleFrame(mxNow, myNow, now) {
					if (!visible || !renderedOnce) return false;             // 还没显示 / 还一次都没画过
					if (mxNow !== lastMx || myNow !== lastMy) return false;  // 鼠标在动 → 干活
					if (MUT.mode === 'replace') { if (tx !== mxNow || ty !== myNow) return false; }
					if (deformAmp > 0) return false;                         // Q 弹还在播
					if (Math.abs(vx) > 0.8 || Math.abs(vy) > 0.8) return false;   // 她还在动
					if (bkSulkUntil > 0 || now < bkShakeUntil) return false;      // 演出/发抖中
					// ⚠️ 这些"待办"必须让帧跑起来，否则会被跳帧吞掉：
					if (MUT.poseSource === 'swing') return false;            // 姿态跟着甩动 → 每帧都要判
					if (dshBusy !== lastPoseBusy) return false;              // DSH 状态刚变 → 该换姿态了
					if (pose !== 'idle' || doneUntil > now) return false;    // 不在 idle / done 停留期
					// 兜底心跳：就算上面全都"看起来没事"，也每 ~0.5 秒放一帧过去，
					// 免得某个我没想到的状态变化被永久跳过（安全 > 省那几帧）。
					if (frameNo % 30 !== 0) return true;
					return false;
				}

				function frame(now) {
					raf = window.requestAnimationFrame(frame);
					if (paused) { last = now; return; }
					let dt = (now - last) / 1000;
					last = now;
					// 单帧上限：防止后台标签恢复后一次积太大而"穿模"（上游同值 0.034）
					if (dt > MAX_DT) dt = MAX_DT;
					if (dt <= 0) return;

					// ---- [v15] 静息快车道（"性能优先"）----
					// 鼠标没动 + 她彻底静下来 + 没在演出 → **整帧跳过计算与 DOM 写入**。
					// 为什么值得：本插件挂在整个 DSH 界面上，每帧 4~5 次 setAttribute +
					// 1~2 次 classList/style 写入 —— 数值没变，浏览器也要重算样式；鼠标在动时
					// 这些是本职开销，但她**静止发呆**时纯属白烧。开了快车道，静息期开销 ≈ 0。
					// 安全性：动画帧在最上面已经续好，任何输入下一帧立刻恢复重算。
					if (idleFrame(mx, my, now)) { frameNo++; return; }

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

					// [v13] 摆烂/脱钩状态先算出来 —— 鼠标速度那段也要用它
					const sulking = isSulking(now);
					const detached = sulking && MUT.sulkDetach;

					// 鼠标速度（EMA）→ 用于相对阻尼
					// [v14] 但她"脱钩宕机"时不能让鼠标速度渗进物理里：rvy 里的 -mvy 会实打实地
					//       推她上下左右动（用户实测："会稍微控制它宕机时期的左右"）。
					//       脱钩期间把鼠标速度当 0，她才是真的"谁都不理"。
					if (detached) { mvx = 0; mvy = 0; }
					else {
						mvx += ((mx - lastMx) / dt - mvx) * MOUSE_V_ALPHA;
						mvy += ((my - lastMy) / dt - mvy) * MOUSE_V_ALPHA;
					}
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
					const kEff = detached ? 0
						: (MUT.kSoft + MUT.kYank * Math.min(1, relSp / YANK_REF)) * (sulking ? 0.12 : 1);
					// 阻尼系数是**常数**（v4 换回低阻尼）：甩起来会被拽得飞出去、
					// 甩完还会自己荡几下 —— 想要"乖乖滑回来"就把阻尼调大。
					// [v10] 摆烂装死：阻尼再加重一点，她像被挂在钩上认命的咸鱼。
					// [v12] 真脱钩时改用 sulkDamp（默认 0.5，飘得动但不会飞走）。
					const cDamp = detached ? MUT.sulkDamp : (MUT.dampRel + (sulking ? 2.2 : 0));
					const ax = -kEff * stretch * (dx / d) - cDamp * rvx;
					// 脱钩 + 关了"自由落体" → 悬停不动（只留一丁点阻尼，也不受重力）
					const gNow = (detached && !MUT.sulkFreeFall) ? 0 : GRAVITY_BASE * MUT.gravity;
					const ay = -kEff * stretch * (dy / d) - cDamp * rvy + gNow;
					// 绝对指数阻尼（学上游 friction 的写法：v *= e^(-λ·dt)）
					const decay = Math.exp(-(detached ? 0 : (MUT.dampAbs + (sulking ? 2.5 : 0))) * dt);
					vx *= decay; vy *= decay;
					// 半隐式欧拉：先速度后位置（比显式欧拉稳定得多）
					vx += ax * dt; vy += ay * dt;
					bx += vx * dt; by += vy * dt;
					// [v12] 安全网：脱钩期间她往外飘也别飘出可视区（否则"找不回来"）
					// [v14] 但边界要按**整身**算：老写法只让"头顶"贴到屏幕下沿就接住，
					//       所以用户看到的是"只露三分之一脑袋"。现在改成——
					//       她**头下方的身体**（内容高度）也必须留在屏内，整个身子都看得见。
					if (detached) {
						const pad = 24;
						const mDet = META_OF(pose);
						const bodyH = Math.max(24, (mDet.ch || 170) * S);     // 缩放后的实际身高
						const maxX = Math.max(pad, window.innerWidth - pad);
						// by 是"头顶挂点"，所以她占的空间是 [by, by + bodyH]；
						// 还要留出"浮沉晃动的下半幅 + 一点磕底余量"，否则晃到最低点会再探出去半个身子。
						const ampReserve = Math.max(0, Math.min(MUT.sulkBob, bodyH * 0.12));
						const maxY = Math.max(pad, window.innerHeight - bodyH - ampReserve - 10);
						if (bx < pad) { bx = pad; vx = 0; }
						if (bx > maxX) { bx = maxX; vx = 0; }
						if (by < pad) { by = pad; vy = 0; }
						if (by > maxY) { by = maxY; vy = 0; }
						// [v14] 沉到底后别像块石头：给一点"水里浮着"的上下轻晃
						//       （相位在这里推进，实际位移在渲染段叠加到 bxDraw/byDraw 上）
						bkBobT += dt;
						bkBobSet = true;
					} else {
						bkBobSet = false;
					}

					// ---- 姿态包：按 DSH 干活状态 / 甩动强度切换 ----
					updatePose(now, relSp);

					// ------------------------------------------------------------
					// [v8] 甩飞触发（修的就是"被甩出去好远却没气泡"）
					//   用「她与鼠标的相对速度」当强度 —— 这才是"被甩得多猛"的物理真相：
					//     · 匀速快拖：鼠标速度大、加速度≈0 → 老逻辑永远不触发，但她在后面被拽着飞
					//     · 鼠标停下之后：她带着惯性继续滑行（relSp ≈ 她自己的速度）
					//       —— 那一段**根本没有 mousemove 事件**，所以老逻辑完全没有机会跑
					//   放在这里（每帧都跑）两条都覆盖了；加速度那条（猛一顿/猛一停）保留。
					// ------------------------------------------------------------
					// [v12] 脱钩期间不冒泡：她已经"下线"了，而且她自己的飘动会让 relSp 虚高
					//       （否则会变成"脱钩了却还在尖叫"，很出戏）
					const swingI = relSp / Math.max(1, MUT.swingTrigger);
					if (swingI > 1 && !detached) {
						popBubble(swingI);
						triggerDeform(now);
					}

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

					// ---- [v10] 摆烂装死：到点她"回来"，并解掉虚线绳 ----
					if (bkSulkUntil > 0 && now >= bkSulkUntil) exitSulk();
					// [v11] 档位回归：窗口里已经没记录了（真的停手了）→ 档位归零，
					//       免得她"永久带着破防档"（发抖另有 bkShakeUntil 管，不受影响）。
					if (bkTier > 0 && !isSulking(now) && bkTimes.length
						&& now - bkTimes[bkTimes.length - 1] > MUT.breakWindowMs) {
						bkTier = 0;
						bkTimes.length = 0;
						bkCount = 0;
					}

					// ---- 平静检测：被甩过之后安静下来 → 补一句求饶/卖萌/生气 ----
					if (relSp < CALM_SPEED) {
						calmT += dt;
						if (agitated && calmT > CALM_QUIET_S && performance.now() - lastSay > MUT.calmMs && !sulking) {
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
					// [v10] 摆烂装死期间也闭嘴 —— 罢工就要有罢工的样子。
					// [v15] 每 8 帧查一次就够（阈值是"秒"级，16ms 的精度毫无意义）→ 省掉每帧的判断
					if (frameNo % 8 === 0 && MUT.idleOn && !sulking && relSp < CALM_SPEED && pose !== 'work') {
						const nowIdle = performance.now();
						if (nowIdle - lastMoveAtMs > MUT.idleStartMs && nowIdle - lastSay > MUT.idleGapMs) {
							sayIdleLine();
						}
					}

					// ---- 渲染 ----
					const deg = Math.atan2(bx - tx, by - ty) * 180 / Math.PI;   // 0 = 正下方
					const rod = rodRef.current, line = lineRef.current, whale = whaleRef.current;
					const stub = stubRef.current;   // [v12] 断线头
					// [v8] 绳末端要跟着"形变后的头顶"走：
					//   Q 弹压缩是绕内容中心做的，所以头顶会在形变时上/下移动（峰值可达 ~32px）。
					//   如果绳末端死钉在 (bx,by)，甩起来的瞬间就会看起来"绳子跟头脱开了"。
					//   这里把本地 (0,0) 经过同一套变换算出来的位置，作为绳末端与气泡的位置。
					const mMeta = META_OF(pose);
					const syM = 1 - squash;
					const sxM = 1 + squash * 0.6;
					const clM = Math.max(-58, Math.min(58, deg));
					const radM = clM * Math.PI / 180;
					// [v11] 破防发抖：**限时**的，不是"档位≥③就永远抖"（用户实测：
					//       破防后它一直抖个不停，像卡了 bug）。规则：
					//         · 每次猛甩"续"一下 shakeMs（连续甩 → 一直抖，看着就是"气得发抖"）
					//         · 停手后抖够 shakeMs 就停 → 她会安静下来
					//       纯渲染层位移：静止时振幅 0，也不参与物理，绳末端/气泡都跟着同一个位置走。
					const shaking = sulking || now < bkShakeUntil;
					if (shaking) {
						bkShakeT++;
						const amp = sulking ? 0.5 : 2.1;
						bxDraw = bx + Math.sin(bkShakeT * 1.9) * amp;
						byDraw = by + Math.cos(bkShakeT * 2.3) * amp * 0.6;
					} else { bxDraw = bx; byDraw = by; }
					// [v14] 脱钩"浮在水里"的上下轻晃（在上面发抖的基础上叠加，一起进渲染）
					if (bkBobSet) {
						bkBobT += 0;                                  // 相位已在物理段推进
						const mB = META_OF(pose);
						const ampB = Math.max(0, Math.min(MUT.sulkBob, (mB.ch || 170) * S * 0.12));
						byDraw += Math.sin(bkBobT * 1.7) * ampB;
						bxDraw += Math.sin(bkBobT * 0.9) * (ampB * 0.25);
					}
					const hdx = S * (mMeta.cx * (1 - sxM));
					const hdy = S * (mMeta.cy * (1 - syM));
					const hx = bxDraw + hdx * Math.cos(radM) - hdy * Math.sin(radM);
					const hy = byDraw + hdx * Math.sin(radM) + hdy * Math.cos(radM);
					if (rod) {
						// 竿尖钉在鼠标位置，竿身朝**右下**延伸（与系统箭头光标同朝向）；
						// 缩放也挂在同一个 transform 上，所以改尺寸不用重渲染
						// [v15] 数值没变就**不写**：每次 setAttribute 都会让浏览器重算样式，
						//       静息时这些写入纯属白烧（"性能优先"）。
						const rodTf = 'translate(' + tx.toFixed(2) + ',' + ty.toFixed(2) + ') scale(' + S.toFixed(3) + ')';
						if (rodTf !== lastRodTf) { lastRodTf = rodTf; rod.setAttribute('transform', rodTf); }
					}
					if (line) {
						// [v15] 同上：x1/y1 只在竿尖真的动了才写；x2/y2 跟着她走
						const l1 = tx.toFixed(2) + ',' + ty.toFixed(2);
						if (l1 !== lastLineA) {
							lastLineA = l1;
							line.setAttribute('x1', tx.toFixed(2)); line.setAttribute('y1', ty.toFixed(2));
						}
						const l2 = hx.toFixed(2) + ',' + hy.toFixed(2);
						if (l2 !== lastLineB) {
							lastLineB = l2;
							line.setAttribute('x2', hx.toFixed(2)); line.setAttribute('y2', hy.toFixed(2));
						}
						// [v10] 摆烂 → 虚线；[v12] 真脱钩 → 整条线**淡出消失**（钩子空了）
						if (sulking !== bkSulkOn) {
							bkSulkOn = sulking;
							try {
								if (sulking) line.classList.add('dsh-rod-line-slack');
								else line.classList.remove('dsh-rod-line-slack');
							} catch (e) { /* ignore */ }
						}
						// [v12] 脱钩时把线藏掉：只留鱼竿（光标语义不丢），一眼就看出"钩空了"
						const hideLine = detached && MUT.sulkHideLine;
						if (hideLine !== bkLineHidden) {
							bkLineHidden = hideLine;
							try {
								if (hideLine) line.classList.add('dsh-rod-line-gone');
								else line.classList.remove('dsh-rod-line-gone');
							} catch (e) { /* ignore */ }
						}
					}
					// [v12] 竿头留一小截"断掉的线头"在那儿晃（更有"脱钩"的戏）
					if (stub) {
						const stubOn = detached && MUT.sulkHideLine;
						if (stubOn !== bkStubOn) {
							bkStubOn = stubOn;
							try { stub.style.display = stubOn ? '' : 'none'; } catch (e) { /* ignore */ }
						}
						if (stubOn) {
							const len = 16;
							const wob = Math.sin(now / 260) * 7;      // 断线头轻轻晃
							stub.setAttribute('x1', tx.toFixed(2)); stub.setAttribute('y1', ty.toFixed(2));
							stub.setAttribute('x2', (tx + wob).toFixed(2)); stub.setAttribute('y2', (ty + len).toFixed(2));
						}
					}
					if (whale) {
						// 变换顺序有讲究（v4 修锚点、v5 修挂点、v6 多姿态、v8 绳跟头）：
						//   translate(锚点) → rotate(摆角) → scale(S)            ← 整体缩放放外层
						//   → translate(cx,cy) → scale(sx,sy) → translate(-cx,-cy) ← Q 弹绕"内容中心"压缩
						// 本地 (0,0) 是当前姿态量出来的"头顶挂点"（由 <image> 的 x/y 偏移对齐）。
						// 与上面算绳末端用的是同一组参数，所以两者永远重合。
						const m = mMeta;
						const sx = sxM, sy = syM, cl = clM;
						const tf = 'translate(' + bxDraw.toFixed(2) + ',' + byDraw.toFixed(2) + ')' +
							' rotate(' + cl.toFixed(2) + ')' +
							' scale(' + S.toFixed(4) + ')' +
							' translate(' + m.cx + ',' + m.cy + ')' +
							' scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')' +
							' translate(' + (-m.cx) + ',' + (-m.cy) + ')';
						if (tf !== lastWhaleTf) { lastWhaleTf = tf; whale.setAttribute('transform', tf); }
					}
					const wrap = wrapRef.current;
					if (wrap) {
						const wtf = 'translate3d(' + hx.toFixed(2) + 'px,' + (hy - 8 * S).toFixed(2) + 'px,0)';
						if (wtf !== lastWrapTf) { lastWrapTf = wtf; wrap.style.transform = wtf; }
					}

					// 点击闪色到期
					if (clickUntil && now > clickUntil) { clickUntil = 0; applyColor(now); }
					renderedOnce = true;   // [v15] 这一帧完整画过了 → 下一帧才允许走静息快车道
					lastPoseBusy = dshBusy;

					// [v9] 全屏兜底（先手压 z-index）：只在"顶层容器里真的有东西"
					//      时才需要——没弹窗、没全屏时 body 的子节点都是首页容器，
					//      压它们毫无意义还白扫一遍 DOM。再叠一个 ~2 秒节流。
					frameNo++;
					if (frameNo % 120 === 0 && liftCount() > 1) prePatchTopCandidates();
				}

				// ---- 注册 ----
				// 订阅 DSH 会话列表（干活状态一变立刻跟上）。两条路：订阅是主路（事件驱动、
				// 零轮询）；**只有订阅拿不到时才启 800ms 轮询兜底** —— [v15] 性能优先：
				// 订阅在的时候那个常驻定时器就是白烧（用户明确要求"别有无谓的循环占用"）。
				// 两条都失效则退化成"跟着甩动"，绝不报错。
				let unsub = null;
				let busyTimer = 0;
				try {
					const sessions = LIVE_CTX && typeof LIVE_CTX.get === 'function' ? LIVE_CTX.get('sessions') : null;
					const list = sessions && sessions.list;
					if (list && typeof list.subscribe === 'function') {
						unsub = list.subscribe(() => { dshBusy = readDshBusy(); });
					}
				} catch (e) { /* ignore */ }
				if (typeof unsub !== 'function') {
					busyTimer = window.setInterval(() => { dshBusy = readDshBusy(); }, 800);
				}

				window.addEventListener('mousemove', onMove, { passive: true });
				window.addEventListener('mousedown', onDown, { passive: true });
				window.addEventListener('blur', onHide);
				window.addEventListener('keydown', onKey);
				window.addEventListener('focus', onEnter);        // [v8] 回到窗口：只立基准
				window.addEventListener('mouseenter', onEnter);   // [v8] 指针进窗口：同上
				window.addEventListener('fullscreenchange', onFullscreen);        // [v9] 全屏兜底
				window.addEventListener('webkitfullscreenchange', onFullscreen);
				document.addEventListener('mouseleave', onHide);
				document.addEventListener('mouseenter', onEnter); // [v8] 主路径（浏览器里这条最可靠）
				document.addEventListener('visibilitychange', onVis);
				raf = window.requestAnimationFrame(frame);

				// [v9] 把宿主搬出槽位、挂到 document.body 的顶层容器里 —— 这一句就是
				//      「弹窗盖住鱼竿」的修复点（根因见上面 ensureLiftHost 的注释）。
				//      搬不动（没有 body / 权限问题）就原地待着，功能不受影响。
				//      先记住原位置：卸载时要把宿主还回去，React 才好干净地摘掉它。
				try { originalParent = host.parentNode || null; } catch (e) { originalParent = null; }
				host.__dshLifted = liftHost(host);

				// [v10] 给自检开一扇窄门：破防机是关在 effect 闭包里的，
				//       没有这扇门就只能靠"真的拼手速甩鼠标 + 等真实时间"来测（又慢又飘）。
				//       这里只暴露"记一次猛甩"给它，真实运行时不依赖。
				try {
					host.__dshBreakTest = {
						yank: recordYank,
						// [v12] 自检用：立刻结束摆烂（不然测试要么等 10 秒、要么时长调短导致中途过期）
						endSulk() { bkSulkUntil = performance.now() - 1; },
						// [v12] 自检用：把"猛甩计数/档位"清干净（测试各相位互不干扰）
						reset() { bkTimes.length = 0; bkCount = 0; bkTier = 0; bkShakeUntil = 0; },
						// [v12] 自检用：看内部时刻（排查"冷却为什么没拦住"这类问题）
						clocks() {
							const t = performance.now();
							return { now: Math.round(t), bk2At: Math.round(bk2At), bk3At: Math.round(bk3At),
								bk4At: Math.round(bk4At), sulkUntil: Math.round(bkSulkUntil),
								lastYank: Math.round(bkLastYankAt),
								times: bkTimes.map((v) => Math.round(v)), count: bkCount, tier: bkTier };
						},
						// [v15.1] 自检用：导出"甩飞判定"用到的物理量。
						//   排查"回弹/回钩被误判成甩飞"这类方向问题时，光看行为猜不出来，
						//   必须能读到 dNow / stretch / 点积符号这些真实数值。
						geom() {
							const dx = bx - tx, dy = by - ty;
							const dNow = Math.sqrt(dx * dx + dy * dy);
							const restL = clampNum(MUT.lineLen, 30, 160, 70);
							const dvx = vx - mvx, dvy = vy - mvy;
							return {
								bx: Math.round(bx), by: Math.round(by), tx: Math.round(tx), ty: Math.round(ty),
								vx: Math.round(vx * 10) / 10, vy: Math.round(vy * 10) / 10,
								mvx: Math.round(mvx * 10) / 10, mvy: Math.round(mvy * 10) / 10,
								dNow: Math.round(dNow * 10) / 10, restL: restL,
								stretched: dNow > restL,
								dot: Math.round(((dvx * dx + dvy * dy) / Math.max(1, dNow)) * 10) / 10,
							};
						},
						// [v13] 自检用：模拟"物理循环真的冒了一次泡"。
						// 用户报的"断线了还在说『放我下来』"就是这条路径的顺序问题，
						// 光调 yank() 钩子测不出来。
						popBubble: popBubble,
						// [v14] 自检用：查姿态高度与缩放（验证"沉底时整身可见"要靠它们算边界）
						// ⚠️ 缩放取 MUT.scale（frame 里的局部变量 S 在别处拿不到）
						meta() {
							const m = META_OF(pose);
							return { ch: m.ch, cx: m.cx, cy: m.cy, w: m.w, h: m.h,
								scale: clampNum(MUT.scale, 0.5, 1.2, 0.72) };
						},
						state() {
							const t = performance.now();
							return {
								count: bkCount, tier: bkTier, sulking: isSulking(t),
								shaking: isSulking(t) || t < bkShakeUntil,   // [v11] 是否在发抖
								shakeLeftMs: Math.max(0, Math.round(bkShakeUntil - t)),
							};
						},
					};
				} catch (e) { /* ignore */ }

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
					window.removeEventListener('focus', onEnter);
					window.removeEventListener('mouseenter', onEnter);
					window.removeEventListener('fullscreenchange', onFullscreen);
					window.removeEventListener('webkitfullscreenchange', onFullscreen);
					document.removeEventListener('mouseleave', onHide);
					document.removeEventListener('mouseenter', onEnter);
					document.removeEventListener('visibilitychange', onVis);

					// [v9] 拆顶层容器：把宿主交还给 React 的原位置（它马上会被 React 摘掉），
					//      容器里空了就顺手删掉——留着会在 body 上堆垃圾节点。
					//      ⚠️ 只在"空"时才删：容器是共享的，万一新宿主已经搬进去了，
					//         删容器就等于把新鱼竿一起埋了。
					try {
						const top = canDoc() ? document.getElementById(LIFT_ID) : null;
						if (top && host && host.parentNode === top) {
							const home = originalParent;
							if (home && typeof home.appendChild === 'function') home.appendChild(host);
							else top.removeChild(host);
							if ((top.children ? top.children.length : 0) === 0 && top.parentNode && top.parentNode.removeChild) {
								top.parentNode.removeChild(top);
							}
						}
					} catch (e) { /* ignore */ }
				};
			}, [cfg.on, cfg.mode]);

			if (!cfg.on) return null;

			return react.createElement('div', { ref: hostRef, className: 'dsh-rod-host' },
				react.createElement('svg', { className: 'dsh-rod-svg' },
					react.createElement('line', { ref: lineRef, className: 'dsh-rod-line' }),
					// [v12] 断掉的线头（脱钩时才显示，挂在竿尖上轻轻晃）
					react.createElement('line', {
						ref: stubRef, className: 'dsh-rod-line dsh-rod-stub',
						style: { display: 'none' },
					}),
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
			const [break2Text, setBreak2Text] = react.useState(MUT.break2Quotes.join('\n'));
			const [break3Text, setBreak3Text] = react.useState(MUT.break3Quotes.join('\n'));
			const [sulkText, setSulkText] = react.useState(MUT.sulkQuotes.join('\n'));
			const [recoverText, setRecoverText] = react.useState(MUT.recoverQuotes.join('\n'));

			// 冷却/时长的统一显示：< 60s 用秒，≥ 60s 用"分/秒"或"分"
			const secs = (ms) => (ms < 60000 ? (ms / 1000).toFixed(ms % 1000 ? 1 : 0) + ' s'
				: (ms < 3600000 ? (ms / 60000).toFixed(1) + ' 分' : (ms / 60000).toFixed(0) + ' 分'));

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

				row('甩飞灵敏度 ' + Math.round(MUT.swingTrigger) + ' px/s', slider('swingTrigger', 300, 6000, 100)),

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
					'共 ' + MUT.idleQuotes.length + ' 条 · 不会连着重复；说台词时优先让位给尖叫与平静台词'),

				// ---- [v10] 破防四档 ----
				react.createElement('div', { className: 'dsh-rod-note', style: { marginTop: 18, fontWeight: 600 } },
					'💥 破防四档（连着猛甩才会升级 · 每一档的冷却都能单独调）'),
				react.createElement('div', { className: 'dsh-rod-note' },
					'① 晃晕（默认：尖叫池随机，字号随力度）→ ② 求饶（软下来求你）→ ③ 破防（骂人+哭腔，气泡连发两条，她开始发抖）→ ④ 摆烂（扒在光标上罢工，绳子变虚线，装死一段时间怎么甩都不出声）。',
					react.createElement('br'),
					'冷却语义：**每次真的触发该档之后**才重新计时；冷却中被挡下就退回普通尖叫，不会"跳档"。'),

				row('破防模式', btn(MUT.breakOn ? '已开启' : '已关闭', MUT.breakOn, () => { saveSettings({ breakOn: !MUT.breakOn }); bump(); })),
				row('允许她摆烂（罢工装死）', btn(MUT.breakSulkOn ? '已开启' : '已关闭', MUT.breakSulkOn, () => { saveSettings({ breakSulkOn: !MUT.breakSulkOn }); bump(); })),
				row('脱钩演出（真把线断了）', btn(MUT.sulkDetach ? '脱钩（推荐）' : '只变虚线', MUT.sulkDetach, () => { saveSettings({ sulkDetach: !MUT.sulkDetach }); bump(); })),
				react.createElement('div', { className: 'dsh-rod-note' },
					'「脱钩」= 摆烂时**鱼线消失 + 绳子不再施力**，她慢慢往下飘，你怎么甩都拉不动她（15 秒后飘回来撒娇）。',
					'「只变虚线」= 老版：线还在，只是虚了 + 拉得动 —— 体感弱，但更喜欢"她还在"的话就选这个。'),
				row('脱钩时她往下飘', btn(MUT.sulkFreeFall ? '已开启' : '原地悬停', MUT.sulkFreeFall, () => { saveSettings({ sulkFreeFall: !MUT.sulkFreeFall }); bump(); })),
				row('脱钩时藏掉整条鱼线', btn(MUT.sulkHideLine ? '已开启' : '已关闭', MUT.sulkHideLine, () => { saveSettings({ sulkHideLine: !MUT.sulkHideLine }); bump(); })),
				row('脱钩阻尼 ' + MUT.sulkDamp.toFixed(1) + '（小=飘得远）', slider('sulkDamp', 0, 6, 0.1)),
				row('脱钩浮沉 ' + Math.round(MUT.sulkBob) + ' px（0=沉底不动）', slider('sulkBob', 0, 40, 1)),
				react.createElement('div', { className: 'dsh-rod-note' },
					'沉底时她会像"浮在水里"那样轻轻上下晃（纯视觉，不影响物理）。边界也按**整身**算 —— 沉到底也是整个身子都在屏内，不会只剩个脑袋。'),

				row('连续甩判定窗口 ' + (MUT.breakWindowMs / 1000).toFixed(1) + ' s', slider('breakWindowMs', 500, 10000, 100)),
				react.createElement('div', { className: 'dsh-rod-note' },
					'（窗口是**滚动**的：只数"最近这么长时间内"的猛甩次数，中间停一下歇口气也不清零 —— 所以门槛别设得比"窗口 ÷ 0.7s"还大，否则永远够不到）'),
				row('② 求饶门槛 ' + MUT.break2At + ' 次', slider('break2At', 2, 20, 1)),
				row('③ 破防门槛 ' + MUT.break3At + ' 次', slider('break3At', 2, 30, 1)),
				row('④ 摆烂门槛 ' + MUT.break4At + ' 次', slider('break4At', 2, 60, 1)),
				row('发抖时长 ' + (MUT.shakeMs / 1000).toFixed(1) + ' s', slider('shakeMs', 300, 8000, 100)),
				react.createElement('div', { className: 'dsh-rod-note' },
					'（发抖是"限时"的：被甩时抖一下/连续甩就一直抖，停手后抖够这个时长就安静下来）'),

				row('② 求饶冷却 ' + secs(MUT.break2CoolMs), slider('break2CoolMs', 1000, 120000, 1000)),
				row('③ 破防冷却 ' + secs(MUT.break3CoolMs), slider('break3CoolMs', 1000, 300000, 1000)),
				row('④ 摆烂冷却 ' + secs(MUT.break4CoolMs), slider('break4CoolMs', 5000, 3600000, 5000)),
				// [v15.1] 一键预设：滑条要拖半天才能设到某个整数值，太费劲 —— 交给玩的人自己挑
				row('④ 冷却一键预设', react.createElement('div', { className: 'dsh-rod-inline' },
					[[30000, '30 秒'], [60000, '1 分钟'], [120000, '2 分钟'], [300000, '5 分钟（旧默认）'], [600000, '10 分钟']]
						.map(([ms, label]) => btn(
							label + (MUT.break4CoolMs === ms ? ' ✓' : ''),
							MUT.break4CoolMs === ms,
							() => { saveSettings({ break4CoolMs: ms }); bump(); },
						)))),
				row('④ 装死时长 ' + secs(MUT.sulkMs), slider('sulkMs', 1000, 60000, 500)),

				react.createElement('div', { className: 'dsh-rod-note' },
					'② 求饶台词（连续甩够门槛时专用）'),
				react.createElement('textarea', {
					className: 'dsh-rod-ta',
					style: { minHeight: 76 },
					value: break2Text,
					onChange: (e) => {
						setBreak2Text(e.target.value);
						saveSettings({ break2Quotes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) });
					},
				}),

				react.createElement('div', { className: 'dsh-rod-note' },
					'③ 破防台词（骂人 / 哭腔混编 —— 鲸鱼骂人不带脏字）'),
				react.createElement('textarea', {
					className: 'dsh-rod-ta',
					style: { minHeight: 76 },
					value: break3Text,
					onChange: (e) => {
						setBreak3Text(e.target.value);
						saveSettings({ break3Quotes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) });
					},
				}),

				react.createElement('div', { className: 'dsh-rod-note' },
					'④ 摆烂台词（罢工宣言）· 下面这格是"装死结束后回来撒娇"'),
				react.createElement('textarea', {
					className: 'dsh-rod-ta',
					style: { minHeight: 64 },
					value: sulkText,
					onChange: (e) => {
						setSulkText(e.target.value);
						saveSettings({ sulkQuotes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) });
					},
				}),
				react.createElement('textarea', {
					className: 'dsh-rod-ta',
					style: { minHeight: 64 },
					value: recoverText,
					onChange: (e) => {
						setRecoverText(e.target.value);
						saveSettings({ recoverQuotes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) });
					},
				}),
				react.createElement('div', { className: 'dsh-rod-note' },
					'共 ' + MUT.break2Quotes.length + ' / ' + MUT.break3Quotes.length + ' / ' + MUT.sulkQuotes.length + ' / ' + MUT.recoverQuotes.length + ' 条（②/③/④/撒娇）· 改完立即生效')
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
