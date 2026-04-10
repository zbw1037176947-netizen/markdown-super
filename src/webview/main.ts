/**
 * Webview 端入口 —— 运行在浏览器环境（VS Code 内嵌 iframe）
 *
 * 职责：
 * 1. 接收扩展主进程发来的 markdown 原文
 * 2. 用 markdown-it 渲染成 HTML（注入 data-line 用于滚动同步）
 * 3. 对 Mermaid / KaTeX 代码块做后处理渲染
 * 4. 代码块增强（复制按钮、语言标签、行号）
 * 5. 双向滚动同步
 * 6. 独立主题切换
 */

import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import taskLists from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";
import { renderMermaidBlocks } from "./renderers/mermaid";
import { renderKatexBlocks, katexPlugin } from "./renderers/katex";
import { injectSourceLines } from "./plugins/source-line";
import { enhanceCodeBlocks } from "./renderers/code-block";
import "./styles/preview.css";

const vscode = acquireVsCodeApi();

// ===== markdown-it 初始化 =====
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    if (lang === "mermaid") {
      return `<pre class="mermaid-block"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }

    let highlighted: string;
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(str, { language: lang }).value;
      } catch {
        highlighted = md.utils.escapeHtml(str);
      }
    } else {
      highlighted = md.utils.escapeHtml(str);
    }

    // 语言标签通过 data-lang 传递，后续 enhanceCodeBlocks 处理
    const langAttr = lang ? ` data-lang="${md.utils.escapeHtml(lang)}"` : "";
    return `<pre class="hljs code-block"${langAttr}><code>${highlighted}</code></pre>`;
  },
});

md.use(taskLists, { enabled: true });
md.use(footnote);
md.use(katexPlugin);
injectSourceLines(md);

// ===== DOM =====
const previewEl = document.getElementById("preview")!;
const loadingEl = document.getElementById("loading")!;

// ===== 状态 =====
let currentConfig = {
  mermaidEnabled: true,
  katexEnabled: true,
  theme: "auto" as "auto" | "light",
  fontSize: 16,
  lineNumbers: false,
};

// 标记是否由程序触发滚动（避免循环）
let isProgrammaticScroll = false;

// ===== 防抖渲染 =====
let renderTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRender(markdown: string) {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(() => doRender(markdown), 50);
}

async function doRender(markdown: string) {
  const scrollTop = document.documentElement.scrollTop;

  const html = md.render(markdown);

  previewEl.innerHTML = html;
  loadingEl.style.display = "none";
  previewEl.style.display = "block";

  previewEl.style.fontSize = `${currentConfig.fontSize}px`;

  // 代码块增强（复制按钮、语言标签、行号）
  enhanceCodeBlocks(previewEl, currentConfig.lineNumbers);

  // Mermaid
  if (currentConfig.mermaidEnabled) {
    await renderMermaidBlocks(previewEl);
  }

  // KaTeX
  if (currentConfig.katexEnabled) {
    renderKatexBlocks(previewEl);
  }

  // 拦截链接点击
  previewEl.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const href = a.getAttribute("href");
      if (href) {
        vscode.postMessage({ type: "openLink", href });
      }
    });
  });

  // 预览点击 → 跳转编辑器（反向同步）
  previewEl.querySelectorAll("[data-line]").forEach((el) => {
    el.addEventListener("click", (e) => {
      // 不拦截链接和按钮的点击
      if ((e.target as HTMLElement).closest("a, button")) return;
      const line = parseInt(el.getAttribute("data-line")!, 10);
      if (!isNaN(line)) {
        vscode.postMessage({ type: "revealLine", line });
      }
    });
  });

  // 重建 data-line 缓存
  buildLineCache();

  // 恢复滚动位置
  document.documentElement.scrollTop = scrollTop;
}

// ===== 滚动同步：编辑器 → 预览 =====

// 缓存 data-line 元素列表，避免每次都 querySelectorAll
let lineElements: { line: number; el: HTMLElement }[] = [];

function buildLineCache() {
  lineElements = [];
  previewEl.querySelectorAll("[data-line]").forEach((el) => {
    const line = parseInt(el.getAttribute("data-line")!, 10);
    if (!isNaN(line)) {
      lineElements.push({ line, el: el as HTMLElement });
    }
  });
}

let lastScrollLine = -1;

function scrollPreviewToLine(line: number) {
  // 跳过重复的行号（减少无效滚动）
  if (line === lastScrollLine) return;
  lastScrollLine = line;

  if (lineElements.length === 0) return;

  // 二分查找：找到 line 前后两个最近的 data-line 元素
  let lo = 0;
  let hi = lineElements.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lineElements[mid].line < line) lo = mid + 1;
    else hi = mid;
  }

  // 在前后元素之间做线性插值，精确计算滚动位置
  const after = lineElements[lo];
  const before = lo > 0 ? lineElements[lo - 1] : after;

  const beforeTop = before.el.offsetTop;
  const afterTop = after.el.offsetTop;

  let targetTop: number;
  if (before === after || before.line === after.line) {
    targetTop = beforeTop;
  } else {
    // 线性插值
    const ratio = (line - before.line) / (after.line - before.line);
    targetTop = beforeTop + (afterTop - beforeTop) * ratio;
  }

  // 滚动到目标位置（居中显示），用 instant 消除动画延迟
  const viewportHeight = document.documentElement.clientHeight;
  const scrollTarget = targetTop - viewportHeight / 3;

  isProgrammaticScroll = true;
  window.scrollTo({ top: Math.max(0, scrollTarget), behavior: "instant" as ScrollBehavior });
  requestAnimationFrame(() => { isProgrammaticScroll = false; });
}

// ===== 主题切换 =====

function applyTheme(theme: "auto" | "light") {
  document.body.classList.remove("theme-auto", "theme-light");
  document.body.classList.add(`theme-${theme}`);
}

// ===== 消息监听 =====

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.type) {
    case "update":
      currentConfig = { ...currentConfig, ...message.config };
      applyTheme(currentConfig.theme);
      scheduleRender(message.content);
      break;
    case "scrollToLine":
      scrollPreviewToLine(message.line);
      break;
    case "setTheme":
      currentConfig.theme = message.theme;
      applyTheme(message.theme);
      break;
  }
});

// 通知扩展：webview 已就绪
vscode.postMessage({ type: "ready" });
