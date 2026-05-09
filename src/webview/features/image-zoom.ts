/**
 * 图片点击放大（Lightbox）+ 滚轮缩放 + 拖动平移
 *
 * - 点击图片：打开全屏遮罩
 * - 滚轮：以鼠标位置为锚点缩放（0.2x ~ 10x）
 * - 按住拖动：平移图片
 * - 双击：在 1x ↔ 2x 之间切换（以双击点为锚点放大）
 * - Esc / 点击空白处：关闭
 * - + / - / 0：键盘缩放与重置
 */

const MIN_SCALE = 0.2;
const MAX_SCALE = 10;
const DRAG_THRESHOLD = 4; // 像素，超过才视为拖动

let overlay: HTMLElement | null = null;
let zoomedImg: HTMLImageElement | null = null;
let scaleEl: HTMLElement | null = null;
let closing = false;

// 当前变换状态
let scale = 1;
let tx = 0;
let ty = 0;

// 拖动状态
let isPointerDown = false;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let txAtDragStart = 0;
let tyAtDragStart = 0;

export function initImageZoom(container: HTMLElement) {
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "IMG" &&
      !target.closest(".mermaid-rendered, .plantuml-rendered, .gfm-alert-title")
    ) {
      const anchor = target.closest("a");
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
      }
      showZoom(target as HTMLImageElement);
    }
  });
}

function onKey(e: KeyboardEvent) {
  if (!overlay) return;
  if (e.key === "Escape") {
    closeZoom();
  } else if (e.key === "+" || e.key === "=") {
    zoomAtCenter(1.2);
    e.preventDefault();
  } else if (e.key === "-" || e.key === "_") {
    zoomAtCenter(1 / 1.2);
    e.preventDefault();
  } else if (e.key === "0" || e.key.toLowerCase() === "r") {
    resetTransform(true);
    e.preventDefault();
  }
}

function showZoom(img: HTMLImageElement) {
  if (overlay || closing) return;

  overlay = document.createElement("div");
  overlay.className = "image-zoom-overlay";

  zoomedImg = document.createElement("img");
  zoomedImg.src = img.src;
  zoomedImg.className = "image-zoom-img";
  zoomedImg.alt = img.alt;
  zoomedImg.draggable = false;
  // 图片加载完成后再 apply 一次，确保 clampPan 拿到真实 naturalSize
  zoomedImg.addEventListener("load", () => applyTransform(false), { once: true });

  // 工具栏（缩放比例 + 操作提示）
  const toolbar = document.createElement("div");
  toolbar.className = "image-zoom-toolbar";
  scaleEl = document.createElement("span");
  scaleEl.className = "image-zoom-scale";
  scaleEl.textContent = "100%";
  const hint = document.createElement("span");
  hint.className = "image-zoom-hint";
  hint.textContent = "滚轮缩放 · 拖动平移 · 双击切换 · Esc 关闭";
  toolbar.appendChild(scaleEl);
  toolbar.appendChild(hint);

  overlay.appendChild(zoomedImg);
  overlay.appendChild(toolbar);
  document.body.appendChild(overlay);

  // 重置变换
  scale = 1;
  tx = 0;
  ty = 0;
  applyTransform(false);

  // 绑定事件
  overlay.addEventListener("wheel", onWheel, { passive: false });
  overlay.addEventListener("mousedown", onMouseDown);
  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);
  overlay.addEventListener("mouseleave", onMouseUp);
  overlay.addEventListener("dblclick", onDoubleClick);
  overlay.addEventListener("click", onOverlayClick);
  document.addEventListener("keydown", onKey);

  requestAnimationFrame(() => {
    overlay?.classList.add("active");
  });
}

function closeZoom() {
  if (!overlay || closing) return;
  closing = true;

  const el = overlay;
  el.classList.remove("active");

  document.removeEventListener("keydown", onKey);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.remove();
    overlay = null;
    zoomedImg = null;
    scaleEl = null;
    closing = false;
    isPointerDown = false;
    isDragging = false;
  };

  el.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 300);
}

/**
 * 取得 scale=1 时图片在视口中的实际渲染尺寸。
 * CSS 给了 max-width:90vw / max-height:90vh + object-fit:contain，
 * 所以 base 尺寸 = naturalSize 经 contain 适配到 90vw × 90vh 的结果。
 */
function getBaseSize(): { w: number; h: number } | null {
  if (!zoomedImg || !zoomedImg.naturalWidth || !zoomedImg.naturalHeight) return null;
  const maxW = window.innerWidth * 0.9;
  const maxH = window.innerHeight * 0.9;
  const ratio = Math.min(
    maxW / zoomedImg.naturalWidth,
    maxH / zoomedImg.naturalHeight,
    1 // 不上采样：小图保持原始尺寸
  );
  return { w: zoomedImg.naturalWidth * ratio, h: zoomedImg.naturalHeight * ratio };
}

/**
 * 把 tx, ty 夹紧到当前缩放下"图片不会被拖出视口"的范围。
 * - 当某轴向缩放后尺寸 ≤ 视口：该轴 maxOffset = 0 → 强制居中
 * - 否则：允许在 ±(超出量/2) 内平移
 * 这正是 macOS 预览 / Figma / Photos 的行为。
 */
function clampPan() {
  const base = getBaseSize();
  if (!base) return;
  const dispW = base.w * scale;
  const dispH = base.h * scale;
  const maxTx = Math.max(0, (dispW - window.innerWidth) / 2);
  const maxTy = Math.max(0, (dispH - window.innerHeight) / 2);
  tx = Math.min(maxTx, Math.max(-maxTx, tx));
  ty = Math.min(maxTy, Math.max(-maxTy, ty));
}

function applyTransform(animated: boolean) {
  if (!zoomedImg) return;
  clampPan();
  zoomedImg.style.transition = animated ? "transform 0.2s ease" : "none";
  zoomedImg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  if (scaleEl) {
    scaleEl.textContent = `${Math.round(scale * 100)}%`;
  }
  if (overlay) {
    overlay.classList.toggle("zoomed", scale > 1.001);
  }
}

function resetTransform(animated: boolean) {
  scale = 1;
  tx = 0;
  ty = 0;
  applyTransform(animated);
}

function clampScale(s: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

/**
 * 以视口位置 (mx, my) 为锚点，把当前 scale 乘上 factor。
 * 推导：transform-origin = center center，容器为视口。
 *   设容器中心为 (cx, cy)，图片中心视口位置 = (cx + tx, cy + ty)。
 *   M = (mx, my) 相对图片中心位移 D = M - center。
 *   新 scale 后想保持 M 对应的原图点不动，需要 new_t = D - D*ratio + t...
 * 简化得：new_t = mx_off - (mx_off - tx) * ratio   （mx_off = mx - cx）
 */
function zoomAt(mx: number, my: number, factor: number) {
  if (!zoomedImg) return;
  const newScale = clampScale(scale * factor);
  const ratio = newScale / scale;
  if (ratio === 1) return;

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const mxOff = mx - cx;
  const myOff = my - cy;

  tx = mxOff - (mxOff - tx) * ratio;
  ty = myOff - (myOff - ty) * ratio;
  scale = newScale;
  applyTransform(false);
}

function zoomAtCenter(factor: number) {
  zoomAt(window.innerWidth / 2, window.innerHeight / 2, factor);
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  // 归一化滚轮：deltaMode 1=line, 2=page；折算成 pixel 量级
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
  const delta = e.deltaY * unit;
  // 平滑指数曲线
  const factor = Math.exp(-delta * 0.0015);
  zoomAt(e.clientX, e.clientY, factor);
}

function onMouseDown(e: MouseEvent) {
  // 仅响应主键
  if (e.button !== 0) return;
  isPointerDown = true;
  isDragging = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  txAtDragStart = tx;
  tyAtDragStart = ty;
}

function onMouseMove(e: MouseEvent) {
  if (!isPointerDown) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  if (!isDragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
  isDragging = true;
  e.preventDefault();
  tx = txAtDragStart + dx;
  ty = tyAtDragStart + dy;
  applyTransform(false);
}

function onMouseUp() {
  if (!isPointerDown) return;
  isPointerDown = false;
  // isDragging 由 onOverlayClick 在随后的 click 事件中消费清零，避免拖动收尾误触发关闭
}

function onDoubleClick(e: MouseEvent) {
  e.preventDefault();
  if (scale > 1.001) {
    resetTransform(true);
  } else {
    zoomAt(e.clientX, e.clientY, 2);
  }
}

function onOverlayClick(e: MouseEvent) {
  // 拖动收尾产生的 click 不关闭
  if (isDragging) {
    isDragging = false;
    return;
  }
  // 点击图片本身不关闭（除非 1x 状态下点空白）
  const target = e.target as HTMLElement;
  if (target === zoomedImg) return;
  if (target.closest(".image-zoom-toolbar")) return;
  closeZoom();
}
