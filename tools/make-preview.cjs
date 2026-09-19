/**
 * 生成仓库预览图 assets/preview/schematic.png
 *
 * ⚠️ 这是**程序画的示意图**（jimp 合成），不是真实截图 —— 文件里不写字，
 *    免得出现"看起来像截图但其实是画的"的误导。README 里也照实标注。
 *    真机截图请用 Win+Shift+S 自己截，存到 assets/preview/screenshot.png。
 *
 * 用法： node tools/make-preview.cjs
 * 依赖： jimp（路径见下方 JIMP；本机在 imgtool 里）
 */
const fs = require('fs');
const path = require('path');
const JIMP = 'F:/DSH_Workspace/tools/imgtool/node_modules/jimp';
const Jimp = require(JIMP);

const ROOT = path.resolve(__dirname, '..');
const WHALE = 'F:/DSH_Workspace/ref/cursor-candidates/keyed-idle.png';
const ANCHOR = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'whale-anchor.json'), 'utf8')).poses.idle;
const OUT_DIR = path.join(ROOT, 'assets', 'preview');
const OUT = path.join(OUT_DIR, 'schematic.png');

const W = 1280, H = 800;
const SCALE = 1.5;              // 与插件默认 0.72 相比放大，方便看清
const CURSOR = { x: 640, y: 300 };
const C_ROD = [0x4f, 0xa3, 0xd1];
const C_DIM = [0x5a, 0x6b, 0x86];

function px(img, x, y, rgb, a) {
  if (x < 0 || y < 0 || x >= img.bitmap.width || y >= img.bitmap.height) return;
  const i = (y * img.bitmap.width + x) * 4;
  const al = a === undefined ? 1 : a;
  const d = img.bitmap.data;
  d[i] = Math.round(d[i] * (1 - al) + rgb[0] * al);
  d[i + 1] = Math.round(d[i + 1] * (1 - al) + rgb[1] * al);
  d[i + 2] = Math.round(d[i + 2] * (1 - al) + rgb[2] * al);
  d[i + 3] = 255;
}

/** 抗锯齿细线（画竿、画绳都用它） */
function line(img, x0, y0, x1, y1, rgb, width, a) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
    const r = Math.max(0, width / 2);
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const dist = Math.hypot(dx, dy);
        if (dist > r + 0.5) continue;
        const cover = Math.min(1, Math.max(0, r + 0.5 - dist));
        px(img, Math.round(cx + dx), Math.round(cy + dy), rgb, (a === undefined ? 1 : a) * cover);
      }
    }
  }
}

(async () => {
  const bg = new Jimp(W, H, 0x0e1626ff);
  // 背景：上深下浅的柔和渐变 + 一点"海面"感
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const r = Math.round(0x0e + (0x18 - 0x0e) * t);
    const g = Math.round(0x16 + (0x24 - 0x16) * t);
    const b = Math.round(0x26 + (0x3a - 0x26) * t);
    for (let x = 0; x < W; x++) px(bg, x, y, [r, g, b], 1);
  }
  // 一条地平线
  line(bg, 60, 620, W - 60, 620, C_DIM, 1.5, 0.35);

  const whale = await Jimp.read(WHALE);
  const w = Math.round(ANCHOR.w * SCALE), h = Math.round(ANCHOR.h * SCALE);
  whale.resize(w, h);
  // 挂点对齐：素材里 (ax,ay) 那个像素要落在绳末端
  const headX = CURSOR.x, headY = CURSOR.y + Math.round(83 * SCALE);   // 83 = 静息悬挂距离
  bg.composite(whale, headX - Math.round(ANCHOR.ax * SCALE), headY - Math.round(ANCHOR.ay * SCALE));

  // 绳：从竿尖垂到头顶
  line(bg, CURSOR.x, CURSOR.y, headX, headY, C_ROD, 1.6, 0.85);
  // 竿：竿尖在左上，竿身朝右下（与箭头光标同朝向）
  line(bg, CURSOR.x, CURSOR.y, CURSOR.x + 13 * SCALE, CURSOR.y + 18 * SCALE, C_ROD, 2.4, 1);
  line(bg, CURSOR.x + 13 * SCALE, CURSOR.y + 18 * SCALE, CURSOR.x + 22 * SCALE, CURSOR.y + 31 * SCALE, C_ROD, 4.2, 0.8);
  // 竿尖那一点
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (Math.hypot(dx, dy) <= 3) px(bg, CURSOR.x + dx, CURSOR.y + dy, C_ROD, 1);
  }
  // 鼠标热点示意：淡淡的十字（不是系统光标，避免误认为截图）
  line(bg, CURSOR.x - 22, CURSOR.y, CURSOR.x - 8, CURSOR.y, C_DIM, 1, 0.5);
  line(bg, CURSOR.x + 8, CURSOR.y, CURSOR.x + 22, CURSOR.y, C_DIM, 1, 0.5);
  line(bg, CURSOR.x, CURSOR.y - 22, CURSOR.x, CURSOR.y - 8, C_DIM, 1, 0.5);
  line(bg, CURSOR.x, CURSOR.y + 8, CURSOR.x, CURSOR.y + 22, C_DIM, 1, 0.5);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await bg.quality(92).writeAsync(OUT);

  // 自检：图得是那么大、得真的有内容
  const back = await Jimp.read(OUT);
  const d = back.bitmap.data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 0x40 || d[i + 2] > 0x60) lit++;
  console.log('已生成 ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
  console.log('  尺寸 ' + back.bitmap.width + '×' + back.bitmap.height + '  ' + (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB');
  console.log('  亮像素占比 ' + ((lit / (back.bitmap.width * back.bitmap.height)) * 100).toFixed(1) + '%（应大于 3%）');
  console.log('  绳末端 = 头顶对齐：素材挂点 (' + ANCHOR.ax + ',' + ANCHOR.ay + ') → 画布 (' + headX + ',' + headY + ')');
})();
