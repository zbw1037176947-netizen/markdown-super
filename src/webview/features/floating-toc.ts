/**
 * 预览面板内浮动 TOC 导航栏
 *
 * - 固定在预览右侧，可折叠/展开
 * - 从渲染后的 DOM 中提取标题
 * - 点击跳转到对应位置
 * - 滚动时自动高亮当前所在的标题
 */

let tocContainer: HTMLElement | null = null;
let tocList: HTMLElement | null = null;
let tocToggle: HTMLElement | null = null;
let isCollapsed = false;
let tocItems: { el: HTMLElement; heading: HTMLElement; level: number }[] = [];

export function initFloatingToc() {
  // 创建 TOC 容器
  tocContainer = document.createElement("div");
  tocContainer.className = "floating-toc";
  tocContainer.innerHTML = `
    <button class="floating-toc-toggle" title="Toggle outline">☰</button>
    <div class="floating-toc-panel">
      <div class="floating-toc-header">Outline</div>
      <div class="floating-toc-list"></div>
    </div>
  `;
  document.body.appendChild(tocContainer);

  tocToggle = tocContainer.querySelector(".floating-toc-toggle")!;
  tocList = tocContainer.querySelector(".floating-toc-list")!;

  tocToggle.addEventListener("click", () => {
    isCollapsed = !isCollapsed;
    tocContainer!.classList.toggle("collapsed", isCollapsed);
  });

  // 滚动时高亮当前标题
  window.addEventListener("scroll", onScroll, { passive: true });
}

/**
 * 渲染完成后调用，重新提取标题并生成 TOC
 */
export function updateFloatingToc(previewEl: HTMLElement) {
  if (!tocList) return;

  tocItems = [];
  tocList.innerHTML = "";

  const headings = previewEl.querySelectorAll("h1, h2, h3, h4, h5, h6");
  if (headings.length === 0) {
    tocContainer?.classList.add("empty");
    return;
  }
  tocContainer?.classList.remove("empty");

  headings.forEach((heading) => {
    const level = parseInt(heading.tagName[1], 10);
    const text = heading.textContent || "";

    const item = document.createElement("div");
    item.className = `floating-toc-item toc-level-${level}`;
    item.textContent = text;
    item.addEventListener("click", () => {
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    tocList!.appendChild(item);
    tocItems.push({ el: item, heading: heading as HTMLElement, level });
  });

  // 初始高亮
  onScroll();
}

function onScroll() {
  if (tocItems.length === 0) return;

  const scrollTop = window.scrollY;
  const offset = 80; // 偏移量，让高亮稍微提前切换

  let activeIndex = 0;
  for (let i = tocItems.length - 1; i >= 0; i--) {
    if (tocItems[i].heading.offsetTop <= scrollTop + offset) {
      activeIndex = i;
      break;
    }
  }

  tocItems.forEach((item, i) => {
    item.el.classList.toggle("active", i === activeIndex);
  });

  // 确保激活项可见（TOC 列表本身可能需要滚动）
  const activeItem = tocItems[activeIndex];
  if (activeItem && tocList) {
    const itemTop = activeItem.el.offsetTop;
    const listHeight = tocList.clientHeight;
    const listScroll = tocList.scrollTop;

    if (itemTop < listScroll || itemTop > listScroll + listHeight - 30) {
      tocList.scrollTop = itemTop - listHeight / 2;
    }
  }
}
