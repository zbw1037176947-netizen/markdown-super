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
let lastInteractedLine = 0;

// 点击或右键时，找到最近的 data-line 元素记录行号
document.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement;
  const lineEl = target.closest("[data-line]");
  if (lineEl) {
    const line = parseInt(lineEl.getAttribute("data-line")!, 10);
    if (!isNaN(line)) lastInteractedLine = line;
  }
});

// 滚动时也更新（取视口中间的 data-line 元素）
window.addEventListener("scroll", () => {
  const viewportMid = window.scrollY + window.innerHeight / 2;
  let closest = 0;
  let closestDist = Infinity;
  previewEl.querySelectorAll("[data-line]").forEach((el) => {
    const htmlEl = el as HTMLElement;
    const dist = Math.abs(htmlEl.offsetTop - viewportMid);
    if (dist < closestDist) {
      closestDist = dist;
      closest = parseInt(el.getAttribute("data-line")!, 10) || 0;
    }
  });
  lastInteractedLine = closest;
}, { passive: true });

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
}

// ===== 滚动同步 =====

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
  if (line === lastScrollLine) return;
  lastScrollLine = line;
  if (lineElements.length === 0) return;

  let lo = 0;
  let hi = lineElements.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lineElements[mid].line < line) lo = mid + 1;
    else hi = mid;
  }

  const after = lineElements[lo];
  const before = lo > 0 ? lineElements[lo - 1] : after;

  const beforeTop = before.el.offsetTop;
  const afterTop = after.el.offsetTop;

  let targetTop: number;
  if (before === after || before.line === after.line) {
    targetTop = beforeTop;
  } else {
    const ratio = (line - before.line) / (after.line - before.line);
    targetTop = beforeTop + (afterTop - beforeTop) * ratio;
  }

  const viewportHeight = document.documentElement.clientHeight;
  const scrollTarget = targetTop - viewportHeight / 3;

  isProgrammaticScroll = true;
  window.scrollTo({ top: Math.max(0, scrollTarget), behavior: "instant" as ScrollBehavior });
  requestAnimationFrame(() => { isProgrammaticScroll = false; });
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
