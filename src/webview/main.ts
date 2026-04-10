/**
 * Webview 端入口 —— 运行在浏览器环境（VS Code 内嵌 iframe）
 *
 * 职责：
 * 1. 接收扩展主进程发来的 markdown 原文
 * 2. 用 markdown-it 渲染成 HTML
 * 3. 对 Mermaid / KaTeX 代码块做后处理渲染
 */

import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import taskLists from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";
import { renderMermaidBlocks } from "./renderers/mermaid";
import { renderKatexBlocks, katexPlugin } from "./renderers/katex";
import "./styles/preview.css";

// 获取 VS Code API（只能调用一次）
const vscode = acquireVsCodeApi();

// 初始化 markdown-it
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string): string {
    // 跳过 mermaid 代码块（留给后处理器）
    if (lang === "mermaid") {
      return `<pre class="mermaid-block"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`;
      } catch {
        // fallthrough
      }
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
});

// 注册插件
md.use(taskLists, { enabled: true });
md.use(footnote);
md.use(katexPlugin);

// DOM 元素
const previewEl = document.getElementById("preview")!;
const loadingEl = document.getElementById("loading")!;

// 当前配置
let currentConfig = {
  mermaidEnabled: true,
  katexEnabled: true,
  theme: "auto",
  fontSize: 16,
};

// 防抖渲染
let renderTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRender(markdown: string) {
  if (renderTimer) {
    clearTimeout(renderTimer);
  }
  renderTimer = setTimeout(() => {
    doRender(markdown);
  }, 50); // 50ms 防抖，打字时不会每个字符都重新渲染
}

async function doRender(markdown: string) {
  // 保存滚动位置
  const scrollTop = document.documentElement.scrollTop;

  // markdown-it 渲染
  const html = md.render(markdown);

  // 写入 DOM
  previewEl.innerHTML = html;
  loadingEl.style.display = "none";
  previewEl.style.display = "block";

  // 应用字体大小
  previewEl.style.fontSize = `${currentConfig.fontSize}px`;

  // 后处理：Mermaid 图表
  if (currentConfig.mermaidEnabled) {
    await renderMermaidBlocks(previewEl);
  }

  // 后处理：KaTeX 公式（inline 已由 markdown-it 插件处理，这里处理 display math 渲染失败的情况）
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

  // 恢复滚动位置
  document.documentElement.scrollTop = scrollTop;
}

// 监听扩展主进程消息
window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.type) {
    case "update":
      currentConfig = { ...currentConfig, ...message.config };
      scheduleRender(message.content);
      break;
  }
});

// 通知扩展：webview 已就绪
vscode.postMessage({ type: "ready" });
