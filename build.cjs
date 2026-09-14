/**
 * 构建：把 Q 版素材（多姿态）以 base64 注入源码，生成真正被加载的 lib/client.js
 *
 * 管线：  lib/client.src.js  --(注入各姿态素材 + 量好的挂点)-->  lib/client.js
 *
 * ⚠️ 不要再手工编辑 lib/client.js —— 每次 build 都会被覆盖。
 *    逻辑改动请改 client.src.js，然后跑： node build.cjs
 *
 * 【为什么要"量素材"】
 *   PNG 画布里角色四周有透明留白：绳末端如果钉在画布顶端，就会悬在她头顶上方
 *   几个像素（看起来"线没连到头上"）。所以每次构建都用 jimp 扫一遍 alpha，为
 *   **每一张姿态图**分别算出：
 *     ax/ay = 绳该挂的像素（画布中线往下第一个实体像素 = 她中线处的头顶表面）
 *     cx/cy = 内容中心相对挂点的偏移（Q 弹压缩绕它做，否则像被拎着拉长）
 *     w/h/ch = 画布尺寸 / 内容高度（气泡字号封顶用）
 *   并把三张图一起注入源码 __WHALE_POSES__，同时落一份 lib/whale-anchor.json 存档。
 *   换素材 / 加姿态只要改下面的 ASSETS，不用手改任何常数。
 *
 * 回滚点写到 .build-cache/client.js.prev（放在 lib 外，免得被打进发布包）。
 *
 * ⚠️ 本文件含中文：**别用 PowerShell 的 Get-Content/Set-Content 往返改它**
 *    （PS 5.1 按 GBK 读 UTF-8 会把注释全变成乱码）。要改用 edit/write 工具。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = 'H:/DSH_Workspace/tools/dsh-whale-rod-cursor';
const SRC = ROOT + '/lib/client.src.js';
const OUT = ROOT + '/lib/client.js';
const PREV = ROOT + '/.build-cache/client.js.prev';
const META_OUT = ROOT + '/lib/whale-anchor.json';
const JIMP = 'H:/DSH_Workspace/tools/imgtool/node_modules/jimp';

// 姿态包：key 就是源码里用的姿态名
const ASSETS = {
  idle: { file: 'H:/DSH_Workspace/ref/cursor-candidates/keyed-idle.png', label: '平时' },
  work: { file: 'H:/DSH_Workspace/ref/cursor-candidates/keyed-work.png', label: '在忙' },
  done: { file: 'H:/DSH_Workspace/ref/cursor-candidates/keyed-done.png', label: '干完了' },
};

if (!fs.existsSync(SRC)) { console.log('✗ 找不到源码 ' + SRC); process.exit(1); }

function loadJimp() {
  try { return require(JIMP); } catch (e) {
    console.log('⚠ jimp 加载不到（' + JIMP + '）：' + e.message);
    return null;
  }
}

async function measureOne(file) {
  const Jimp = loadJimp();
  if (!Jimp) return null;
  if (!fs.existsSync(file)) throw new Error('找不到素材 ' + file);
  const img = await Jimp.read(file);
  const W = img.bitmap.width, H = img.bitmap.height;
  const data = img.bitmap.data;
  const A = (x, y) => data[(y * W + x) * 4 + 3];

  // 1) 内容包围盒
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (A(x, y) > 8) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('素材整张全透明？' + file);

  // 2) 挂点：**正中间那一列**往下第一个实体像素（= 她中线处的头顶表面）
  //    ① 只看中线那一列：加窗口会把左右两侧略高的边缘算进来，挂点会偏高。
  //    ② 阈值 40：跳过透明→不透明的抗锯齿过渡像素。
  //    ③ 万一中线整列都空（头顶正好有凹陷），逐级放宽窗口兜底。
  const cx0 = Math.round(W / 2);
  const ALPHA_MIN = 40;
  const firstOpaqueY = (x) => {
    for (let y = 0; y < H; y++) if (x >= 0 && x < W && A(x, y) > ALPHA_MIN) return y;
    return -1;
  };
  let ay = firstOpaqueY(cx0);
  if (ay < 0) {
    for (let w = 1; w <= 4 && ay < 0; w++) {
      for (let x = cx0 - w; x <= cx0 + w && ay < 0; x++) ay = firstOpaqueY(x);
    }
  }
  if (ay < 0) ay = minY;

  return {
    w: W, h: H,
    ax: cx0, ay: ay,
    cx: Number(((minX + maxX) / 2 - cx0).toFixed(2)),
    cy: Number(((minY + maxY) / 2 - ay).toFixed(2)),
    ch: maxY - minY + 1,
    box: { minX, minY, maxX, maxY },
  };
}

// ------------------------------------------------------------------ 主流程
(async () => {
  // 先试重量；量不动就用上次的存档
  let measured = null;
  try {
    measured = {};
    for (const key of Object.keys(ASSETS)) measured[key] = await measureOne(ASSETS[key].file);
  } catch (e) {
    console.log('⚠ 量素材失败：' + e.message);
    measured = null;
  }
  if (!measured && fs.existsSync(META_OUT)) {
    const saved = JSON.parse(fs.readFileSync(META_OUT, 'utf8'));
    if (saved && saved.poses) { measured = {}; for (const k of Object.keys(saved.poses)) measured[k] = saved.poses[k].meta; }
    console.log('· 用上次量好的挂点（lib/whale-anchor.json）');
  }
  if (!measured) { console.log('✗ 既量不出来也没有存档，无法确定绳挂点'); process.exit(1); }

  console.log('素材（' + Object.keys(ASSETS).length + ' 个姿态）:');
  const poses = {};
  let totalKb = 0;
  for (const key of Object.keys(ASSETS)) {
    const { file, label } = ASSETS[key];
    const png = fs.readFileSync(file);
    const uri = 'data:image/png;base64,' + png.toString('base64');
    const sha = crypto.createHash('sha256').update(png).digest('hex').slice(0, 16);
    const meta = measured[key];
    poses[key] = { src: uri, meta };
    totalKb += png.length / 1024;
    console.log('  ' + key.padEnd(5) + ' ' + label.padEnd(4) + ' ' + path.basename(file).padEnd(17) +
      ' ' + meta.w + 'x' + meta.h + '  ' + (png.length / 1024).toFixed(1) + ' KB' +
      '  挂点(' + meta.ax + ',' + meta.ay + ') 支点(' + meta.cx + ',' + meta.cy + ') 内容高' + meta.ch +
      '  sha:' + sha);
  }
  console.log('  合计原图 ' + totalKb.toFixed(1) + ' KB');

  let js = fs.readFileSync(SRC, 'utf8');

  // 只认「带引号/带等号的那一处」——文件头注释里也会提到占位符名字，别误伤
  const PH_POSES = '= __WHALE_POSES__;';
  const nPoses = js.split(PH_POSES).length - 1;
  if (nPoses !== 1) { console.log('✗ 源码中 ' + PH_POSES + ' 出现 ' + nPoses + ' 次（应为 1 次）'); process.exit(1); }

  js = js.replace(PH_POSES, '= ' + JSON.stringify(poses) + ';');

  if (fs.existsSync(OUT)) {
    try {
      fs.mkdirSync(path.dirname(PREV), { recursive: true });
      fs.copyFileSync(OUT, PREV);
    } catch (e) { console.log('⚠ 未能写入回滚点：' + e.message); }
  }
  fs.writeFileSync(OUT, js, 'utf8');

  const sidecar = { poses: {} };
  for (const key of Object.keys(ASSETS)) {
    const png = fs.readFileSync(ASSETS[key].file);
    sidecar.poses[key] = {
      asset: path.basename(ASSETS[key].file),
      label: ASSETS[key].label,
      sha256_16: crypto.createHash('sha256').update(png).digest('hex').slice(0, 16),
      ...measured[key],
    };
  }
  fs.writeFileSync(META_OUT, JSON.stringify(sidecar, null, 2), 'utf8');

  const out = fs.readFileSync(OUT, 'utf8');
  const ver = (out.match(/__WHALE_ROD_CURSOR_VER__ = '([^']+)'/) || [])[1];
  console.log('');
  console.log('=== 产物 ===');
  console.log('  client.js  ' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB');
  console.log('  版本戳     ' + ver);
  console.log('  挂点存档   lib/whale-anchor.json');
  console.log('  回滚点     .build-cache/client.js.prev');
  console.log('');
  console.log('下一步： node --check lib/client.js && node smoke-test.cjs   然后重启 dsh web + 硬刷新');
})();
