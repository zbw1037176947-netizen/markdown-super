/**
 * Webview 端入口 —— 运行在浏览器环境（VS Code 内嵌 iframe）
 */

import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import taskLists from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";
import { renderMermaidBlocks } from "./renderers/mermaid";
import { renderKatexBlocks, katexPlugin } from "./renderers/katex";
import { renderPlantUmlBlocks } from "./renderers/plantuml";
import { renderMarkmapBlocks } from "./renderers/markmap";
import { injectSourceLines } from "./plugins/source-line";
import { frontmatterPlugin } from "./plugins/frontmatter";
import { enhanceCodeBlocks } from "./renderers/code-block";
import { initPreviewSearch } from "./features/search";
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
md.use(katexPlugin);
md.use(frontmatterPlugin);
injectSourceLines(md);

// ===== DOM =====
const previewEl = document.getElementById("preview")!;
const loadingEl = document.getElementById("loading")!;

// ===== 初始化预览内搜索 =====
initPreviewSearch(previewEl);

// ===== 状态 =====
let currentConfig = {
  mermaidEnabled: true,
  katexEnabled: true,
  theme: "auto" as "auto" | "light",
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
      if (href) {
        vscode.postMessage({ type: "openLink", href });
      }
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
      if (message.baseUri) baseUri = message.baseUri as string;
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

vscode.postMessage({ type: "ready" });
