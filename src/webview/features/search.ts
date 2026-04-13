/**
 * 预览面板内搜索
 *
 * Ctrl+F 打开搜索框，高亮匹配文本，Enter/Shift+Enter 在结果间导航
 */

export function initPreviewSearch(container: HTMLElement) {
  let searchBar: HTMLElement | null = null;
  let searchInput: HTMLInputElement | null = null;
  let highlights: HTMLElement[] = [];
  let currentIndex = -1;

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "f") {
      e.preventDefault();
      showSearchBar();
    }
    if (e.key === "Escape" && searchBar) {
      hideSearchBar();
    }
  });

  function showSearchBar() {
    if (searchBar) {
      searchInput?.focus();
      searchInput?.select();
      return;
    }

    searchBar = document.createElement("div");
    searchBar.className = "preview-search-bar";
    searchBar.innerHTML = `
      <input type="text" class="preview-search-input" placeholder="Search in preview..." />
      <span class="preview-search-count"></span>
      <button class="preview-search-btn" data-dir="prev" title="Previous (Shift+Enter)">&#x25B2;</button>
      <button class="preview-search-btn" data-dir="next" title="Next (Enter)">&#x25BC;</button>
      <button class="preview-search-btn preview-search-close" title="Close (Esc)">&times;</button>
    `;
    document.body.prepend(searchBar);

    searchInput = searchBar.querySelector(".preview-search-input") as HTMLInputElement;
    const countEl = searchBar.querySelector(".preview-search-count") as HTMLElement;

    searchInput.addEventListener("input", () => {
      doSearch(searchInput!.value, countEl);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          navigateResult(-1, countEl);
        } else {
          navigateResult(1, countEl);
        }
      }
    });

    searchBar.querySelector('[data-dir="prev"]')?.addEventListener("click", () => {
      navigateResult(-1, countEl);
    });
    searchBar.querySelector('[data-dir="next"]')?.addEventListener("click", () => {
      navigateResult(1, countEl);
    });
    searchBar.querySelector(".preview-search-close")?.addEventListener("click", () => {
      hideSearchBar();
    });

    searchInput.focus();
  }

  function hideSearchBar() {
    clearHighlights();
    searchBar?.remove();
    searchBar = null;
    searchInput = null;
  }

  function doSearch(query: string, countEl: HTMLElement) {
    clearHighlights();
    currentIndex = -1;

    if (!query || query.length < 2) {
      countEl.textContent = "";
      return;
    }

    // 使用 TreeWalker 遍历文本节点
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    const matches: { node: Text; index: number }[] = [];
    const lowerQuery = query.toLowerCase();

    let textNode: Text | null;
    while ((textNode = walker.nextNode() as Text | null)) {
      const text = textNode.textContent || "";
      const lowerText = text.toLowerCase();
      let idx = lowerText.indexOf(lowerQuery);
      while (idx !== -1) {
        matches.push({ node: textNode, index: idx });
        idx = lowerText.indexOf(lowerQuery, idx + 1);
      }
    }

    // 用 <mark> 高亮匹配（从后往前替换，避免索引偏移）
    for (let i = matches.length - 1; i >= 0; i--) {
      const { node, index } = matches[i];
      // 文本节点可能在上一轮高亮时已被移除，跳过
      if (!node.parentNode) continue;

      const range = document.createRange();
      try {
        range.setStart(node, index);
        range.setEnd(node, index + query.length);

        const mark = document.createElement("mark");
        mark.className = "search-highlight";
        try {
          // 理想路径：选择在单个文本节点内，surroundContents 直接成功
          range.surroundContents(mark);
        } catch {
          // fallback：跨节点或其他情况，用 extractContents + insertNode
          const contents = range.extractContents();
          mark.appendChild(contents);
          range.insertNode(mark);
        }
        highlights.push(mark);
      } catch {
        // 范围无效（如 node 已脱离 DOM）：静默跳过该匹配
      } finally {
        range.detach?.();
      }
    }

    // 反转（因为从后往前插入的）
    highlights.reverse();

    countEl.textContent = highlights.length > 0 ? `${highlights.length} results` : "No results";

    // 自动跳转到第一个结果
    if (highlights.length > 0) {
      navigateResult(1, countEl);
    }
  }

  function navigateResult(direction: number, countEl: HTMLElement) {
    if (highlights.length === 0) return;

    // 移除当前高亮
    if (currentIndex >= 0 && currentIndex < highlights.length) {
      highlights[currentIndex].classList.remove("search-current");
    }

    currentIndex += direction;
    if (currentIndex >= highlights.length) currentIndex = 0;
    if (currentIndex < 0) currentIndex = highlights.length - 1;

    const current = highlights[currentIndex];
    current.classList.add("search-current");
    current.scrollIntoView({ behavior: "smooth", block: "center" });

    countEl.textContent = `${currentIndex + 1}/${highlights.length}`;
  }

  function clearHighlights() {
    for (const mark of highlights) {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
        parent.normalize(); // 合并相邻文本节点
      }
    }
    highlights = [];
  }
}
