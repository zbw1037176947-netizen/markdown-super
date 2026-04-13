/**
 * markdown-it 插件：GFM Alert (Admonition)
 *
 * 解析 GitHub 风格的提示块：
 *   > [!NOTE]
 *   > Content here
 *
 * 支持 5 种类型：NOTE, TIP, IMPORTANT, WARNING, CAUTION
 *
 * 实现方式：只修改 blockquote 的 open/close renderer，
 * 不覆盖 inline renderer，避免破坏粗体/斜体等 inline 渲染。
 */

import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

const ALERT_TYPES: Record<string, { icon: string; label: string; cssClass: string }> = {
  NOTE:      { icon: "ℹ️",  label: "Note",      cssClass: "alert-note" },
  TIP:       { icon: "💡", label: "Tip",       cssClass: "alert-tip" },
  IMPORTANT: { icon: "❗", label: "Important", cssClass: "alert-important" },
  WARNING:   { icon: "⚠️",  label: "Warning",   cssClass: "alert-warning" },
  CAUTION:   { icon: "🔴", label: "Caution",   cssClass: "alert-caution" },
};

const ALERT_REGEX = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

// 用 WeakSet 记录哪些 blockquote_open token 是 alert，比在 token 上挂私有字段更干净
const alertTokens = new WeakMap<Token, string>();

export function gfmAlertPlugin(md: MarkdownIt) {
  const defaultRender: typeof md.renderer.renderToken = (tokens, idx, options) =>
    md.renderer.renderToken(tokens, idx, options);

  const originalBlockquoteOpen = md.renderer.rules.blockquote_open ?? defaultRender;
  const originalBlockquoteClose = md.renderer.rules.blockquote_close ?? defaultRender;

  md.renderer.rules.blockquote_open = (tokens, idx, options, env, self) => {
    const alertType = findAlertType(tokens, idx);
    if (alertType) {
      const alert = ALERT_TYPES[alertType];
      alertTokens.set(tokens[idx], alertType);

      stripAlertMarker(tokens, idx);

      const lineAttr = tokens[idx].map ? tokens[idx].map![0] : "";
      return `<div class="gfm-alert ${alert.cssClass}" data-line="${lineAttr}">
  <div class="gfm-alert-title">${alert.icon} ${alert.label}</div>
  <div class="gfm-alert-body">`;
    }
    return originalBlockquoteOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.blockquote_close = (tokens, idx, options, env, self) => {
    const openIdx = findMatchingOpen(tokens, idx);
    if (openIdx !== -1 && alertTokens.has(tokens[openIdx])) {
      return `</div></div>`;
    }
    return originalBlockquoteClose(tokens, idx, options, env, self);
  };
}

/**
 * 检测 blockquote 内第一个 inline token 是否以 [!TYPE] 开头
 */
function findAlertType(tokens: Token[], blockquoteOpenIdx: number): string | null {
  for (let i = blockquoteOpenIdx + 1; i < tokens.length; i++) {
    if (tokens[i].type === "blockquote_close") break;
    if (tokens[i].type === "inline") {
      const match = tokens[i].content.match(ALERT_REGEX);
      if (match) return match[1];
      break;
    }
  }
  return null;
}

/**
 * 从 inline token 的 children 中移除 [!TYPE] 标记文本
 */
function stripAlertMarker(tokens: Token[], blockquoteOpenIdx: number) {
  for (let i = blockquoteOpenIdx + 1; i < tokens.length; i++) {
    if (tokens[i].type === "blockquote_close") break;
    if (tokens[i].type === "inline" && tokens[i].children) {
      const children = tokens[i].children!;

      for (let j = 0; j < children.length; j++) {
        if (children[j].type === "text") {
          const match = children[j].content.match(ALERT_REGEX);
          if (match) {
            children[j].content = children[j].content.replace(ALERT_REGEX, "");
            if (!children[j].content) {
              children.splice(j, 1);
            }
            if (j < children.length && children[j].type === "softbreak") {
              children.splice(j, 1);
            }
          }
          break;
        }
      }

      tokens[i].content = tokens[i].content.replace(ALERT_REGEX, "");
      break;
    }
  }
}

function findMatchingOpen(tokens: Token[], closeIdx: number): number {
  let depth = 0;
  for (let i = closeIdx; i >= 0; i--) {
    if (tokens[i].type === "blockquote_close") depth++;
    if (tokens[i].type === "blockquote_open") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
