/**
 * 图片 / 图表点击放大（Lightbox）+ 滚轮缩放 + 拖动平移
 *
 * - 普通 <img>：点击图片打开
 * - Mermaid / PlantUML / Markmap：图表右上角的角标按钮触发，克隆 SVG/HTML 进 overlay
 *   （SVG 矢量保留，放大不模糊）
 * - 滚轮：以鼠标位置为锚点缩放（0.2x ~ 10x）
 * - 按住拖动：平移
 * - 双击：在 1x ↔ 2x 之间切换
 * - Esc / 点击空白：关闭
 * - + / - / 0：键盘缩放与重置
 */

const MIN_SCALE = 0.2;
const MAX_SCALE = 10;
const DRAG_THRESHOLD = 4;
const DIAGRAM_SELECTOR = ".mermaid-rendered, .plantuml-rendered, .markmap-rendered";

let overlay: HTMLElement | null = null;
let zoomedTarget: HTMLElement | null = null; // 被施加 transform 的元素
let scaleEl: HTMLElement | null = null;
let baseSize: { w: number; h: number } | null = null;
let closing = false;

// 矢量缩放模式：直接改 SVG/img 的 width/height，避免 CSS scale 引起的栅格化模糊。
// 仅 translate 用于平移。
let vectorInner: HTMLElement | null = null;
let vectorBase: { w: number; h: number } | null = null;

let scale = 1;
let tx = 0;
let ty = 0;

let isPointerDown = false;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let txAtDragStart = 0;
let tyAtDragStart = 0;

export function initImageZoom(container: HTMLElement) {
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;

    // 角标放大按钮
    const btn = target.closest(".diagram-zoom-btn") as HTMLElement | null;
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      const diagram = btn.closest(DIAGRAM_SELECTOR) as HTMLElement | null;
      if (diagram) showDiagramZoom(diagram);
      return;
    }

    // 普通图片：保持原行为；图表内 img / 提示框图标不响应
    if (
      target.tagName === "IMG" &&
      !target.closest(".mermaid-rendered, .plantuml-rendered, .markmap-rendered, .gfm-alert-title")
    ) {
      const anchor = target.closest("a");
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
      }
      showImageZoom(target as HTMLImageElement);
    }
  });
}

/**
 * 在已渲染的图表块右上角注入"放大"按钮。幂等：可重复调用。
 * 应在每次 markdown 渲染完成、图表也渲染完成后调用一次。
 */
export function addDiagramZoomButtons(container: HTMLElement) {
  const blocks = container.querySelectorAll<HTMLElement>(DIAGRAM_SELECTOR);
  blocks.forEach((block) => {
    if (block.querySelector(":scope > .diagram-zoom-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "diagram-zoom-btn";
    btn.title = "放大查看";
    btn.setAttribute("aria-label", "放大查看");
    btn.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
      '<path fill="currentColor" d="M2 2h5v1.5H4.56l3.22 3.22-1.06 1.06L3.5 4.56V7H2V2zm12 12H9v-1.5h2.44L8.22 9.28l1.06-1.06 3.22 3.22V9H14v5z"/>' +
      "</svg>";
    block.appendChild(btn);
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

function showImageZoom(img: HTMLImageElement) {
  if (overlay || closing) return;
  buildOverlay();

  const cloned = document.createElement("img");
  cloned.src = img.src;
  cloned.className = "image-zoom-img";
  cloned.alt = img.alt;
  cloned.draggable = false;
  cloned.addEventListener(
    "load",
    () => {
      baseSize = computeImageBaseSize(cloned);
      // 启用矢量/位图重栅格化模式：缩放时改 width/height，让浏览器从原始解码数据按目标分辨率插值，
      // 避免 transform:scale 拉伸 layer 快照导致的二次模糊。
      // SVG 通过 <img> 加载时无损；PNG/JPG 在原图分辨率范围内清晰，超过原图分辨率才会出现位图本身的物理上限模糊。
      if (baseSize) {
        vectorInner = cloned;
        vectorBase = baseSize;
        cloned.style.maxWidth = "none";
        cloned.style.maxHeight = "none";
      }
      applyTransform(false);
    },
    { once: true }
  );

  zoomedTarget = cloned;
  overlay!.insertBefore(cloned, overlay!.firstChild);
  finalizeOverlay();
}

function showDiagramZoom(diagramRoot: HTMLElement) {
  if (overlay || closing) return;
  buildOverlay();

  const wrap = document.createElement("div");
  wrap.className = "image-zoom-svg-wrap";
  for (const child of Array.from(diagramRoot.children)) {
    if (child.classList.contains("diagram-zoom-btn")) continue;
    const clone = child.cloneNode(true) as Element;
    wrap.appendChild(clone);
    if (clone instanceof SVGSVGElement) {
      sizeClonedSvg(clone);
    }
  }
  // 给克隆 SVG 一个独立 ID 作用域，避免和原 DOM 中的 marker / clipPath 冲突
  rewriteSvgIds(wrap);

  zoomedTarget = wrap;
  overlay!.insertBefore(wrap, overlay!.firstChild);

  // 选定可矢量缩放的内层元素：SVG 或 <img>（PlantUML 走 .svg URL，浏览器也能矢量重栅格化）。
  // markmap 是 HTML 树，没有矢量重绘价值，退回 CSS scale 模式。
  const inner = wrap.querySelector(":scope > svg, :scope > img") as HTMLElement | null;
  if (inner) {
    vectorInner = inner;
    // 注意：先不解除任何尺寸限制，让浏览器按 CSS 的 max-width/height 自动 fit。
    // 等 measureDiagramBaseSize 拿到 fit 后的真实显示尺寸（vectorBase）再解除限制，
    // 否则像 PlantUML 这种通过 <img src=".svg"> 加载的图会还原成原生大尺寸。
  }

  // SVG / HTML 子树同步入 DOM 即可量尺寸；img 子节点等加载完再补一次
  measureDiagramBaseSize(wrap);
  finalizeOverlay();
}

/**
 * Mermaid 生成的 SVG 通常带 `width="100%"` 和内联 `max-width`，进入 flex 容器后会塌陷成 0。
 * 这里读 viewBox（或 width/height 属性）拿到原生宽高比，按 90vw / 90vh 上限算出一个具体像素尺寸。
 */
function sizeClonedSvg(svg: SVGSVGElement) {
  let aspectW = 0;
  let aspectH = 0;

  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      aspectW = parts[2];
      aspectH = parts[3];
    }
  }
  if (!aspectW || !aspectH) {
    const w = parseFloat(svg.getAttribute("width") || "");
    const h = parseFloat(svg.getAttribute("height") || "");
    if (w > 0 && h > 0) {
      aspectW = w;
      aspectH = h;
    }
  }
  if (!aspectW || !aspectH) return;

  const maxW = window.innerWidth * 0.9 - 32;
  const maxH = window.innerHeight * 0.9 - 32;
  const ratio = Math.min(maxW / aspectW, maxH / aspectH);
  const targetW = Math.round(aspectW * ratio);
  const targetH = Math.round(aspectH * ratio);

  svg.setAttribute("width", String(targetW));
  svg.setAttribute("height", String(targetH));
  // 清掉 mermaid 内联的 max-width，避免再次截断
  svg.style.maxWidth = "none";
  svg.style.maxHeight = "none";
  svg.style.width = `${targetW}px`;
  svg.style.height = `${targetH}px`;
}

function buildOverlay() {
  overlay = document.createElement("div");
  overlay.className = "image-zoom-overlay";

  const toolbar = document.createElement("div");
  toolbar.className = "image-zoom-toolbar";
  scaleEl = document.createElement("span");
  scaleEl.className = "image-zoom-scale";
  scaleEl.textContent = "100%";
  const hint = document.createElement("span");
  hint.className = "image-zoom-hint";
  hint.textContent = "滚轮缩放 · 拖动平移 · 双击切换 · Esc 关闭";
  toolbar.append(scaleEl, hint);
  overlay.appendChild(toolbar);

  document.body.appendChild(overlay);

  scale = 1;
  tx = 0;
  ty = 0;
  baseSize = null;

  overlay.addEventListener("wheel", onWheel, { passive: false });
  overlay.addEventListener("mousedown", onMouseDown);
  overlay.addEventListener("mousemove", onMouseMove);
  overlay.addEventListener("mouseup", onMouseUp);
  overlay.addEventListener("mouseleave", onMouseUp);
  overlay.addEventListener("dblclick", onDoubleClick);
  overlay.addEventListener("click", onOverlayClick);
  document.addEventListener("keydown", onKey);
}

function finalizeOverlay() {
  applyTransform(false);
  requestAnimationFrame(() => overlay?.classList.add("active"));
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
    zoomedTarget = null;
    scaleEl = null;
    baseSize = null;
    vectorInner = null;
    vectorBase = null;
    closing = false;
    isPointerDown = false;
    isDragging = false;
  };

  el.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 300);
}

/**
 * 普通 <img> 的 base 尺寸：CSS 给了 max-width:90vw / max-height:90vh + object-fit:contain，
 * 经 contain 适配后的实际显示尺寸。
 */
function computeImageBaseSize(img: HTMLImageElement): { w: number; h: number } | null {
  if (!img.naturalWidth || !img.naturalHeight) return null;
  const maxW = window.innerWidth * 0.9;
  const maxH = window.innerHeight * 0.9;
  const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
  return { w: img.naturalWidth * ratio, h: img.naturalHeight * ratio };
}

/**
 * 图表 wrap 的 base 尺寸：直接读 layout 后的 bounding rect。
 * 在 transform 应用前测量，避免被 scale 反向放大/缩小。
 */
function measureDiagramBaseSize(wrap: HTMLElement) {
  const measure = () => {
    if (!wrap.isConnected) return;
    // 暂时清空 transform，避免影响测量
    const prev = wrap.style.transform;
    wrap.style.transform = "none";
    const rect = wrap.getBoundingClientRect();
    wrap.style.transform = prev;
    if (rect.width > 0 && rect.height > 0) {
      baseSize = { w: rect.width, h: rect.height };
    }
    // 同步记录矢量内层元素的基础显示尺寸（用于按倍率重写 width/height）
    if (vectorInner && vectorInner.isConnected && !vectorBase) {
      const ir = vectorInner.getBoundingClientRect();
      if (ir.width > 0 && ir.height > 0) {
        vectorBase = { w: ir.width, h: ir.height };
        // 锁定到 fit 后的尺寸，再解除 wrap 与 inner 的所有 max 约束，
        // 让后续 applyTransform 写入的 width/height 不再被 CSS 截断。
        vectorInner.style.width = `${ir.width}px`;
        vectorInner.style.height = `${ir.height}px`;
        vectorInner.style.maxWidth = "none";
        vectorInner.style.maxHeight = "none";
        wrap.style.maxWidth = "none";
        wrap.style.maxHeight = "none";
        wrap.style.overflow = "visible";
      }
    }
    applyTransform(false);
  };
  // 第一次：layout 完成后立即测
  requestAnimationFrame(measure);
  // 第二次：若内含 <img>（PlantUML），等图片加载完再补一次
  wrap.querySelectorAll("img").forEach((img) => {
    if (!img.complete) {
      img.addEventListener("load", () => requestAnimationFrame(measure), { once: true });
    }
  });
}

/**
 * 给克隆 SVG 内的 id 加上唯一前缀，并同步更新 url(#id) / href="#id" 引用。
 * 防止和原 DOM 中相同 id 冲突（mermaid 在多次渲染后会有重复 id）。
 */
let svgScopeCounter = 0;
function rewriteSvgIds(wrap: HTMLElement) {
  const svgs = wrap.querySelectorAll("svg");
  svgs.forEach((svg) => {
    const scope = `zoom-${++svgScopeCounter}-`;
    const idMap = new Map<string, string>();
    svg.querySelectorAll("[id]").forEach((el) => {
      const oldId = el.getAttribute("id")!;
      const newId = scope + oldId;
      idMap.set(oldId, newId);
      el.setAttribute("id", newId);
    });
    if (idMap.size === 0) return;

    // url(#x) 引用：扫所有元素的所有属性
    const urlRe = /url\(#([^)]+)\)/g;
    const all = svg.querySelectorAll("*");
    [svg, ...Array.from(all)].forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        if (attr.value.includes("url(#")) {
          const replaced = attr.value.replace(urlRe, (_m, id) => {
            const mapped = idMap.get(id);
            return mapped ? `url(#${mapped})` : `url(#${id})`;
          });
          if (replaced !== attr.value) el.setAttribute(attr.name, replaced);
        }
        // href / xlink:href = "#id"
        if ((attr.name === "href" || attr.name === "xlink:href") && attr.value.startsWith("#")) {
          const id = attr.value.slice(1);
          const mapped = idMap.get(id);
          if (mapped) el.setAttribute(attr.name, "#" + mapped);
        }
      });
    });
  });
}

function clampPan() {
  if (!baseSize) return;
  const dispW = baseSize.w * scale;
  const dispH = baseSize.h * scale;
  const maxTx = Math.max(0, (dispW - window.innerWidth) / 2);
  const maxTy = Math.max(0, (dispH - window.innerHeight) / 2);
  tx = Math.min(maxTx, Math.max(-maxTx, tx));
  ty = Math.min(maxTy, Math.max(-maxTy, ty));
}

function applyTransform(animated: boolean) {
  if (!zoomedTarget) return;
  clampPan();
  zoomedTarget.style.transition = animated ? "transform 0.2s ease" : "none";
  if (vectorInner && vectorBase) {
    // 矢量模式：直接放大 SVG/img 自身尺寸，浏览器从矢量数据重新栅格化 → 任意倍率清晰；
    // transform 只承担平移。
    const w = vectorBase.w * scale;
    const h = vectorBase.h * scale;
    vectorInner.style.width = `${w}px`;
    vectorInner.style.height = `${h}px`;
    if (vectorInner.tagName.toLowerCase() === "svg") {
      vectorInner.setAttribute("width", String(w));
      vectorInner.setAttribute("height", String(h));
    }
    zoomedTarget.style.transform = `translate(${tx}px, ${ty}px)`;
  } else {
    zoomedTarget.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }
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

function zoomAt(mx: number, my: number, factor: number) {
  if (!zoomedTarget) return;
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
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
  const delta = e.deltaY * unit;
  const factor = Math.exp(-delta * 0.0015);
  zoomAt(e.clientX, e.clientY, factor);
}

function onMouseDown(e: MouseEvent) {
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
  if (isDragging) {
    isDragging = false;
    return;
  }
  const target = e.target as HTMLElement;
  if (zoomedTarget && (target === zoomedTarget || zoomedTarget.contains(target))) return;
  if (target.closest(".image-zoom-toolbar")) return;
  closeZoom();
}
