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
// [v15.1] 素材目录不再写死 H 盘（工作区能搬家：路径按脚本位置推）
const PP = require('./lib/portable-paths.cjs');
const ASSET_DIR = PP.ASSET_DIR;
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
// [v15] 性能自检要用：数一数插件到底往 DOM 写了多少次。
//   每次 setAttribute / style 写入都会让浏览器重算样式；用户明确要求
//   "这是鼠标，不能影响鼠标性能"，所以"静息时几乎不写"这件事必须能测出来。
const DOMSTAT = {
  attrs: 0, styles: 0, classes: 0,
  reset() { this.attrs = 0; this.styles = 0; this.classes = 0; },
  get total() { return this.attrs + this.styles + this.classes; },
};

function fakeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    attrs: {}, children: [], textContent: '', offsetWidth: 0, id: '',
    // styles 通过 defineProperty 计数（插件写 style.transform 的地方）
    style: (function () {
      const st = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } };
      let _text = '';
      Object.defineProperty(st, 'cssText', {
        set(v) {
          _text = v;
          DOMSTAT.styles++;
          // 真 DOM 会把声明解析成属性（插件用 cssText 设 position/z-index 等，测试要能读回来）
          String(v).split(';').forEach((piece) => {
            const i = piece.indexOf(':');
            if (i > 0) st[piece.slice(0, i).trim()] = piece.slice(i + 1).trim();
          });
        },
        get() { return _text; },
      });
      Object.defineProperty(st, 'transform', {
        set(v) { DOMSTAT.styles++; Object.defineProperty(st, '_tf', { value: v, writable: true, configurable: true }); },
        get() { return st._tf; },
      });
      Object.defineProperty(st, 'display', {
        set(v) { DOMSTAT.styles++; Object.defineProperty(st, '_dp', { value: v, writable: true, configurable: true }); },
        get() { return st._dp; },
      });
      Object.defineProperty(st, 'fontSize', {
        set(v) { DOMSTAT.styles++; Object.defineProperty(st, '_fs', { value: v, writable: true, configurable: true }); },
        get() { return st._fs; },
      });
      return st;
    })(),
    classList: {
      _s: new Set(),
      add(c) { DOMSTAT.classes++; this._s.add(c); },
      remove(c) { DOMSTAT.classes++; this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      // 真 DOM 的 toggle 支持第二个"强制"参数（插件用它开/关），假 DOM 必须跟上
      toggle(c, force) {
        DOMSTAT.classes++;
        const on = (force === undefined) ? !this._s.has(c) : !!force;
        if (on) this._s.add(c); else this._s.delete(c);
        return on;
      },
    },
    setAttribute(k, v) { DOMSTAT.attrs++; this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    // [v9] 真实 DOM 会给 appendChild 自动带上 parentNode —— 这里照做，
    //      因为"顶层容器搬运"要靠 parentNode 判幂等，不模拟就测不出来。
    appendChild(c) {
      if (c && typeof c === 'object') {
        if (c.parentNode && typeof c.parentNode.removeChild === 'function') c.parentNode.removeChild(c);
        c.parentNode = this;
      }
      // 真实 DOM 的同一个节点不可能在同处出现两次；重复 push 就是 bug，别掩盖
      if (this.children.indexOf(c) < 0) this.children.push(c);
      return c;
    },
    removeChild(c) {
      this.children = this.children.filter((x) => x !== c);
      if (c && typeof c === 'object') c.parentNode = null;
      return c;
    },
    contains(c) {
      if (c === this) return true;
      return this.children.some((k) => k && typeof k.contains === 'function' && k.contains(c));
    },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    matches() { return false; },              // 假 DOM 不实现选择器（真实浏览器里才有）
    querySelectorAll() { return []; },        // 同上：插件必须容得下"没有选择器"
    addEventListener() {}, removeEventListener() {},
  };
  return el;
}

const head = fakeEl('head');
const bodyEl = fakeEl('body');
const htmlEl = fakeEl('html');
htmlEl.appendChild(head);
htmlEl.appendChild(bodyEl);

/** 假 DOM 里按 id 找节点（真实 getElementById 不挑位置，这里也全树找）。 */
function findById(node, id) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === id) return node;
  for (const k of (node.children || [])) { const hit = findById(k, id); if (hit) return hit; }
  return null;
}
const documentStub = {
  head,
  body: bodyEl,
  documentElement: htmlEl,
  hidden: false,
  createElement: (t) => fakeEl(t),
  getElementById: (id) => findById(htmlEl, id),
  querySelectorAll: () => [],     // 真浏览器才有；插件读不到时必须安全退化
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
  setInterval: (fn, ms) => { win.setInterval._calls = (win.setInterval._calls || 0) + 1; const t = setInterval(fn, ms); if (t.unref) t.unref(); return t; },
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
let frameCount = 0;      // [v15] pump 过的帧数（性能自检要看"心跳相位"）

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
ok(VER && VER.includes('v15'), '版本戳是 v15（本次改动生效的那版）', VER);
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
  ok(saved.pv === 4, '设置已标记台词池版本 pv=4（升级后自动落盘）');
  ok(Array.isArray(saved.screamQuotes) && saved.screamQuotes.length >= 12,
    '老尖叫池被合并扩容：' + (saved.screamQuotes || []).length + ' 条（合并前 3 条）');
  ok(saved.screamQuotes.indexOf('啊啊啊啊啊——') >= 0 && saved.screamQuotes.some((s) => /求|呜呜|哭/.test(s)),
    '既有老台词又拿到了新的求饶/哭唧唧台词');
  ok(saved.quotes.indexOf('我自己加的一句') >= 0, '用户自己加的台词被保留（没被覆盖）');
  ok(saved.quotes.length > 2, '普通语录池也合并了新版默认台词（' + saved.quotes.length + ' 条）');
  // ---- [v10] 破防四档的新池子也得能"并进老存档" ----
  ok(Array.isArray(saved.break2Quotes) && saved.break2Quotes.length >= 4,
    '② 求饶池随 v10 一并写入老存档：' + (saved.break2Quotes || []).length + ' 条');
  ok(Array.isArray(saved.break3Quotes) && saved.break3Quotes.length >= 4,
    '③ 破防池随 v10 一并写入：' + (saved.break3Quotes || []).length + ' 条');
  ok(Array.isArray(saved.sulkQuotes) && saved.sulkQuotes.length >= 2,
    '④ 摆烂池随 v10 一并写入：' + (saved.sulkQuotes || []).length + ' 条');
  ok(Array.isArray(saved.recoverQuotes) && saved.recoverQuotes.length >= 2,
    '撒娇池随 v10 一并写入：' + (saved.recoverQuotes || []).length + ' 条');
  ok(saved.breakOn === true && saved.breakSulkOn === true, '破防模式 / 摆烂开关默认开启并落盘');
  ok(saved.break2At < saved.break3At && saved.break3At < saved.break4At,
    '档位门槛递增：' + saved.break2At + ' < ' + saved.break3At + ' < ' + saved.break4At);
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
      q.forEach((cb) => { frameCount++; cb(nowMs); });   // [v15] 顺便数帧（性能自检用）
    }
  }
  const move = (x, y) => winListeners.get('mousemove').forEach((f) => f({ clientX: x, clientY: y, target: null }));

  // [v15] 性能自检要"对齐心跳相位"：插件每 30 帧会放一帧过去（心跳），
  // 所以测量前先把帧计数对齐到 30 的倍数，测出来的才是"纯静息"的开销。
  function alignHeartbeat() {
    const need = (30 - (frameCount % 30)) % 30;
    for (let i = 0; i < need; i++) { nowMs += 16.7; pump(1, 16.7); }
  }

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
  // 字号规则（v14 起按公式验，不再拍脑袋定阈值）：
  //   期望 = min(和鲸鱼娘一样高, 13 × 力度^1.25)，再按字数夹一次防顶出屏幕
  const capSize = META.ch * S * 0.95;
  const capByWidth = (1920 * 0.9) / (String(screamText).length + 1);
  const expectMax = Math.min(capSize, capByWidth);
  ok(screamSize > normalSize * 2.5 && screamSize <= expectMax + 0.5,
    '尖叫字号落在合理区间（' + screamSize.toFixed(0) + 'px；上限 min(身高 ' + capSize.toFixed(0)
    + ', 屏幕宽度夹 ' + capByWidth.toFixed(0) + ') = ' + expectMax.toFixed(0) + 'px）');

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
    ok(pool.length >= 30, '台词池已扩容（≥30 条，v11 加了腹黑池）', '实际 ' + pool.length + ' 条');
    ok(pool.filter((s) => /空军|钓鱼佬|竿|钓|鱼护|抛竿/.test(s)).length >= 14, '绝大多数围绕钓鱼佬/空军/吊鲸鱼主题');
    ok(pool.some((s) => /可爱|摸摸|卖萌|好不好|呀～|哦/.test(s)), '有卖萌系台词');
    ok(pool.filter((s) => /数了下|小鱼问我|很努力的人|没有别的事|没发现自己是空军|遛鼠标|给你数|手速|专业钓鱼佬|很没用|看戏/.test(s)).length >= 8,
      'v11 补了腹黑嘲讽池（≥8 条）');

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
  // ---------------------------------------------------------------- [9] v9 弹窗层级
  // 用户 2026-09-18 反馈：点「会话重命名」后弹窗里的鱼竿被盖住，只能盲操。
  // 根因：官方 Modal 是 createPortal 到 document.body（z-index:1000），
  //       我们的宿主却挂在 shell.overlay 槽位里（深处 #root 祖先链，
  //       祖先的 overflow:hidden / transform 之类会毁掉 fixed + 高 z-index）。
  // 断言要点：宿主必须**真的搬到 body 下的顶层容器里**，且搬完不破坏既有行为。
  console.log('');
  console.log('[9] v9 弹窗层级：鱼竿层搬进 document.body 顶层容器');

  const appRoot = fakeEl('div');
  appRoot.id = 'root';
  bodyEl.appendChild(appRoot);
  const host0 = tree;                       // 渲染出来的 .dsh-rod-host
  const whereBefore = host0.parentNode;     // 迷你渲染器给它挂的位置（= 槽位容器）
  ok(whereBefore !== bodyEl, '（前置）宿主原本不在 body 下（模拟 shell.overlay 槽位）');
  ok(host0.__dshLifted === true || host0.parentNode !== whereBefore,
    '宿主已被搬出槽位（__dshLifted=' + host0.__dshLifted + '）');

  const topEl = documentStub.getElementById('dsh-rod-cursor-top');
  ok(!!topEl, '创建了顶层容器 #dsh-rod-cursor-top');
  ok(!!topEl && host0.parentNode === topEl, '宿主现在的爹 = 顶层容器');
  ok(!!topEl && topEl.parentNode === bodyEl, '顶层容器挂在 document.body 下（与弹窗同一层叠根）');
  const topCss = String((topEl && topEl.style && topEl.style.cssText) || '');
  ok(/z-index:\s*auto/.test(topCss), '容器自身 z-index:auto（不给自己造新的层叠上下文）');
  ok(/pointer-events:\s*none/.test(topCss), '容器 pointer-events:none（不挡任何点击）');
  ok(!!topEl && topEl.getAttribute('data-dsh-rod-top') === '1', '容器带 data-dsh-rod-top 标记（排查用）');

  // 层级数值：我们 2147483000 > 官方 Modal 的 1000
  const styleEl = documentStub.getElementById('dsh-rod-cursor-style');
  ok(!!styleEl, '<style id="dsh-rod-cursor-style"> 已注入 head');
  const cssText = (styleEl && styleEl.textContent) || '';
  const zRod = /\.dsh-rod-host\s*\{[^}]*z-index:\s*(\d+)/.exec(cssText);
  const Z_MODAL = 1000;   // 官方 Modal 容器：position:fixed; z-index:1000
  ok(!!zRod && Number(zRod[1]) > Z_MODAL, '鱼竿层 z-index ' + (zRod ? zRod[1] : '?') + ' > 弹窗 ' + Z_MODAL);
  ok(/\.dsh-rod-host\s*\{[^}]*pointer-events:\s*none/.test(cssText), '鱼竿层仍然 pointer-events:none（不挡操作）');
  ok(/\.dsh-rod-host\s*\{[^}]*position:\s*fixed/.test(cssText), '鱼竿层仍然是 position:fixed（铺满视口）');

  // 幂等：再搬一次不许出现重复节点
  const kidsBefore = topEl.children.length;
  const hook = win.__WHALE_ROD_TEST__;
  ok(!!hook && typeof hook.liftHost === 'function' && hook.LIFT_ID === 'dsh-rod-cursor-top',
    '暴露了 __WHALE_ROD_TEST__ 窄接口（供自检验证幂等/清理）');
  try {
    const moved2 = hook ? hook.liftHost(host0) : false;
    ok(moved2 === false, '已在顶层容器里 → liftHost 返回 false（不做无用搬运）');
    ok(host0.parentNode === topEl && topEl.children.length === kidsBefore,
      '重复搬运是幂等的（容器里还是 ' + topEl.children.length + ' 个孩子）');
    ok(hook.liftCount() === kidsBefore, 'liftCount() 读到的孩子数 = ' + hook.liftCount());
  } catch (e) {
    ok(false, '重复搬运不抛异常', e.message);
  }

  // 全屏兜底：没有选择器 API 时必须安静退化（不能因为读不到就崩）
  try {
    const evs = winListeners.get('fullscreenchange') || [];
    ok(evs.length > 0, '注册了 fullscreenchange 监听（全屏兜底）');
    evs.forEach((f) => f({}));
    ok(true, 'fullscreenchange 回调在"没有选择器 API"的假 DOM 里也不抛异常');
    ok(host0.parentNode === topEl, '全屏事件过后宿主仍在顶层容器里');
  } catch (e) {
    ok(false, 'fullscreenchange 回调不抛异常', e.message);
  }

  // ---------------------------------------------------------------- [10] v10 破防四档
  // 破防机是关在 effect 闭包里的，所以 v10 在宿主上开了一扇窄门（__dshBreakTest）：
  // 直接"记一次猛甩"来驱动 —— 比"真的拼手速甩鼠标 + 等真实时间"那种写法可靠得多。
  console.log('');
  console.log('[10] v10 破防四档：①晃晕 → ②求饶 → ③破防 → ④摆烂罢工');

  const bk = tree.__dshBreakTest;
  const save = win.__WHALE_ROD_TEST__ && win.__WHALE_ROD_TEST__.saveSettings;
  const savedNow = () => JSON.parse(win.localStorage.getItem('dsh-whale-rod-cursor.settings') || '{}');
  let MUTSET = Object.assign({}, OLD_SETTINGS, savedNow());
  // [v13] 台词池判定：**直接问插件的活池子**（用户存档 + 已合并的默认台词）。
  // 早先用 localStorage 里的旧存档判池子，会漏掉 v10+ 新增的台词 → 断言误判。
  const livePools = () => (win.__WHALE_ROD_TEST__ && win.__WHALE_ROD_TEST__.pools) ? win.__WHALE_ROD_TEST__.pools() : savedNow();
  const POOL_NAMES = [['②求饶', 'break2Quotes'], ['③破防', 'break3Quotes'], ['④脱钩', 'sulkQuotes'],
    ['撒娇', 'recoverQuotes'], ['尖叫', 'screamQuotes'], ['普通', 'quotes'], ['平静', 'calmQuotes'], ['小剧场', 'idleQuotes']];
  const poolOf = (text) => {
    if (!text) return '';
    const pools = livePools();
    for (const [name, key] of POOL_NAMES) if ((pools[key] || []).indexOf(text) >= 0) return name;
    return '?';
  };
  const lastText = () => String(bubble.textContent || '');
  const setBubble = (v) => { bubble.textContent = v; };

  ok(!!bk && typeof bk.yank === 'function' && typeof bk.state === 'function',
    '宿主上开了窄门 __dshBreakTest（自检专用，运行时不用它）');

  if (bk && save) {
    try {
      // 全套参数都显式设定，避免依赖默认值（默认值另有一组断言）
      // 注意：窗口设得很大（20s）→ 各阶段之间不会被滚动窗口踢掉，断言才稳
      save({ breakWindowMs: 20000, break2At: 2, break3At: 4, break4At: 6,
        break2CoolMs: 1000, break3CoolMs: 1000, break4CoolMs: 5000, sulkMs: 60000, shakeMs: 1000 });
      MUTSET = Object.assign({}, MUTSET, savedNow());
      nowMs += 60000; pump(3, 16.7);     // 时间往前走远：所有冷却过期、档位归零

      // ---- ① 晃晕：只记一次，不够 ② 的门槛 ----
      setBubble('');
      bk.yank();
      ok(bubble.textContent === '' && bk.state().tier === 0,
        '① 晃晕档只计计数、不额外说话（tier=' + bk.state().tier + '，计数 ' + bk.state().count + '）');

      // ---- ② 求饶 ----
      bk.yank();     // 第 2 次 = 到 ② 门槛
      ok(poolOf(lastText()) === '②求饶', '② 求饶档：「' + lastText() + '」');
      ok(parseFloat(bubble.style.fontSize) > 13, '求饶台词字号比平时大（' + bubble.style.fontSize + '）');
      ok(bk.state().tier === 2, '② 档 → tier=' + bk.state().tier);

      setBubble('');
      bk.yank();     // 第 3 次：② 冷却中，且没到 ③ 门槛 → 不说话
      ok(bubble.textContent === '', '② 档冷却中不重复说（不刷屏）');

      // ---- ③ 破防 ----
      setBubble('');
      bk.yank();     // 第 4 次 = 到 ③ 门槛
      ok(poolOf(lastText()) === '③破防', '③ 破防档骂人了：「' + lastText() + '」');
      ok(bk.state().tier === 3, '③ 档 → tier=' + bk.state().tier);
      ok(bk.state().shaking === true, '③ 档开始发抖（剩 ' + bk.state().shakeLeftMs + 'ms）');

      pump(1, 16.7);   // 让发抖生效
      const tf = whaleG.getAttribute('transform');
      ok(typeof tf === 'string' && /^translate\(-?[\d.]+,-?[\d.]+\) rotate\(-?[\d.]+\) scale\(/.test(tf),
        '③ 档发抖只是渲染层微位移，transform 结构没被算坏');

      // ---- ④ 摆烂 ----
      setBubble('');
      bk.yank();     // 第 5 次：还没到 ④ 门槛
      ok(bk.state().sulking === false && bk.state().tier === 3,
        '④ 门槛前不摆烂（计数 ' + bk.state().count + ' < ' + MUTSET.break4At + '）');
      bk.yank();     // 第 6 次 = 到 ④ 门槛
      const st4 = bk.state();
      ok(st4.sulking === true && st4.tier === 4, '④ 摆烂档触发（tier=' + st4.tier + '，装死中）');
      ok(poolOf(lastText()) === '④脱钩', '罢工宣言：「' + lastText() + '」');

      pump(1, 16.7);   // 跑一帧，让虚线绳的 class 落上去
      ok(!!line && line.classList.contains('dsh-rod-line-slack'), '线先是"松了"的虚线（class dsh-rod-line-slack）');
      ok(/\.dsh-rod-line-slack\s*\{[^}]*stroke-dasharray/.test(cssText), '虚线样式确实注入了 <style>');

      // ---- [v12] 真脱钩：线整条藏掉 + 竿尖留断线头 + 她往下沉 + 你怎么甩都拉不动 ----
      const svgEl = tree.children.find((c) => c.tagName === 'SVG');
      const mainLine = (svgEl.children || []).find((c) => c.className === 'dsh-rod-line');
      const stubLine = (svgEl.children || []).find((c) => /dsh-rod-stub/.test(c.className || ''));
      const yOf = () => parseFloat((/translate\((-?[\d.]+),(-?[\d.]+)\)/.exec(whaleG.getAttribute('transform')) || [, '', ''])[2]);
      const xOf = () => parseFloat((/translate\((-?[\d.]+),/.exec(whaleG.getAttribute('transform')) || [, ''])[1]);
      ok(!!stubLine, '[v12] 渲染出了"断线头"元素（dsh-rod-stub）');
      ok(MUTSET.sulkDetach === true, '[v12] 设置里 sulkDetach 默认开启（真脱钩）');
      ok(!!mainLine && mainLine.classList.contains('dsh-rod-line-gone'),
        '[v12] 脱钩：整条鱼线淡出（class dsh-rod-line-gone）—— "钩子空了"');
      ok(((stubLine && stubLine.style && stubLine.style.display) || '') !== 'none', '[v12] 断线头显示出来（挂在竿尖晃）');
      ok(/\.dsh-rod-line-gone\s*\{[^}]*opacity:\s*0/.test(cssText), '[v12] 淡出样式已注入');

      // 先"复位"：结束这次摆烂（用窄门，不等真时长）+ 等摆烂冷却过期
      bk.endSulk(); pump(2, 16.7);
      nowMs += MUTSET.break4CoolMs + 200; pump(3, 16.7);   // 等冷却
      setBubble('');                                        // 清掉罢工宣言，才好验证"脱钩期间不吭声"
      move(700, 120); pump(10, 16.7);                        // 让她先正常悬挂在屏幕上方

      // 步骤①：正常状态下，鼠标移动 → 她**会被拉着走**（对照组，证明"脱钩后拉不动"是真差别）
      move(200, 200); for (let i = 0; i < 25; i++) { nowMs += 16.7; pump(1, 16.7); }
      const nearNormal = Math.hypot(200 - xOf(), 200 - yOf());
      ok(nearNormal < 260, '（对照组）没脱钩时她是跟着鼠标走的（离鼠标 ≈' + nearNormal.toFixed(0) + 'px）');

      // 复位到上方，准备进第二次摆烂
      move(700, 120); for (let i = 0; i < 50; i++) { nowMs += 16.7; pump(1, 16.7); }
      const yStart = yOf();
      let again = false;
      for (let i = 0; i < 12 && !again; i++) { nowMs += 16.7; bk.yank(); again = bk.state().sulking; }
      ok(again === true, '[v12] 等冷却过后能再进一次摆烂（用于验证脱钩行为）');

      // 步骤②：脱钩期间，鼠标不动 → 她自己往下沉
      pump(2, 16.7);
      setBubble('');
      const textAtSulkEntry = bubble.textContent;
      for (let i = 0; i < 90; i++) { nowMs += 16.7; pump(1, 16.7); }
      const textAfterDrift = bubble.textContent;
      const yEnd = yOf();
      ok(isFinite(yStart) && isFinite(yEnd) && yEnd > yStart + 40,
        '[v12] 脱钩后她自己在往下沉（鼠标没动：y ' + yStart.toFixed(0) + ' → ' + yEnd.toFixed(0) + '）');

      // 步骤③：脱钩期间，鼠标瞬移 + 甩动 → 拉不动她、且不再冒新的台词
      const textAtEntry2 = bubble.textContent;
      (winListeners.get('mouseleave') || []).forEach((f) => f({}));
      (winListeners.get('mouseenter') || []).forEach((f) => f({}));
      move(200, 200); move(210, 205);
      const sulkingRightAfter = bk.state().sulking;
      for (let i = 0; i < 25; i++) { nowMs += 16.7; pump(1, 16.7); }
      const distToMouse = Math.hypot(200 - xOf(), 200 - yOf());
      ok(sulkingRightAfter === true, '[v12] 鼠标瞬移的瞬间她仍在脱钩状态');
      ok(distToMouse > 120,
        '[v12] 鼠标瞬移 + 甩动都拉不动她（离鼠标 ≈' + distToMouse.toFixed(0) + 'px）');
      const saidNow = bubble.textContent;
      const noNewScream = saidNow === textAtEntry2 || poolOf(saidNow) === '普通' || poolOf(saidNow) === '尖叫';
      ok(noNewScream || poolOf(saidNow) === '④脱钩',
        '[v12] 脱钩期间没有新台词（进场=「' + textAtEntry2 + '」 现在=「' + saidNow + '」 池=' + poolOf(saidNow) + '）');
      // 收尾：用窄门结束摆烂，后面的用例从干净状态开始
      bk.endSulk(); pump(2, 16.7);
      nowMs += MUTSET.break4CoolMs + 200;
      nowMs += MUTSET.break3CoolMs + 200;
      nowMs += MUTSET.break2CoolMs + 200;
      pump(3, 16.7);
      setBubble('');
      while (bk.state().sulking) { nowMs += 200; pump(2, 16.7); }   // 收尾：让摆烂演完

      // 装死期间：怎么甩都不出声，计数也不涨（此时她一定在 sulking）
      let sulkAgain2 = false;
      for (let i = 0; i < 12 && !sulkAgain2; i++) { nowMs += 16.7; bk.yank(); sulkAgain2 = bk.state().sulking; }
      ok(sulkAgain2 === true, '能再次进摆烂（用于验证"装死期间不吭声"）');
      pump(2, 16.7);
      const cnt0 = bk.state().count;
      const textBefore = bubble.textContent;
      for (let i = 0; i < 5; i++) { nowMs += 16.7; pump(1, 16.7); bk.yank(); }
      ok(bubble.textContent === textBefore, '装死期间怎么甩都不出声（气泡一个字没变）');
      ok(bk.state().count === cnt0 && bk.state().sulking === true, '装死期间连"猛甩计数"都不涨（不升不降）');

      // ---- 装死到点：她回来了（用窄门结束，不等真时长） ----
      bk.endSulk();
      pump(2, 16.7);
      ok(bk.state().sulking === false, '装死到点自动结束（tier 归零）');
      ok(poolOf(lastText()) === '撒娇', '回来撒娇一句：「' + lastText() + '」');
      ok(!!mainLine && !mainLine.classList.contains('dsh-rod-line-gone'),
        '[v12] 线接回来了（淡出 class 摘掉）');
      ok(((stubLine && stubLine.style && stubLine.style.display) || '') === 'none', '[v12] 断线头收起来了');
      setBubble('');

      // ---- [v13] 防回归：这一下"刚好触发脱钩"时，不许先蹦一句普通/尖叫台词再蹦罢工宣言 ----
      // 用户报的原话：「触发了"放我下来"之类的台词，是不是断线状态台词混淆」
      // 根因：老顺序是"先冒泡（说普通/尖叫）→ 再记猛甩（可能当场脱钩）"，
      //       于是那一鞭会连说两句、且**后写的那句未必最后被看见**（普通句 hold 1800ms > 罢工句 4000ms 的显示时长虽长，
      //       但若普通句在罢工句之后写入，屏幕上就是"没断线"的台词）→ 看着像串台。
      // 这里**不清空气泡**，直接看"最后一鞭之后屏幕上显示的是哪句"，才等于用户看到的事实。
      bk.endSulk(); pump(2, 16.7);
      nowMs += 60000;                          // 所有冷却过期
      bk.reset();
      save({ break2At: 2, break3At: 3, break4At: 4, break4CoolMs: 0, break3CoolMs: 0, break2CoolMs: 0 });
      MUTSET = Object.assign({}, MUTSET, savedNow());
      pump(3, 16.7);
      const shown = [];
      for (let i = 0; i < 4; i++) {
        nowMs += 700;
        bk.popBubble(5);                        // 4 次真实冒泡 → 第 4 次应当触发脱钩
        pump(1, 16.7);
        shown.push(poolOf(bubble.textContent) + '「' + bubble.textContent + '」');
      }
      const lastShown = bubble.textContent;
      ok(bk.state().sulking === true, '[v13] 第 4 鞭确实触发了脱钩（前置）');
      ok(poolOf(lastShown) === '④脱钩',
        '[v13] 触发脱钩后屏幕上显示的是"罢工宣言"（实际=「' + lastShown + '」）  序列: ' + shown.join(' → '));
      ok(poolOf(lastShown) !== '普通' && poolOf(lastShown) !== '尖叫' && poolOf(lastShown) !== '②求饶',
        '[v13] 断线瞬间不会再串出「快放我下来」这类"还没断线"的台词');
      // 更要紧的一条：**脱钩那一鞭只说一句** —— 不许"先骂一句 ③ 再断钩"
      // （序列里第 4 项 = 脱钩那一鞭；只要它是 ④脱钩，就说明这一鞭没多说别的）
      const shots = shown.map((s) => s.slice(0, s.indexOf('「')));
      ok(shots[shots.length - 1] === '④脱钩' && shots[shots.length - 2] !== '③破防',
        '[v13] 脱钩那一鞭只说"罢工宣言"（不先骂一句再断钩）  序列: ' + shown.join(' → '));
      bk.endSulk(); pump(2, 16.7);
      save({ break2At: 2, break3At: 4, break4At: 6, break4CoolMs: 5000 });
      MUTSET = Object.assign({}, MUTSET, savedNow());

      // ---- [v14] 用户实测两条：①鼠标不许在"宕机期"操纵她左右 ②沉底要整身可见 ----
      // ① 根因：物理里的 rvy 含 -mvy（鼠标速度），脱钩时它照样把鼠标动作渗进她的运动。
      // ② 根因：边界只让"头顶"贴到屏幕下沿 → 只露三分之一脑袋。
      bk.endSulk(); pump(2, 16.7);
      nowMs += 60000; bk.reset();
      save({ break2At: 2, break3At: 3, break4At: 4, break4CoolMs: 0, break3CoolMs: 0, break2CoolMs: 0, sulkMs: 60000 });
      MUTSET = Object.assign({}, MUTSET, savedNow());
      pump(3, 16.7);
      move(700, 150); pump(5, 16.7);
      let entered14 = false;
      for (let i = 0; i < 6 && !entered14; i++) { nowMs += 700; bk.popBubble(5); entered14 = bk.state().sulking; }
      ok(entered14 === true, '[v14] 先进入脱钩（前置）');
      pump(3, 16.7);
      for (let i = 0; i < 90; i++) { nowMs += 16.7; pump(1, 16.7); }   // 等她自己沉到底
      const x0 = xOf();
      for (let k = 0; k < 20; k++) { move(k % 2 ? 200 : 1700, 300); nowMs += 16.7; pump(1, 16.7); }  // 鼠标大幅横跳
      const x1 = xOf();
      ok(Math.abs(x1 - x0) < 8,
        '[v14] 脱钩宕机期鼠标怎么横跳都不"牵"她（Δx=' + (x1 - x0).toFixed(1) + 'px）');

      const m14 = bk.meta ? bk.meta() : { ch: 170, scale: 0.72 };
      const bodyH14 = m14.ch * (m14.scale || 0.72);
      let lowest = -1e9;
      for (let i = 0; i < 150; i++) { nowMs += 16.7; pump(1, 16.7); lowest = Math.max(lowest, yOf()); }
      ok(lowest + bodyH14 <= 1080 + 0.5,
        '[v14] 沉底时整个身子都在屏内（头顶最低 ' + lowest.toFixed(0) + ' + 身高 ' + bodyH14.toFixed(0)
        + ' = ' + (lowest + bodyH14).toFixed(0) + ' ≤ 视口 1080）');
      let hi = 1e9, lo = -1e9;
      for (let i = 0; i < 150; i++) { nowMs += 16.7; pump(1, 16.7); const y = yOf(); hi = Math.min(hi, y); lo = Math.max(lo, y); }
      const bob = lo - hi;
      ok(bob >= 2 && bob <= 40, '[v14] 沉底后有轻微"浮在水里"的上下晃（幅度 ' + bob.toFixed(1) + 'px）');
      bk.endSulk(); pump(2, 16.7);
      nowMs += 60000; pump(3, 16.7);
      // 收尾：把后面的用例需要的前置状态还原（否则会污染 ④ 冷却那几条断言）
      save({ break2At: 2, break3At: 4, break4At: 6, break4CoolMs: 5000, breakWindowMs: 20000,
        break2CoolMs: 1000, break3CoolMs: 1000, sulkMs: 60000 });
      MUTSET = Object.assign({}, MUTSET, savedNow());
      bk.reset();
      nowMs += 60000; pump(3, 16.7);
      // 特意再进一次脱钩、用窄门结束 → 把"刚脱钩"的 5s 冷却状态摆好，供后面断言使用
      setBubble('');
      let pre = false;
      for (let i = 0; i < 12 && !pre; i++) { nowMs += 16.7; bk.yank(); pre = bk.state().sulking; }
      ok(pre === true, '[v14] 收尾：重新进入一次脱钩（为后续"冷却期内不脱钩"断言摆好前置）');
      bk.endSulk(); pump(2, 16.7);

      // ---- ④ 冷却：冷却期内够次数也不再摆烂 ----
      save({ break4CoolMs: 60000, breakWindowMs: 60000 });
      MUTSET = Object.assign({}, MUTSET, savedNow());
      setBubble('');
      let sulkedAgain = false;
      for (let i = 0; i < 20; i++) { bk.yank(); if (bk.state().sulking) { sulkedAgain = true; break; } }
      ok(sulkedAgain === false, '④ 冷却 60s 内再连甩也不会摆烂（tier=' + bk.state().tier + '）');
      // [v12] 冷却期内的降级：能到 ③ 就骂人，不能就退回 ②/普通 —— 关键是不能摆烂
      // ⚠️ 这里**不要**再推进时钟：④ 的冷却就是"刚摆完"的 60s，推了就过期了（自检里翻过车）
      save({ break4CoolMs: 60000, break3CoolMs: 1000, break2CoolMs: 1000 });
      MUTSET = Object.assign({}, MUTSET, savedNow());
      bk.reset();
      nowMs += 1500; pump(3, 16.7);        // 只让 ②③ 的小冷却过期（远小于 ④ 的 60s）
      setBubble('');
      let sulked3 = false;
      for (let i = 0; i < 20 && !sulked3; i++) { nowMs += 16.7; bk.yank(); sulked3 = bk.state().sulking; }
      ok(sulked3 === false, '④ 冷却 60s 内再连甩也不会摆烂（tier=' + bk.state().tier + '）');
      ok(bk.state().tier >= 2 && poolOf(lastText()) !== '④脱钩',
        '冷却期内降级到 ②/③ 处理（tier=' + bk.state().tier + '，气泡池=' + poolOf(lastText()) + '）');

      // ---- 总开关 ----
      save({ breakOn: false });
      setBubble('');
      for (let i = 0; i < 25; i++) bk.yank();
      ok(bubble.textContent === '' && bk.state().sulking === false,
        '破防模式关闭后：连甩也不会说破防台词、不会摆烂');
      save({ breakOn: true });

      // ----------------------------------------------------------------
      // [v11] 用户实测反馈的两条，必须防回归：
      //   ①「一直试不出摆烂」→ 计数必须是**滚动窗口**（歇口气不清零）
      //   ②「破防后一直抖动不停」→ 发抖必须**限时**
      // ----------------------------------------------------------------
      console.log('');
      console.log('[10.5] v11 修正：滚动窗口计数 + 发抖限时 + 腹黑台词');

      save({ breakWindowMs: 2000, break2At: 2, break3At: 4, break4At: 6,
        break2CoolMs: 1000, break3CoolMs: 1000, break4CoolMs: 2000, sulkMs: 800, shakeMs: 1500 });
      MUTSET = Object.assign({}, MUTSET, savedNow());
      // 干净隔离：先让"上一段遗留的鼠标速度"在物理里衰减掉（否则 pump 时物理循环会
      // 误判成一次猛甩 → 同一毫秒被记两笔，滚动窗口断言就会飘）
      (winListeners.get('mouseleave') || []).forEach((f) => f({}));
      (winListeners.get('mouseenter') || []).forEach((f) => f({}));
      move(700, 500);
      for (let i = 0; i < 60; i++) { nowMs += 16.7; pump(1, 16.7); }
      pump(5, 16.7);
      bk.reset();                                  // 清干净计数（上一段留下的残留不算）
      nowMs += 120000; pump(3, 16.7);             // 时间往前走远：让所有冷却过期、档位归零
      bk.reset();                                  // 冷却检查也可能把档位改掉，再清一次
      setBubble('');
      bk.yank();
      const cntA = bk.state().count;
      ok(cntA === 1 && bk.state().tier <= 1 && bubble.textContent === '',
        '① 第 1 次猛甩 → 计数 1、不升档、不说话（tier=' + bk.state().tier + '）');
      nowMs += MUTSET.breakWindowMs - 500; pump(1, 16.7);   // 歇口气，但没超过窗口（不 reset！）
      bk.yank();
      ok(cntA === 1 && bk.state().count === 2,
        '① 窗口内"歇口气"后继续甩 → 计数继续累加到 2（老写法会清零 → 摆烂永远试不出来）');
      let hit4 = false;
      for (let i = 0; i < 12 && !hit4; i++) { bk.yank(); hit4 = bk.state().sulking; }
      ok(hit4 === true, '① 摆烂能试出来了（窗口内累计 ' + MUTSET.break4At + ' 次即可，不用一口气甩 7 秒）');
      ok(bk.state().tier === 4 && bk.state().shaking === true, '① 摆烂期间处于发抖状态（微颤）');

      nowMs += MUTSET.sulkMs + 100; pump(2, 16.7);          // 装死结束
      ok(bk.state().sulking === false, '② 装死到点结束');
      ok(bk.state().shaking === false, '② 她"回来"时是安静的（不发抖）—— 归来是撒娇，不是继续生气');
      nowMs += MUTSET.shakeMs + 300; pump(3, 16.7);
      ok(bk.state().shaking === false, '② 抖够 shakeMs 后**停止发抖**（用户报的"一直抖不停"已修）');

      // 关键回归：③ 破防后**停手** → 抖一阵就停，不会抖到天荒地老
      save({ breakWindowMs: 2000, break2At: 2, break3At: 3, break4At: 99, break3CoolMs: 500, shakeMs: 1200 });
      MUTSET = Object.assign({}, MUTSET, savedNow());
      nowMs += 30000; pump(3, 16.7);
      bk.yank(); bk.yank(); bk.yank();
      ok(bk.state().tier === 3 && bk.state().shaking === true, '② 刚到 ③ 破防档：在抖（剩 ' + bk.state().shakeLeftMs + 'ms）');
      for (let i = 0; i < 6; i++) { nowMs += 500; pump(2, 16.7); }   // 停手 3 秒（不超窗口）
      ok(bk.state().shaking === false, '② 停手后抖够了就停（shaking=false，不再"一直抖动不停"）');

      // 档位回归：停手超过窗口 → 档位归零（不会永久带着破防档）
      save({ breakWindowMs: 1000, break2At: 2, break3At: 3, break4At: 99, break3CoolMs: 500 });
      MUTSET = Object.assign({}, MUTSET, savedNow());
      nowMs += 20000; pump(3, 16.7);
      bk.yank(); bk.yank(); bk.yank();
      ok(bk.state().tier === 3, '③ 又甩到破防档（tier=' + bk.state().tier + '）');
      nowMs += MUTSET.breakWindowMs + 500; pump(3, 16.7);
      ok(bk.state().tier === 0, '③ 停手超过判定窗口 → 档位归零（tier=' + bk.state().tier + '）');

      // 腹黑台词（用户要求"腹黑嘲讽不够多"）
      const idlePool = MUTSET.idleQuotes || [];
      const darkHit = (s) => /数了下|小鱼问我|很努力的人|没有别的事|没发现自己是空军|遛鼠标|给你数|手速|专业钓鱼佬|很没用|看戏/.test(s);
      const dark = idlePool.filter(darkHit);
      ok(idlePool.length >= 30, '④ 闲置小剧场扩到 ' + idlePool.length + ' 条（v11 加了腹黑池）');
      ok(dark.length >= 8, '④ 其中腹黑嘲讽 ' + dark.length + ' 条，例如：「' + (dark[0] || '') + '」');
      const calmPool = MUTSET.calmQuotes || [];
      const calmDark = calmPool.filter((s) => /小本本|该不该咬线|等你空军|次数我记着|一句话都不说/.test(s));
      ok(calmDark.length >= 4, '④ 平静台词也补了腹黑：' + calmPool.length + ' 条里含 ' + calmDark.length + ' 条');
      ok(MUTSET.shakeMs >= 300 && MUTSET.shakeMs <= 8000, '④ 发抖时长可调且落盘（' + MUTSET.shakeMs + 'ms）');
    } catch (e) {
      ok(false, '破防四档全程不抛异常', e.stack);
    }
  }

  // ---------------------------------------------------------------- [11] v15 性能
  // 用户要求：「这是鼠标，不能影响鼠标的"性能"为优先级」+「最好不要有循环占用和无限计数」。
  // 这里用假 DOM 的写入计数器把"静息期几乎不写 DOM"这件事**量出来**，
  // 并把"无界增长"逐个钉死。
  console.log('');
  console.log('[11] v15 性能：静息期工作量 / 状态封顶 / 无循环占用');

  try {
    // 先回落到"能进静息快车道"的状态：attach 模式（tx 不必等于鼠标）+ 不抖 + 不演出
    bk.endSulk(); pump(2, 16.7);
    nowMs += 60000; bk.reset(); pump(3, 16.7);
    save({ mode: 'attach', poseSource: 'dsh', sulkMs: 60000, shakeMs: 300, powerOn: undefined });
    move(900, 400);
    for (let i = 0; i < 180; i++) { nowMs += 16.7; pump(1, 16.7); }   // 让她彻底静下来

    // ① 静息 120 帧：DOM 写入应该接近于 0
    alignHeartbeat();                       // 对齐到心跳边界，测的才是纯静息开销
    DOMSTAT.reset();
    for (let i = 0; i < 120; i++) { nowMs += 16.7; pump(1, 16.7); }
    const idleWrites = DOMSTAT.total;
    ok(idleWrites <= 12,
      '① 静息 120 帧只有 ' + idleWrites + ' 次 DOM 写入（快车道生效：理论上限 = 心跳 4 帧 × 5 处 ≈ 12）');

    // ② 鼠标每帧都在动：必须正常干活（该写就写）
    DOMSTAT.reset();
    for (let i = 0; i < 120; i++) { move(600 + (i % 40) * 20, 300 + (i % 30) * 8); nowMs += 16.7; pump(1, 16.7); }
    const activeWrites = DOMSTAT.total;
    console.log('    静息 120 帧 ' + idleWrites + ' 次写入  vs  鼠标狂动 120 帧 ' + activeWrites + ' 次写入');
    ok(activeWrites >= 120, '② 鼠标在动时照样逐帧渲染（120 帧写了 ' + activeWrites + ' 次）');
    ok(activeWrites > idleWrites * 8, '③ 静息开销远小于活动开销（' + idleWrites + ' vs ' + activeWrites + '）');

    // ④ 计数封顶：猛甩 200 次，内部时刻数组不许长过 64（"无界计数"钉死）
    save({ breakOn: true, breakSulkOn: false, breakWindowMs: 2000, break2At: 2, break3At: 4, break4At: 6 });
    bk.reset(); nowMs += 60000;
    for (let i = 0; i < 200; i++) { nowMs += 10; bk.yank(); }
    const cl = bk.clocks();
    ok(cl.times.length <= 64, '④ 猛甩 200 次后内部时刻数组 ' + cl.times.length + ' 项（上限 64，不会无界增长）');
    ok(cl.count === cl.times.length, '④ 计数 = 时刻数组长度（两者始终一致，不会漂）');

    // ⑤ 无循环占用：800ms 轮询只在"订阅拿不到"时才起（订阅可用时不该有常驻定时器）
    const pollTimers = win.setInterval._calls || 0;
    ok(pollTimers === 0,
      '⑤ 订阅可用时**没有**常驻 setInterval（轮询兜底只在订阅失效时才启；本会话共起过 ' + pollTimers + ' 个）');

    // ⑥ 事件监听器不重复注册（组件反复挂载也不该累积）
    const mm = (winListeners.get('mousemove') || []).length;
    ok(mm <= 2, '⑥ mousemove 监听器只有 ' + mm + ' 个（重复注册会让每次移动做多份工作）');

    // ⑦ 台词池数组也各有上限（不会越说越长）
    ok((win.__WHALE_ROD_TEST__.pools().idleQuotes || []).length <= 200,
      '⑦ 台词池长度受存档限制（不会在运行中无限追加）');
  } catch (e) {
    ok(false, '性能自检不抛异常', e.stack);
  }

  // 卸载：宿主还给原位置 + 空容器不留在 body 上
  cleanups.forEach((c) => { try { c(); } catch (e) { /* ignore */ } });
  ok(host0.parentNode === whereBefore || host0.parentNode === null,
    '卸载后宿主已从顶层容器里交还给 React 原位置');
  ok(documentStub.getElementById('dsh-rod-cursor-top') === null, '空掉的顶层容器被清理（body 上不留垃圾）');
  ok(!documentStub.documentElement.classList.contains('dsh-rod-cursor-none'), '组件卸载后系统光标仍然可见（安全网）');
}

console.log('');
console.log('===========================================');
console.log('  通过 ' + pass + ' 项，失败 ' + fail + ' 项');
console.log('===========================================');
process.exit(fail ? 1 : 0);
