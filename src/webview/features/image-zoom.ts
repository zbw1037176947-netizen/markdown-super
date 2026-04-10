/**
 * 图片点击放大（Lightbox）
 *
 * 点击预览中的图片 → 全屏半透明遮罩 + 居中大图
 * 点击遮罩或按 Esc → 关闭
 */

let overlay: HTMLElement | null = null;

export function initImageZoom(container: HTMLElement) {
  // 事件委托，监听 container 内的 img 点击
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG" && !target.closest(".mermaid-rendered, .plantuml-rendered, .gfm-alert-title")) {
      showZoom(target as HTMLImageElement);
    }
  });
}

function showZoom(img: HTMLImageElement) {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.className = "image-zoom-overlay";

  const zoomedImg = document.createElement("img");
  zoomedImg.src = img.src;
  zoomedImg.className = "image-zoom-img";
  zoomedImg.alt = img.alt;

  overlay.appendChild(zoomedImg);
  document.body.appendChild(overlay);

  // 点击遮罩关闭
  overlay.addEventListener("click", closeZoom);

  // Esc 关闭
  document.addEventListener("keydown", onEsc);

  // 动画：下一帧加 active class
  requestAnimationFrame(() => {
    overlay?.classList.add("active");
  });
}

function closeZoom() {
  if (!overlay) return;
  overlay.classList.remove("active");
  overlay.addEventListener("transitionend", () => {
    overlay?.remove();
    overlay = null;
  }, { once: true });
  document.removeEventListener("keydown", onEsc);
}

function onEsc(e: KeyboardEvent) {
  if (e.key === "Escape") closeZoom();
}
