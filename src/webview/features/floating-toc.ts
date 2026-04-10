/**
 * 预览面板内浮动 TOC 导航栏
 *
 * 默认展开，整体半透明，鼠标移入时变清晰
 */

let tocContainer: HTMLElement | null = null;
let tocList: HTMLElement | null = null;
let tocItems: { el: HTMLElement; heading: HTMLElement }[] = [];

export function initFloatingToc() {
  tocContainer = document.createElement("div");
  tocContainer.className = "floating-toc";
  tocContainer.innerHTML = `
    <div class="floating-toc-header">Outline</div>
    <div class="floating-toc-list"></div>
  `;
  document.body.appendChild(tocContainer);

  tocList = tocContainer.querySelector(".floating-toc-list")!;

  window.addEventListener("scroll", onScroll, { passive: true });
}

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
    tocItems.push({ el: item, heading: heading as HTMLElement });
  });

  onScroll();
}

function onScroll() {
  if (tocItems.length === 0) return;

  const scrollTop = window.scrollY;
  const offset = 80;

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
