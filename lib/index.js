/**
 * host 半侧（服务端）—— dsh-whale-rod-cursor
 * ============================================================================
 * 本插件是**纯浏览器端的界面装饰**：在 DSH Web 的 `shell.overlay` 上画一根鱼竿、
 * 一条弹性绳和一只 Q 版鲸鱼娘。浏览器半侧由 package.json 的 `dsh.client` 声明
 * 自动发现（见 `./client.js`），服务端这里**什么都不用做**。
 *
 * 但这个空 apply 必须留着：插件行存在于 host Loader 里，客户端模块清单
 * （client-modules roster）才会扫描到本包的浏览器半侧。删掉它 → 前端不会加载。
 *
 * 本插件：
 *   · 不读写任何文件        · 不起进程        · 不联网、无遥测
 *   · 唯一的外部依赖是 DSH 外壳提供的 React 与客户端运行时（peerDependencies）
 *   · 浏览器端只读一个 DSH 状态：ctx.get('sessions') 里当前会话的 running 布尔值，
 *     用来切换"在忙 / 干完了"姿态；读不到就自动退化，不影响功能
 *
 * 素材与授权：Q 版鲸鱼娘形象来自 yanzwzz/dsh-whale-girl-pet（MIT），
 * 力学常数取值基准参考 9livewolf/dsh-think-bounce-pet（声明 MIT）。
 * 完整声明见包根目录 NOTICE.md（含上游 MIT 许可全文）。
 */
export const name = 'rod-cursor';
export const inject = [];

export function apply() {
  // 故意的空实现 —— 见文件头说明。
}
