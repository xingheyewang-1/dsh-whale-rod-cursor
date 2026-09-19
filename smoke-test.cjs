/**
 * 冒烟测试（不联网、不开浏览器）：用最小假的 DOM/React 把 lib/client.js 跑起来，
 * 验证这些东西：
 *   1. 模块加载协议正确（__ModuleLoader__.load 的 id 与 package.json 一致）
 *   2. 两个插槽都注册成功（外壳 overlay + 设置页），带正确的 order/label
 *   3. 组件能渲染出来（不错版、不抛异常）
 *   4. 几何：竿尖在鼠标热点、握把朝右下（朝向没反）、**绳末端与鲸鱼娘头顶重合**
 *      （v4 修的 bug 就是这里：缩放挂错锚点，头顶被抬高，看着像"线没连上"）
 *   5. 物理：被拽飞 → 倾角受限 → 最终回落静止；手感曲线（初始拉力 / 甩飞 / 收敛）
 *   6. 气泡：缓甩出萌语、暴甩出尖叫（**字号随力度长大**）、平静后补求饶/卖萌/生气台词
 *   7. 保命机制：藏光标后 Alt+Esc 能切回真光标模式（绝不把用户鼠标弄丢）
 *
 * 用法： node smoke-test.cjs      （退出码 0 = 全过）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CLIENT = path.join(__dirname, 'lib', 'client.js');
const PKG = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const ANCHOR_JSON = path.join(__dirname, 'lib', 'whale-anchor.json');
const ASSET_DIR = 'F:/DSH_Workspace/ref/cursor-candidates/';
// 挂点信息由 build.cjs 逐张量出来后注入 client.js，并存档在 lib/whale-anchor.json
const SIDECAR = JSON.parse(fs.readFileSync(ANCHOR_JSON, 'utf8'));
const POSES = SIDECAR.poses;
const META = POSES.idle;
const WHALE_H = META.h;

let pass = 0, fail = 0;
function ok(cond, msg, extra) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg + (extra ? '   → ' + extra : '')); }
}

// ---------------------------------------------------------------- 假 DOM
function fakeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    attrs: {}, children: [], textContent: '', offsetWidth: 0, id: '',
    style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); },
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; },
    addEventListener() {}, removeEventListener() {},
  };
  return el;
}

const head = fakeEl('head');
const documentStub = {
  head,
  documentElement: fakeEl('html'),
  hidden: false,
  createElement: (t) => fakeEl(t),
  getElementById: (id) => head.children.find((c) => c.id === id) || null,
  addEventListener() {}, removeEventListener() {},
};

const winListeners = new Map();   // 事件名 → [handler]
const win = {
  innerWidth: 1920, innerHeight: 1080,
  addEventListener(type, fn) { if (!winListeners.has(type)) winListeners.set(type, []); winListeners.get(type).push(fn); },
  removeEventListener(type, fn) {
    if (winListeners.has(type)) winListeners.set(type, winListeners.get(type).filter((f) => f !== fn));
  },
  dispatchEvent() { return true; },
  localStorage: {
    _m: new Map(),
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
    setItem(k, v) { this._m.set(k, String(v)); },
  },
  setTimeout: (fn, ms) => { const t = setTimeout(fn, ms); if (t.unref) t.unref(); return t; },
  clearTimeout: (t) => clearTimeout(t),
  setInterval: (fn, ms) => { const t = setInterval(fn, ms); if (t.unref) t.unref(); return t; },
  clearInterval: (t) => clearInterval(t),
  requestAnimationFrame(cb) { rafQueue.push(cb); return ++rafId; },
  cancelAnimationFrame() {},
};
let rafQueue = [], rafId = 0;

// ---------------------------------------------------------------- 假 React
const reactStub = {
  createElement(type, props, ...children) {
    const p = Object.assign({}, props || {});
    if (children.length) p.children = children.length === 1 ? children[0] : children;
    if (typeof type === 'function') {
      if (type.prototype && typeof type.prototype.render === 'function') {
        const inst = new type(p);
        inst.props = p;
        return inst.render();
      }
      return type(p);                       // 函数组件：直接调用（迷你渲染器）
    }
    const el = fakeEl(type);
    if (p.ref) p.ref.current = el;
    el.props = p;                    // 留着 props，测试里可以直接点按钮
    if (typeof p.className === 'string') el.className = p.className;
    if (p.style && typeof p.style === 'object') Object.assign(el.style, p.style);   // 照 React 的做法落内联样式
    // 真实 DOM 会把这些属性落到元素上（SVG 的 x1/y1/cx/r 等），这里照做
    Object.keys(p).forEach((k) => {
      if (k === 'ref' || k === 'children' || k === 'className') return;
      const v = p[k];
      if (typeof v === 'number' || (typeof v === 'string' && v.length < 200)) el.attrs[k] = v;
    });
    if (p.children) {
      const kids = Array.isArray(p.children) ? p.children : [p.children];
      kids.forEach((k) => { if (k && typeof k === 'object' && k.tagName) el.appendChild(k); });
    }
    return el;
  },
  Component: class Component {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(s) { Object.assign(this.state, typeof s === 'function' ? s(this.state) : s); }
  },
  useRef: (init) => ({ current: init === undefined ? null : init }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  // 真实的 useEffect 是"提交之后"才跑（此时 ref 已填好）。
  // 这里先入队，等整棵树渲染完再 flush —— 顺序必须一致，否则宿主节点还是 null。
  useEffect: (fn) => { pendingEffects.push(fn); },
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
};
const pendingEffects = [];
function flushEffects() {
  pendingEffects.splice(0).forEach((fn) => { const c = fn(); if (typeof c === 'function') cleanups.push(c); });
}
const cleanups = [];

// ---------------------------------------------------------------- SVG 变换工具
// 用来验证"绳末端到底有没有接在鲸鱼娘头顶"——光看代码是看不出锚点挂错的。
function parseTransform(str) {
  const re = /(translate|rotate|scale)\(([^)]*)\)/g;
  const ops = [];
  let m;
  while ((m = re.exec(String(str || '')))) {
    const nums = m[2].split(',').map((s) => Number(s.trim()));
    ops.push({ op: m[1], a: nums[0], b: nums[1] });
  }
  return ops;
}
function applyTransform(ops, x, y) {
  let px = x, py = y;
  for (let i = ops.length - 1; i >= 0; i--) {   // 从右往左施加到点上
    const o = ops[i];
    if (o.op === 'translate') { px += o.a; py += (isNaN(o.b) ? 0 : o.b); }
    else if (o.op === 'scale') { const sy = isNaN(o.b) ? o.a : o.b; px *= o.a; py *= sy; }
    else if (o.op === 'rotate') {
      const r = o.a * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
      const nx = px * c - py * s, ny = px * s + py * c;
      px = nx; py = ny;
    }
  }
  return { x: px, y: py };
}

/** 按按钮文字找元素并点它（用来验证设置页的按钮真的接上了行为）。 */
function clickByText(root, text) {
  let hit = null;
  (function walk(node) {
    if (hit || !node || typeof node !== 'object') return;
    const p = node.props;
    if (p && typeof p.onClick === 'function') {
      const kids = p.children;
      const label = Array.isArray(kids) ? kids.join('') : (typeof kids === 'string' ? kids : null);
      if (label === text) { hit = node; return; }
    }
    const kids2 = node.children;
    if (Array.isArray(kids2)) kids2.forEach(walk);
    else if (kids2 && typeof kids2 === 'object') walk(kids2);
    if (p && p.children) {
      const k3 = p.children;
      if (Array.isArray(k3)) k3.forEach(walk);
      else if (k3 && typeof k3 === 'object' && k3.tagName) walk(k3);
    }
  })(root);
  if (hit) { hit.props.onClick(); return true; }
  return false;
}

/**
 * 按标签前缀拖设置页的滑块（设置行的结构是 div[span(标签), input(range)]）。
 * 用来把某个参数调到测试需要的值，比如把气泡冷却调到最小让回归用例确定可测。
 */
function setSlider(root, labelPrefix, value) {
  let hit = null;
  (function walk(node) {
    if (hit || !node || typeof node !== 'object') return;
    const p = node.props;
    const kids = p && p.children;
    if (Array.isArray(kids) && kids.length === 2) {
      const a = kids[0], b = kids[1];
      const label = (a && a.props && typeof a.props.children === 'string') ? a.props.children : '';
      if (label.indexOf(labelPrefix) === 0 && b && b.props && typeof b.props.onChange === 'function') { hit = b; return; }
    }
    const ch = node.children;
    if (Array.isArray(ch)) ch.forEach(walk);
    if (kids) {
      if (Array.isArray(kids)) kids.forEach(walk);
      else if (typeof kids === 'object') walk(kids);
    }
  })(root);
  if (!hit) return false;
  hit.props.onChange({ target: { value: String(value) } });
  return true;
}

// ---------------------------------------------------------------- 跑起来
const sandbox = {
  window: win, document: documentStub, console,
  performance: { now: () => nowMs },
  CustomEvent: class CustomEvent { constructor(t) { this.type = t; } },
  Math, JSON, Object, Array, Number, String, isFinite, Date, RegExp, Error,
  setTimeout: win.setTimeout, clearTimeout: win.clearTimeout,
};
sandbox.globalThis = sandbox;
win.document = documentStub;
win.performance = sandbox.performance;
let nowMs = 1000;

let captured = null;
win.__ModuleLoader__ = { load(entry) { captured = entry; } };

// 预置一份"老版本存下来的设置"：尖叫池只有老 3 条、用户自己改过普通语录。
// 用来验证台词池升级（POOL_VER）会把新增台词并进去，而不是被旧池子盖掉。
const OLD_SETTINGS = {
  screamQuotes: ['啊啊啊啊啊——', '啊啊啊啊啊——！', '呜哇啊啊啊啊——'],
  quotes: ['晃晕啦～', '我自己加的一句'],
  idleQuotes: ['钓鱼佬今天又空军了吧～'],
};
win.localStorage.setItem('dsh-whale-rod-cursor.settings', JSON.stringify(OLD_SETTINGS));

const code = fs.readFileSync(CLIENT, 'utf8');
console.log('文件: lib/client.js  (' + (fs.statSync(CLIENT).size / 1024).toFixed(1) + ' KB)');
console.log('package.json name: ' + PKG.name);
console.log('');

console.log('[1] 模块加载协议');
vm.createContext(sandbox);
try {
  vm.runInContext(code, sandbox, { filename: 'client.js' });
  ok(!!captured, '调用了 window.__ModuleLoader__.load');
  ok(captured && captured.id === PKG.name, 'load 的 id 与 package.json 的 name 一致', captured && captured.id);
  ok(typeof (captured && captured.factory) === 'function', 'factory 是函数');
} catch (e) {
  ok(false, '脚本可执行', e.message);
  process.exit(1);
}

const exportsObj = captured.factory((n) => {
  if (n === 'react') return reactStub;
  throw new Error('未预期的 require: ' + n);
});

console.log('');
console.log('[2] 插件三件套');
ok(exportsObj.name === 'rod-cursor', "name = 'rod-cursor'", exportsObj.name);
ok(Array.isArray(exportsObj.inject) && exportsObj.inject.includes('slots'), "inject 含 'slots'", JSON.stringify(exportsObj.inject));
ok(typeof exportsObj.apply === 'function', 'apply 是函数');
const VER = win.__WHALE_ROD_CURSOR_VER__;
ok(typeof VER === 'string' && /^\d{4}-\d{2}-\d{2}-v\d+/.test(VER), '版本戳已写入并符合命名规范：' + VER, VER);
ok(VER && VER.includes('v8'), '版本戳是 v8（本次改动生效的那版）', VER);
ok(documentStub.getElementById('dsh-rod-cursor-style') !== null, '样式已注入 <style id="dsh-rod-cursor-style">');

console.log('');
console.log('[2.5] 挂点链条：素材 → 存档 → 产物');
{
  const crypto = require('crypto');
  let injected = null;
  try { injected = JSON.parse((code.match(/const POSES = (\{.*?\});\s*\n/) || [, 'null'])[1]); } catch (e) { /* ignore */ }
  ok(!!injected && !!injected.idle && !!injected.work && !!injected.done, '产物里注入了 3 个姿态（idle/work/done）');
  let shaOk = 0, injOk = 0;
  for (const key of ['idle', 'work', 'done']) {
    const m = POSES[key];
    // ① 存档里的 sha 必须等于现在这张 PNG（换了素材就会对不上，提醒重新 build）
    const sha = crypto.createHash('sha256').update(fs.readFileSync(ASSET_DIR + m.asset)).digest('hex').slice(0, 16);
    if (sha === m.sha256_16) shaOk++;
    // ② 产物里注入的挂点必须与存档一致
    const im = injected && injected[key] && injected[key].meta;
    if (im && im.ax === m.ax && im.ay === m.ay && im.cx === m.cx && im.cy === m.cy && im.ch === m.ch) injOk++;
    // ③ 挂点必须跳过画布上方留白、且落在画布中线上
    ok(m.ay > m.box.minY, key + ' 挂点跳过了画布顶端 ' + (m.ay - m.box.minY) + 'px 透明留白');
    ok(Math.abs(m.ax - m.w / 2) < 1, key + ' 挂点在画布中线上（x=' + m.ax + ' ≈ ' + m.w / 2 + '）');
    ok(m.ay >= m.box.minY && m.ay < m.box.minY + 25, key + ' 挂点在内容顶部附近（y=' + m.ay + '）');
  }
  ok(shaOk === 3, '三张素材的 sha256 与存档一致（' + shaOk + '/3）');
  ok(injOk === 3, '产物里注入的挂点 = 存档（' + injOk + '/3）');
}

console.log('');
console.log('[2.2] 设置迁移：老池子 + 新版新增台词 → 合并');
{
  const saved = JSON.parse(win.localStorage.getItem('dsh-whale-rod-cursor.settings') || '{}');
  ok(saved.pv === 2, '设置已标记台词池版本 pv=2（升级后自动落盘）');
  ok(Array.isArray(saved.screamQuotes) && saved.screamQuotes.length >= 12,
    '老尖叫池被合并扩容：' + (saved.screamQuotes || []).length + ' 条（合并前 3 条）');
  ok(saved.screamQuotes.indexOf('啊啊啊啊啊——') >= 0 && saved.screamQuotes.some((s) => /求|呜呜|哭/.test(s)),
    '既有老台词又拿到了新的求饶/哭唧唧台词');
  ok(saved.quotes.indexOf('我自己加的一句') >= 0, '用户自己加的台词被保留（没被覆盖）');
  ok(saved.quotes.length > 2, '普通语录池也合并了新版默认台词（' + saved.quotes.length + ' 条）');
}

console.log('');
console.log('[3] 插槽注册');
const regs = [];
// 假 DSH 服务：官方客户端服务 sessions.list 的快照形状
//   { current, byId: { [id]: { running: boolean, ... } } }
const fakeSessions = {
  _subs: [],
  running: false,
  list: {
    getSnapshot() {
      return { current: 's1', byId: { s1: { id: 's1', running: fakeSessions.running } }, ids: ['s1'], phase: 'ready' };
    },
    subscribe(fn) { fakeSessions._subs.push(fn); return () => { fakeSessions._subs = fakeSessions._subs.filter((f) => f !== fn); }; },
  },
  setRunning(v) { fakeSessions.running = v; fakeSessions._subs.forEach((f) => f()); },
};
const ctx = {
  get(name) { return name === 'sessions' ? fakeSessions : null; },
  slots: {
    inject(slotName, gen) {
      for (const r of gen()) regs.push({ injectedInto: slotName, ...r });
    },
    register(meta, component) { return { ...meta, component }; },
  },
};
try {
  exportsObj.apply(ctx);
  ok(regs.length === 2, '共注册 2 个插槽条目', '实际 ' + regs.length);
  const overlay = regs.find((r) => r.name === 'shell.overlay');
  const settings = regs.find((r) => r.name === 'settings.section');
  ok(!!overlay && overlay.id === 'whale-rod-cursor', 'shell.overlay#whale-rod-cursor', overlay && overlay.id);
  ok(!!settings && settings.id === 'whale-rod-cursor', 'settings.section#whale-rod-cursor', settings && settings.id);
  ok(!!settings && settings.label === '鱼竿光标', '设置页标签 = 鱼竿光标', settings && settings.label);
  ok(typeof overlay.component === 'function' && typeof settings.component === 'function', '两个条目都是可渲染组件');
} catch (e) {
  ok(false, 'apply() 不抛异常', e.stack);
}

console.log('');
console.log('[4] 渲染 + 几何');
let tree = null;
try {
  tree = regs.find((r) => r.name === 'shell.overlay').component({});
  ok(!!tree && tree.className === 'dsh-rod-host', 'overlay 渲染出 .dsh-rod-host 根节点');
} catch (e) {
  ok(false, 'overlay 渲染不抛异常', e.stack);
}

if (tree) {
  flushEffects();
  const svg = tree.children.find((c) => c.tagName === 'SVG');
  ok(!!svg, '渲染出 <svg>');
  // 注意：svg 里有两个 <g>（鱼竿组 + 鲸鱼组），鱼饵是"装着 <image> 的那个"
  const groups = (svg.children || []).filter((c) => c.tagName === 'G');
  const whaleG = groups.find((g) => (g.children || []).some((k) => k.tagName === 'IMAGE'));
  const rodG = groups.find((g) => g !== whaleG);
  const line = svg.children.find((c) => c.tagName === 'LINE');
  const bubble = tree.children.find((c) => c.className === 'dsh-rod-bubble-wrap').children[0];
  ok(!!whaleG, '找到装着 <image> 的鲸鱼组');
  ok(!!rodG, '找到鱼竿组');
  ok(!!line, '渲染出吊线 <line>');
  ok(winListeners.has('mousemove'), '注册了 mousemove 监听');
  ok(winListeners.has('mousedown'), '注册了 mousedown 监听');
  ok(winListeners.has('keydown'), '注册了 keydown 监听（Alt+Esc 应急出口）');
  ok(winListeners.has('blur'), '注册了 blur 监听（失焦还光标）');

  // 钓竿朝右下方延伸（竿尖在左上 = 与箭头光标同朝向）
  const rodStick = (rodG.children || []).find((c) => c.className === 'dsh-rod-stick');
  const rodGrip = (rodG.children || []).find((c) => c.className === 'dsh-rod-grip');
  const gx = Number(rodGrip && rodGrip.attrs.x2), gy = Number(rodGrip && rodGrip.attrs.y2);
  ok(rodStick && Number(rodStick.attrs.x1) === 0 && Number(rodStick.attrs.y1) === 0, '竿尖坐标 (0,0) 就是鼠标热点');
  ok(gx > 0 && gy > 0, '握把在右下方（竿子没倒着拿）', 'grip x2=' + gx + ' y2=' + gy);

  // 驱动假 rAF：把鼠标甩一下，看物理反应
  function pump(frames, dtMs) {
    for (let i = 0; i < frames; i++) {
      const q = rafQueue; rafQueue = [];
      nowMs += dtMs;
      q.forEach((cb) => cb(nowMs));
    }
  }
  const move = (x, y) => winListeners.get('mousemove').forEach((f) => f({ clientX: x, clientY: y, target: null }));

  move(400, 300);
  pump(70, 16.7);              // 跑到 Q 弹衰减干净（TTL 640ms ≈ 38 帧）再量几何
  const t1 = whaleG.attrs.transform;
  ok(!!t1 && !/NaN/.test(t1), '静置后鲸鱼娘 transform 合法', t1);

  // 鱼竿：按鼠标位置 + 带缩放（默认 0.72 → 小一号）
  const rodT = rodG.attrs.transform || '';
  const sm = /scale\(([\d.]+)\)/.exec(rodT);
  const S = Number(sm && sm[1]);
  ok(/^translate\(400/, '鱼竿钉在鼠标位置', rodT);
  ok(S > 0.5 && S < 1, '鱼竿带整体缩放（' + S + '）—— 比默认小一号');
  ok(documentStub.documentElement.classList.contains('dsh-rod-cursor-none'), '鱼竿当光标模式：已隐藏系统光标');

  // ------------------------------------------------------------
  // 关键几何：绳末端必须落在鲸鱼娘**头顶**上
  //   v4 修锚点、v5 修画布留白、v8 修"形变时绳跟着头顶走"
  //   （形变是绕内容中心压缩的，头顶会位移，绳末端必须跟过去，否则甩起来像脱钩）
  // ------------------------------------------------------------
  const ops = parseTransform(whaleG.attrs.transform);
  const lineEnd = { x: Number(line.attrs.x2), y: Number(line.attrs.y2) };
  const headTop = applyTransform(ops, 0, 0);
  const gapOf = () => {
    const h = applyTransform(parseTransform(whaleG.attrs.transform), 0, 0);
    return Math.hypot(h.x - Number(line.attrs.x2), h.y - Number(line.attrs.y2));
  };
  // ① 完全静止时必须是零误差（容忍 SVG 属性两位/四位小数带来的舍入）
  let quiet = false;
  for (let i = 0; i < 900 && !quiet; i++) {
    const sd = /scale\(([\d.]+),([\d.]+)\)/.exec(whaleG.attrs.transform || '');
    if (sd && Math.abs(Number(sd[1]) - 1) < 0.002 && Math.abs(Number(sd[2]) - 1) < 0.002) quiet = true;
    else pump(1, 16.7);
  }
  const quietGap = gapOf();
  ok(quiet && quietGap < 0.05, '静置时绳末端 = 头顶，误差 ' + quietGap.toFixed(3) + 'px');
  // ② 主动按一下鼠标触发 Q 弹，确认**形变中**绳末端也跟着头顶走（v8 修的就是这个：
  //    形变绕内容中心压缩，头顶会位移，绳末端必须跟过去，否则甩起来像脱钩）
  (winListeners.get('mousedown') || []).forEach((f) => f({}));
  pump(1, 16.7);
  const sd2 = /scale\(([\d.]+),([\d.]+)\)/.exec(whaleG.attrs.transform || '');
  const inDeform = sd2 && Math.abs(Number(sd2[2]) - 1) > 0.05;
  const defGap = gapOf();
  if (process.env.DBG) {
    console.log('    [dbg] whale transform = ' + whaleG.attrs.transform);
    console.log('    [dbg] line end = (' + line.attrs.x2 + ', ' + line.attrs.y2 + ')');
    const h = applyTransform(parseTransform(whaleG.attrs.transform), 0, 0);
    console.log('    [dbg] headTop(本地0,0 映射) = (' + h.x.toFixed(3) + ', ' + h.y.toFixed(3) + ')');
    console.log('    [dbg] gap = ' + Math.hypot(h.x - Number(line.attrs.x2), h.y - Number(line.attrs.y2)).toFixed(3));
  }
  ok(inDeform, '按下鼠标确实触发了 Q 弹形变（sy=' + (sd2 ? sd2[2] : 'n/a') + '）');
  ok(defGap < 1.5, 'Q 弹形变中绳末端仍贴在头顶上（误差 ' + defGap.toFixed(2) + 'px）');

  // 本地原点到底对应素材里的哪个像素？由 <image> 的 x/y 偏移决定：
  // 必须是构建期量出来的"头顶挂点"，而不是画布顶端/中心。
  const imgEl = (whaleG.children || []).find((c) => c.tagName === 'IMAGE');
  ok(!!imgEl, '找到素材 <image>');
  const imgX = Number(imgEl.attrs.x), imgY = Number(imgEl.attrs.y);
  ok(imgX === -META.ax && imgY === -META.ay,
    '素材偏移 (-' + META.ax + ',-' + META.ay + ') 把"头顶像素"对到绳末端（image x=' + imgX + ' y=' + imgY + '）');

  // Q 弹支点 = 内容中心（旋转不变的"距头顶距离"判断）
  const pivotLocal = { x: META.cx, y: META.cy };
  const center = applyTransform(ops, pivotLocal.x, pivotLocal.y);
  const centerDist = Math.hypot(center.x - headTop.x, center.y - headTop.y);
  const expectDist = Math.hypot(pivotLocal.x, pivotLocal.y) * S;
  ok(Math.abs(centerDist - expectDist) < 1, '内容中心距头顶 ' + centerDist.toFixed(1) + 'px = ' + expectDist.toFixed(1) + 'px（Q 弹支点正确）');
  ok(Number(rodT.match(/translate\(([\d.-]+),([\d.-]+)\)/)[1]) === Number(line.attrs.x1), '鱼竿竿尖与绳起点同一个点');

  // ------------------------------------------------------------
  // 姿态包：idle 平时 / work 在忙 / done 干完了
  // ------------------------------------------------------------
  console.log('');
  console.log('[4.5] 姿态包（idle / work / done）');
  {
    const imgs = (whaleG.children || []).filter((c) => c.tagName === 'IMAGE');
    ok(imgs.length === 3, '鲸鱼组里挂着 3 张姿态图', '实际 ' + imgs.length + ' 张');
    const byKey = {};
    for (const im of imgs) {
      // 用「尺寸 + 挂点」一起认人：work/done 的挂点相同（画布更宽，中线都在 80），
      // 只按挂点找会把两张认成同一张 —— 尺寸才是唯一的（159 vs 160）。
      const key = ['idle', 'work', 'done'].find((k) => POSES[k].ax === -Number(im.attrs.x) && POSES[k].ay === -Number(im.attrs.y)
        && POSES[k].w === Number(im.attrs.width) && POSES[k].h === Number(im.attrs.height));
      if (!key) { ok(false, '姿态图对不上任何姿态', 'x=' + im.attrs.x + ' y=' + im.attrs.y + ' w=' + im.attrs.width); continue; }
      byKey[key] = im;
      ok(true, key + ' 姿态：偏移 (-' + POSES[key].ax + ',-' + POSES[key].ay + ') 尺寸 ' + POSES[key].w + '×' + POSES[key].h);
    }
    const shown = (im) => !!im && im.style.display !== 'none';
    ok(shown(byKey.idle) && !shown(byKey.work) && !shown(byKey.done), '初始只显示 idle（另两张 display:none，不重新解码也不闪烁）');

    // ① 跟着 DSH 干活状态
    fakeSessions.setRunning(true);
    pump(3, 16.7);
    ok(!shown(byKey.idle) && shown(byKey.work), 'DSH 在跑 → 立刻换成 work（在忙）姿态');
    fakeSessions.setRunning(false);
    pump(3, 16.7);
    ok(shown(byKey.done) && !shown(byKey.work), 'DSH 跑完 → 换成 done（干完了）姿态');
    pump(200, 16.7);   // 3.3s > doneMs 2.5s
    ok(shown(byKey.idle) && !shown(byKey.done), 'done 停留结束 → 回到 idle');

    // ② 切到"跟着甩动"，并且顺带验证设置页按钮真的接上了
    const stree = regs.find((r) => r.name === 'settings.section').component({});
    const clicked = clickByText(stree, '跟着甩动');
    ok(clicked, '设置页里有「跟着甩动」按钮且能点');
    fakeSessions.setRunning(true);            // DSH 在跑也不该影响"跟着甩动"模式
    pump(3, 16.7);
    ok(shown(byKey.idle), '"跟着甩动"模式下不再跟随 DSH 状态（仍是 idle）');
    move(1500, 900);                          // 猛甩一下
    pump(2, 16.7);
    ok(shown(byKey.work), '猛甩 → work（手忙脚乱）');
    // 低阻尼下她会荡好几秒，所以这里"边跑边看"有没有出现过 done，再等到回 idle
    let sawDone = false;
    for (let i = 0; i < 400 && !sawDone; i++) { pump(1, 16.7); if (shown(byKey.done)) sawDone = true; }
    ok(sawDone, '荡稳之后 → done（喘口气）');
    let backIdle = false;
    for (let i = 0; i < 400 && !backIdle; i++) { pump(1, 16.7); if (shown(byKey.idle)) backIdle = true; }
    ok(backIdle, 'done 停留结束 → 回到 idle');
  }

  // 缓甩（真·轻缓：约 420px/s，远低于甩飞阈值 1400）→ 不该尖叫
  // 注：v8 起气泡也由「相对速度」触发，所以"缓甩"必须先等她彻底静下来
  const settingsTree = regs.find((r) => r.name === 'settings.section').component({});
  move(300, 700);
  for (let i = 0; i < 600; i++) { pump(1, 16.7); }   // 先荡稳
  bubble.textContent = '';
  let maxDeg = 0;
  for (let i = 0; i < 6; i++) {
    move(300 + 7 * (i + 1), 700);
    pump(1, 16.7);
    const m = /rotate\((-?[\d.]+)\)/.exec(whaleG.attrs.transform || '');
    if (m) maxDeg = Math.max(maxDeg, Math.abs(parseFloat(m[1])));
  }
  ok(maxDeg <= 58.01, '缓甩时倾角不会翻跟头（最大 ' + maxDeg.toFixed(1) + '°）');

  const bubbleEl = bubble;
  ok(!/啊/.test(bubbleEl.textContent || ''), '缓甩不喊尖叫（' + (bubbleEl.textContent || '（没说话）') + '）');
  const normalSize = parseFloat(bubbleEl.style.fontSize || '0');
  ok(normalSize === 0 || normalSize < 40, '缓甩时气泡是小字或不冒泡（' + (normalSize || '未冒泡') + '）');

  // ------------------------------------------------------------
  // [v8] 回归测试：这条就是用户报的 bug
  //   「被甩出去好远却没有大气泡尖叫」
  //   手法：匀速快拖（速度大、加速度≈0）然后**完全停手不再发 mousemove**，
  //   在她惯性滑行的那段时间里检查有没有冒泡/尖叫。
  // ------------------------------------------------------------
  console.log('');
  console.log('[4.8] 回归：匀速快拖 + 停手后惯性滑行，必须冒泡（v8 修的 bug）');
  {
    // 把气泡冷却调到最小，否则"停手后"的窗口会被上一次的冷却盖住（测不出来）
    ok(setSlider(settingsTree, '气泡冷却上限', 800), '测试可以直接拖设置页滑块（气泡冷却 → 0.8s）');
    move(300, 700);
    pump(400, 16.7);                 // 等冷却 + 荡稳
    bubble.textContent = '';
    // 匀速快拖：每帧 55px ≈ 3300px/s —— 速度大但加速度≈0（老逻辑在这里永远不触发）
    let duringDrag = '', dragSize = 0;
    for (let i = 0; i < 30; i++) {
      move(300 + 55 * (i + 1), 700);
      pump(1, 16.7);
      if (bubble.textContent) { duringDrag = bubble.textContent; dragSize = parseFloat(bubble.style.fontSize || '0'); }
    }
    // 关键：停手！此后**不再发任何 mousemove**，只泵帧 —— 她在惯性滑行
    bubble.textContent = '';
    let flewBubble = '', flewSize = 0;
    for (let i = 0; i < 240 && !flewBubble; i++) {
      pump(1, 16.7);
      if (bubble.textContent) { flewBubble = bubble.textContent; flewSize = parseFloat(bubble.style.fontSize || '0'); }
    }
    console.log('    拖动中: ' + (duringDrag ? '「' + duringDrag + '」' + dragSize.toFixed(0) + 'px' : '（还没冒）'));
    console.log('    停手后滑行: ' + (flewBubble ? '「' + flewBubble + '」' + flewSize.toFixed(0) + 'px' : '（一个泡都没有）'));
    ok(!!duringDrag || !!flewBubble, '匀速快拖期间冒泡（老逻辑只认加速度，这里不冒）');
    ok(!!flewBubble, '★停手之后（惯性滑行、无 mousemove 事件）仍然冒泡 —— 这就是 v8 修的 bug');
    ok(flewSize >= 13, '滑行期冒的泡不小（' + flewSize.toFixed(0) + 'px，力度越大字越大）');
  }

  // [v8] 回归：切回窗口/指针重新进入，不该误报尖叫
  {
    bubble.textContent = '';
    for (let i = 0; i < 900; i++) {    // 先等她彻底静下来（否则滑行期的气泡会干扰判断）
      pump(1, 16.7);
      if (bubble.textContent) { bubble.textContent = ''; }
      if (i > 400 && !bubble.textContent) break;
    }
    bubble.textContent = '';
    // 模拟"切走又切回"：失焦 → 再聚焦，然后回窗口的第一个事件（坐标跳很远）
    (winListeners.get('blur') || []).forEach((f) => f({}));
    (winListeners.get('focus') || []).forEach((f) => f({}));
    move(1500, 300);
    pump(3, 16.7);
    const afterEnter = bubble.textContent;
    ok(!afterEnter || !/啊/.test(afterEnter), '切回窗口不误报尖叫（' + (afterEnter || '（安静）') + '）');
    // 而且她应该"已经在位"了（吸附），不该被瞬移的指针拽飞
    const pm = /translate\((-?[\d.]+),(-?[\d.]+)\)/.exec(whaleG.attrs.transform || '');
    const bx2 = parseFloat(pm[1]), by2 = parseFloat(pm[2]);
    ok(Math.abs(bx2 - 1500) < 15 && Math.abs(by2 - (300 + 83)) < 25,
      '切回窗口后她已吸附在位（' + bx2.toFixed(0) + ',' + by2.toFixed(0) + '）而不是被假猛拽甩出去');
  }

  // 松手静置：应当回落到锚点下方并趋于静止
  move(900, 500);
  pump(300, 16.7);
  const m2 = /translate\((-?[\d.]+),(-?[\d.]+)\)/.exec(whaleG.attrs.transform || '');
  if (m2) {
    const bx = parseFloat(m2[1]), by = parseFloat(m2[2]);
    ok(Math.abs(bx - 900) < 12, '静止后横向回到鼠标附近（Δx=' + (bx - 900).toFixed(1) + 'px）');
    ok(by - 500 > 20 && by - 500 < 260, '静止后悬在鼠标下方 ' + (by - 500).toFixed(0) + 'px（绳长+重力沉降）');
  } else {
    ok(false, '静止后 transform 可解析', whaleG.attrs.transform);
  }
  ok(line.attrs.x1 !== undefined && line.attrs.y2 !== undefined && !/NaN/.test(String(line.attrs.x1) + String(line.attrs.y2)), '吊线端点被逐帧更新且无 NaN');

  console.log('');
  console.log('[5] 暴甩 → 尖叫气泡（字号随力度长大）');
  pump(225, 16.7);                 // 让冷却过去
  bubble.textContent = '';
  move(1800, 500);
  pump(1, 16.7);
  move(1800, 900);
  pump(1, 16.7);
  const screamText = bubble.textContent;
  const screamSize = parseFloat(bubble.style.fontSize || '0');
  // 从产物里读尖叫池（用户要求：巨大惯性甩飞时要有"求饶 / 哭唧唧"的大气泡）
  const screamRaw = (code.match(/const SCREAM_QUOTES = \[([\s\S]*?)\n\t\t\];/) || [, ''])[1];
  const screamPool = screamRaw.split('\n').map((s) => (s.match(/'([^']+)'/) || [])[1]).filter(Boolean);
  ok(screamPool.length >= 12, '尖叫池扩容到 ' + screamPool.length + ' 条（原 3 条）');
  ok(screamPool.filter((s) => /求|饶命|我错了|别甩|招了/.test(s)).length >= 4, '里面有「求饶」系台词');
  ok(screamPool.filter((s) => /呜|哭|吐了|呆毛/.test(s)).length >= 4, '里面有「哭唧唧」系台词');
  ok(screamPool.indexOf(screamText) >= 0, '暴甩喊的是尖叫池里的句子：「' + screamText + '」', screamText);
  ok(screamSize > normalSize * 2, '尖叫字号明显变大（' + normalSize + 'px → ' + screamSize + 'px）');
  const capSize = META.ch * S * 0.95;
  ok(screamSize > 90 && screamSize <= capSize + 0.5,
    '尖叫字号很大且不超过"和她一样大"的上限（' + screamSize.toFixed(0) + 'px ≤ 上限 ' + capSize.toFixed(0) + 'px；长句会按字数自动收一点以免顶出屏幕）');

  console.log('');
  console.log('[6] 平静之后补一句求饶/卖萌/生气');
  {
    // 安静下来：不再动鼠标，等物理平复 + 台词冷却过去
    let calmSeen = '', calmSize = 0, seenAt = 0;
    const t0 = nowMs;
    for (let i = 0; i < 600 && !calmSeen; i++) {
      pump(1, 16.7);
      const fs2 = parseFloat(bubble.style.fontSize || '0');
      if (bubble.textContent && bubble.textContent !== screamText && fs2 <= 14) {
        calmSeen = bubble.textContent; calmSize = fs2; seenAt = nowMs - t0;
      }
    }
    console.log('    平静台词在甩完 ' + (seenAt / 1000).toFixed(1) + 's 后出现：「' + calmSeen + '」');
    ok(!!calmSeen, '安静下来后补了一句平静台词：「' + calmSeen + '」');
    ok(calmSize <= 14, '平静台词恢复小字（' + calmSize + 'px）');
    ok(seenAt > 500 && seenAt < 8000, '出现时机合理（' + (seenAt / 1000).toFixed(1) + 's）');
  }

  console.log('');
  console.log('[7] 手感曲线（初始猛拽 → 甩飞 → 收敛）');
  {
    const bait = () => {
      const q = /translate\((-?[\d.]+),(-?[\d.]+)\)/.exec(whaleG.attrs.transform || '');
      return { x: parseFloat(q[1]), y: parseFloat(q[2]) };
    };
    const offsetFrom = (ax, ay) => { const b = bait(); return Math.hypot(b.x - ax, b.y - ay); };

    move(400, 500);
    pump(300, 16.7);
    const rest = offsetFrom(400, 500);

    // 猛拽：鼠标瞬间平移 600px，随后不动
    move(1000, 500);
    pump(1, 16.7);
    const peak = offsetFrom(1000, 500);
    const curve = [];
    for (let i = 0; i < 300; i++) { pump(1, 16.7); curve.push(offsetFrom(1000, 500)); }
    // "甩飞"= 最初那一下之后，又荡出去多远（取前 2 秒内的最大偏移）
    let fling = 0;
    for (let i = 3; i < 120; i++) fling = Math.max(fling, curve[i]);

    console.log('    静息悬挂 ' + rest.toFixed(1) + 'px  →  猛拽峰值 ' + peak.toFixed(1) + 'px');
    console.log('    曲线：' + [0, 4, 9, 19, 39, 79, 149, 299].map((i) => curve[i].toFixed(0) + 'px').join(' → '));
    console.log('    荡出去最远 ' + fling.toFixed(0) + 'px（静息的 ' + (fling / rest).toFixed(1) + ' 倍）—— 这就是"甩飞"');
    ok(peak > 300, '猛拽瞬间被拽得很远（' + peak.toFixed(0) + 'px）—— 初始拉力大');
    ok(fling > rest * 2, '甩完确实被甩飞出去（' + fling.toFixed(0) + 'px = 静息的 ' + (fling / rest).toFixed(1) + ' 倍）');
    ok(Math.abs(curve[299] - rest) < 12, '最终收回静息悬挂（' + curve[299].toFixed(1) + 'px ≈ ' + rest.toFixed(1) + 'px）');

    // 匀速拖拽：只剩一点点软软的尾巴
    move(400, 500); pump(300, 16.7);
    for (let i = 0; i < 80; i++) { move(400 + 20 * (i + 1), 500); pump(1, 16.7); }
    const dragOffset = offsetFrom(400 + 20 * 80, 500);
    console.log('    匀速拖拽（1200px/s）时的拖尾距离 ' + dragOffset.toFixed(1) + 'px');
    ok(dragOffset < rest + 60, '匀速拖拽只拖出一点点（' + dragOffset.toFixed(0) + 'px）—— 跟手');

    // 极端一记：甩 1500px，最后也要回来
    move(900, 500); pump(300, 16.7);
    move(2400, 500);
    let worst = 0;
    for (let i = 0; i < 400; i++) { pump(1, 16.7); worst = Math.max(worst, offsetFrom(2400, 500)); }
    const after = offsetFrom(2400, 500);
    console.log('    极端甩动（1500px）峰值 ' + worst.toFixed(0) + 'px → 收尾 ' + after.toFixed(0) + 'px');
    ok(worst < 2600, '极端甩动不会失控飞走（峰值 ' + worst.toFixed(0) + 'px）');
    ok(Math.abs(after - rest) < 12, '极端甩动后照样收回静息悬挂（' + after.toFixed(0) + 'px）');
  }

  console.log('');
  console.log('[7.5] 闲置小剧场（吊鲸鱼 / 钓鱼佬 / 空军）');
  {
    // 从产物里把台词池读出来（顺便验证它真的被打包进去了）
    const raw = (code.match(/const IDLE_QUOTES = \[([\s\S]*?)\n\t\t\];/) || [, ''])[1];
    const pool = raw.split('\n').map((s) => (s.match(/'([^']+)'/) || [])[1]).filter(Boolean);
    ok(pool.length === 20, '台词池 20 条', '实际 ' + pool.length + ' 条');
    ok(pool.filter((s) => /空军|钓鱼佬|竿|钓/.test(s)).length >= 14, '绝大多数围绕钓鱼佬/空军/吊鲸鱼主题');
    ok(pool.some((s) => /可爱|摸摸|卖萌|好不好|呀～|哦/.test(s)), '有卖萌系台词');

    // 鼠标不动，等它自己开演（先跑 5 秒让上一次"平静台词"过掉）
    pump(300, 16.7);
    let first = '';
    for (let i = 0; i < 900 && !first; i++) {
      pump(1, 16.7);
      if (pool.indexOf(bubble.textContent) >= 0) first = bubble.textContent;
    }
    ok(!!first, '鼠标停下后自己开演：「' + first + '」');
    ok(parseFloat(bubble.style.fontSize) <= 14, '小剧场用小字（' + bubble.style.fontSize + '）');

    let second = '';
    for (let i = 0; i < 900 && !second; i++) {
      pump(1, 16.7);
      const t = bubble.textContent;
      if (t !== first && pool.indexOf(t) >= 0) second = t;
    }
    ok(!!second, '隔一会儿又说下一句：「' + second + '」（而且不跟上一句重复）');

    // 从"鼠标刚停下"开始计时，量一下到底等多久才开演
    move(1500, 700);
    const tMove = nowMs;
    bubble.textContent = '';                 // 清干净，免得读到上一次的残留
    let third = '';
    for (let i = 0; i < 1200 && !third; i++) {
      pump(1, 16.7);
      if (pool.indexOf(bubble.textContent) >= 0) third = bubble.textContent;
    }
    const waited = (nowMs - tMove) / 1000;
    console.log('    从"鼠标停下"到开演：' + waited.toFixed(1) + 's（默认 6s 起步、间隔 7s）');
    ok(!!third, '再次停下后照样开演：「' + third + '」');
    ok(waited >= 5 && waited < 30, '开演时机合理（' + waited.toFixed(1) + 's）');

    // 鼠标一动 → 小剧场闭嘴
    move(1600, 700);
    const tMove2 = nowMs;
    let spokeAfterMove = false;
    for (let i = 0; i < 200; i++) {          // 3.3s < idleStart(6s)
      pump(1, 16.7);
      if (pool.indexOf(bubble.textContent) >= 0 && bubble.textContent !== third) spokeAfterMove = true;
    }
    ok(!spokeAfterMove, '鼠标一直在动就不开演（' + ((nowMs - tMove2) / 1000).toFixed(1) + 's 内没说话）');
  }

  console.log('');
  console.log('[8] 保命：Alt+Esc 还回系统光标');
  const keydown = winListeners.get('keydown') || [];
  try {
    keydown.forEach((f) => f({ key: 'Escape', altKey: true }));
    ok(!documentStub.documentElement.classList.contains('dsh-rod-cursor-none'), 'Alt+Esc 之后系统光标已恢复');
    const saved = JSON.parse(win.localStorage.getItem('dsh-whale-rod-cursor.settings') || '{}');
    ok(saved.mode === 'attach', '设置已落盘为真光标模式（mode=' + saved.mode + '）');
  } catch (e) {
    ok(false, 'Alt+Esc 处理不抛异常', e.message);
  }

  // 设置页
  try {
    const s = regs.find((r) => r.name === 'settings.section').component({});
    ok(!!s, '设置页渲染不抛异常');
  } catch (e) {
    ok(false, '设置页渲染不抛异常', e.message);
  }
  cleanups.forEach((c) => { try { c(); } catch (e) { /* ignore */ } });
  ok(!documentStub.documentElement.classList.contains('dsh-rod-cursor-none'), '组件卸载后系统光标仍然可见（安全网）');
}

console.log('');
console.log('===========================================');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('===========================================');
process.exit(fail ? 1 : 0);
