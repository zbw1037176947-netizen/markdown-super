/**
 * 图片点击放大（Lightbox）
 *
 * 点击预览中的图片 → 全屏半透明遮罩 + 居中大图
 * 点击遮罩或按 Esc → 关闭
 */

let overlay: HTMLElement | null = null;
let closing = false;

export function initImageZoom(container: HTMLElement) {
  // 事件委托，监听 container 内的 img 点击
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "IMG" &&
      !target.closest(".mermaid-rendered, .plantuml-rendered, .gfm-alert-title")
    ) {
      // 如果图片在链接内，阻止跳转
      const anchor = target.closest("a");
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
      }
      showZoom(target as HTMLImageElement);
    }
  });
}

function onEsc(e: KeyboardEvent) {
  if (e.key === "Escape") closeZoom();
}

function showZoom(img: HTMLImageElement) {
  if (overlay || closing) return;

  overlay = document.createElement("div");
  overlay.className = "image-zoom-overlay";

  const zoomedImg = document.createElement("img");
  zoomedImg.src = img.src;
  zoomedImg.className = "image-zoom-img";
  zoomedImg.alt = img.alt;

  overlay.appendChild(zoomedImg);
  overlay.addEventListener("click", closeZoom);
  document.body.appendChild(overlay);

  // Esc 关闭（始终同一引用，确保可正确移除）
  document.addEventListener("keydown", onEsc);

  // 动画：下一帧加 active class
  requestAnimationFrame(() => {
    overlay?.classList.add("active");
  });
}

function closeZoom() {
  if (!overlay || closing) return;
  closing = true;

  const el = overlay;
  el.classList.remove("active");

  // 先立刻解绑 Esc，避免动画期间重复触发
  document.removeEventListener("keydown", onEsc);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.remove();
    overlay = null;
    closing = false;
  };

  el.addEventListener("transitionend", finish, { once: true });
  // 兜底：transitionend 偶发不触发（如元素被隐藏），300ms 后强制收尾
  setTimeout(finish, 300);
}
