/**
 * Webview 端入口 —— 运行在浏览器环境（VS Code 内嵌 iframe）
 */

import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import taskLists from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";
import anchor from "markdown-it-anchor";
import { full as emoji } from "markdown-it-emoji";
import { renderMermaidBlocks } from "./renderers/mermaid";
import { renderKatexBlocks, katexPlugin } from "./renderers/katex";
import { renderPlantUmlBlocks } from "./renderers/plantuml";
import { renderMarkmapBlocks } from "./renderers/markmap";
import { injectSourceLines } from "./plugins/source-line";
import { frontmatterPlugin } from "./plugins/frontmatter";
import { gfmAlertPlugin } from "./plugins/gfm-alert";
import { enhanceCodeBlocks } from "./renderers/code-block";
import { initPreviewSearch } from "./features/search";
import { initFloatingToc, updateFloatingToc } from "./features/floating-toc";
import { initImageZoom } from "./features/image-zoom";
import "./styles/preview.css";

const vscode = acquireVsCodeApi();

// ===== markdown-it 初始化 =====
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    // 特殊代码块：交给后处理器渲染
    if (lang === "mermaid") {
      return `<pre class="mermaid-block"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
    if (lang === "plantuml" || lang === "puml") {
      return `<pre class="plantuml-block"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
    if (lang === "markmap") {
      return `<pre class="markmap-block"><code>${md.utils.escapeHtml(str)}</code></pre>`;
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

    const langAttr = lang ? ` data-lang="${md.utils.escapeHtml(lang)}"` : "";
    return `<pre class="hljs code-block"${langAttr}><code>${highlighted}</code></pre>`;
  },
});

md.use(taskLists, { enabled: true });
md.use(footnote);
md.use(emoji);
md.use(anchor, {
  permalink: false,
  // GitHub 风格 slugify：小写 + 空格转连字符 + 去掉标点（保留中文和连字符）
  slugify: (s: string) =>
    s.trim().toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, ""),
});
md.use(katexPlugin);
md.use(frontmatterPlugin);
md.use(gfmAlertPlugin);
injectSourceLines(md);

// ===== DOM =====
const previewEl = document.getElementById("preview")!;
const loadingEl = document.getElementById("loading")!;

// ===== 初始化预览内搜索 & 浮动 TOC =====
initPreviewSearch(previewEl);
initFloatingToc();
initImageZoom(previewEl);

// ===== 阅读进度条 =====
const progressBar = document.createElement("div");
progressBar.className = "reading-progress";
document.body.prepend(progressBar);

window.addEventListener("scroll", () => {
  const scrollTop = document.documentElement.scrollTop;
  const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  progressBar.style.width = `${progress}%`;
}, { passive: true });

// ===== 追踪最后交互的源码行号 =====
// -1 表示"尚未有明确位置"，不应主动上报
let lastInteractedLine = -1;

// 点击/右键：立即更新为点击元素所在的 data-line（优先使用）
document.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement;
  const lineEl = target.closest("[data-line]");
  if (lineEl) {
    const line = parseInt(lineEl.getAttribute("data-line")!, 10);
    if (!isNaN(line)) lastInteractedLine = line;
  }
}, true);

// ===== 状态 =====
let currentConfig = {
  mermaidEnabled: true,
  katexEnabled: true,
  theme: "github",
  fontSize: 16,
  lineNumbers: false,
};

// 文档目录的 webview URI（用于解析相对路径图片）
let baseUri = "";

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

  // 代码块增强
  enhanceCodeBlocks(previewEl, currentConfig.lineNumbers);

  // 解析图片相对路径 → webview URI
  if (baseUri) {
    previewEl.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (src && !src.startsWith("http") && !src.startsWith("data:") && !src.startsWith("vscode-")) {
        // 相对路径：拼接 baseUri
        const resolved = baseUri + "/" + src.replace(/^\.\//, "");
        img.setAttribute("src", resolved);
      }
    });
  }

  // 图表渲染（并行）
  const renderTasks: Promise<void>[] = [];

  if (currentConfig.mermaidEnabled) {
    renderTasks.push(renderMermaidBlocks(previewEl));
  }
  renderTasks.push(renderPlantUmlBlocks(previewEl));
  renderTasks.push(renderMarkmapBlocks(previewEl));

  await Promise.all(renderTasks);

  // KaTeX
  if (currentConfig.katexEnabled) {
    renderKatexBlocks(previewEl);
  }

  // 拦截链接点击
  previewEl.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const href = a.getAttribute("href");
      if (!href) return;
      // 文档内锚点链接 → 预览内跳转
      if (href.startsWith("#")) {
        const anchor = decodeURIComponent(href.slice(1));
        // 先精确匹配 id，再尝试模糊匹配
        const target =
          document.getElementById(anchor) ||
          document.getElementById(CSS.escape(anchor)) ||
          previewEl.querySelector(`[id="${CSS.escape(anchor)}"]`);
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        // 锚点找不到也不要跳外部
        return;
      }
      vscode.postMessage({ type: "openLink", href });
    });
  });

  // 预览点击 → 跳转编辑器
  previewEl.querySelectorAll("[data-line]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("a, button")) return;
      const line = parseInt(el.getAttribute("data-line")!, 10);
      if (!isNaN(line)) {
        vscode.postMessage({ type: "revealLine", line });
      }
    });
  });

  buildLineCache();
  updateFloatingToc(previewEl);
  document.documentElement.scrollTop = scrollTop;

  // 通知扩展渲染完成（扩展可能在等这个信号来执行初始滚动同步）
  vscode.postMessage({ type: "rendered" });
}

// ===== 滚动同步（视口对视口映射）=====
//
// 核心原则：
//   - 编辑器视口顶部行 N → 预览把 line=N 的位置滚到视口顶部
//   - 预览视口顶部像素 Y → 对应源码行 M → 编辑器 revealRange(M, AtTop)
// 双向用同一个锚点（视口顶部），对称、可预测

let lineElements: { line: number; el: HTMLElement }[] = [];

function buildLineCache() {
  lineElements = [];
  previewEl.querySelectorAll("[data-line]").forEach((el) => {
    const line = parseInt(el.getAttribute("data-line")!, 10);
    if (!isNaN(line)) {
      lineElements.push({ line, el: el as HTMLElement });
    }
  });
  lineElements.sort((a, b) => a.line - b.line);
}

/**
 * 给定源码行号，通过相邻 data-line 元素插值，计算预览中的 scrollY 目标位置
 */
function lineToScrollY(line: number): number {
  if (lineElements.length === 0) return 0;
  if (line <= lineElements[0].line) return 0;
  if (line >= lineElements[lineElements.length - 1].line) {
    return lineElements[lineElements.length - 1].el.offsetTop;
  }

  // 二分：找到 line 前后的元素
  let lo = 0;
  let hi = lineElements.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lineElements[mid].line < line) lo = mid + 1;
    else hi = mid;
  }
  const after = lineElements[lo];
  const before = lo > 0 ? lineElements[lo - 1] : after;
  if (before === after || after.line === before.line) return before.el.offsetTop;

  const ratio = (line - before.line) / (after.line - before.line);
  return before.el.offsetTop + (after.el.offsetTop - before.el.offsetTop) * ratio;
}

/**
 * 给定预览中的 scrollY 位置（通常是视口顶部），通过插值计算对应源码行号
 */
function scrollYToLine(scrollY: number): number {
  if (lineElements.length === 0) return 0;
  if (scrollY <= lineElements[0].el.offsetTop) return lineElements[0].line;
  if (scrollY >= lineElements[lineElements.length - 1].el.offsetTop) {
    return lineElements[lineElements.length - 1].line;
  }

  // 二分：找到 scrollY 前后的元素
  let lo = 0;
  let hi = lineElements.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lineElements[mid].el.offsetTop < scrollY) lo = mid + 1;
    else hi = mid;
  }
  const after = lineElements[lo];
  const before = lo > 0 ? lineElements[lo - 1] : after;
  if (before === after || after.el.offsetTop === before.el.offsetTop) return before.line;

  const ratio = (scrollY - before.el.offsetTop) / (after.el.offsetTop - before.el.offsetTop);
  return Math.round(before.line + (after.line - before.line) * ratio);
}

/**
 * 用户滚动预览时：用视口顶部反推行号，更新 lastInteractedLine
 * 程序滚动时不更新
 */
let scrollTrackingRaf: number | null = null;
window.addEventListener("scroll", () => {
  if (isProgrammaticScroll) return;
  if (scrollTrackingRaf !== null) return;
  scrollTrackingRaf = requestAnimationFrame(() => {
    scrollTrackingRaf = null;
    if (isProgrammaticScroll) return;
    if (lineElements.length === 0) return;
    const line = scrollYToLine(window.scrollY);
    if (line >= 0) lastInteractedLine = line;
  });
}, { passive: true });

/**
 * 接收编辑器发来的滚动请求，把 line 位置滚到视口顶部
 */
function scrollPreviewToLine(line: number) {
  if (lineElements.length === 0) return;
  const targetY = lineToScrollY(line);

  isProgrammaticScroll = true;
  window.scrollTo({ top: Math.max(0, targetY), behavior: "instant" as ScrollBehavior });
  setTimeout(() => { isProgrammaticScroll = false; }, 150);
  lastInteractedLine = line;
}

// ===== 主题 =====

// 主题列表，定义各主题的样式变体属性
const THEME_STYLES: Record<string, { headingStyle: string; hrStyle: string; codeHeader: string }> = {
  auto:           { headingStyle: "border",      hrStyle: "fade",  codeHeader: "flat" },
  github:         { headingStyle: "border",      hrStyle: "fade",  codeHeader: "flat" },
  notion:         { headingStyle: "plain",       hrStyle: "plain", codeHeader: "flat" },
  medium:         { headingStyle: "plain",       hrStyle: "stars", codeHeader: "flat" },
  vue:            { headingStyle: "accent-left", hrStyle: "fade",  codeHeader: "flat" },
  "purple-night": { headingStyle: "gradient",    hrStyle: "dots",  codeHeader: "macos" },
  minimalist:     { headingStyle: "plain",       hrStyle: "plain", codeHeader: "flat" },
  "chinese-doc":  { headingStyle: "accent-left", hrStyle: "fade",  codeHeader: "flat" },
};

function applyTheme(theme: string) {
  document.body.setAttribute("data-theme", theme);

  const styles = THEME_STYLES[theme] || THEME_STYLES.github;
  document.body.setAttribute("data-heading-style", styles.headingStyle);
  document.body.setAttribute("data-hr-style", styles.hrStyle);
  document.body.setAttribute("data-code-header", styles.codeHeader);
}

// ===== 消息监听 =====

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.type) {
    case "update":
      currentConfig = { ...currentConfig, ...message.config };
      if (message.baseUri) baseUri = message.baseUri as string;
      applyTheme(currentConfig.theme as string);
      scheduleRender(message.content);
      break;
    case "scrollToLine":
      scrollPreviewToLine(message.line);
      break;
    case "setTheme":
      currentConfig.theme = message.theme;
      applyTheme(message.theme as string);
      break;
    case "requestClose":
      // 扩展请求关闭预览，带上当前行号
      vscode.postMessage({ type: "closePreview", line: lastInteractedLine });
      break;
  }
});

vscode.postMessage({ type: "ready" });
