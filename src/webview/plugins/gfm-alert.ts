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

const ALERT_TYPES: Record<string, { icon: string; label: string; cssClass: string }> = {
  NOTE:      { icon: "ℹ️",  label: "Note",      cssClass: "alert-note" },
  TIP:       { icon: "💡", label: "Tip",       cssClass: "alert-tip" },
  IMPORTANT: { icon: "❗", label: "Important", cssClass: "alert-important" },
  WARNING:   { icon: "⚠️",  label: "Warning",   cssClass: "alert-warning" },
  CAUTION:   { icon: "🔴", label: "Caution",   cssClass: "alert-caution" },
};

const ALERT_REGEX = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/;

export function gfmAlertPlugin(md: MarkdownIt) {
  const originalBlockquoteOpen =
    md.renderer.rules.blockquote_open ||
    ((tokens: any, idx: any, options: any, _env: any, self: any) =>
      self.renderToken(tokens, idx, options));

  const originalBlockquoteClose =
    md.renderer.rules.blockquote_close ||
    ((tokens: any, idx: any, options: any, _env: any, self: any) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.blockquote_open = (tokens, idx, options, env, self) => {
    const alertType = findAlertType(tokens, idx);
    if (alertType) {
      const alert = ALERT_TYPES[alertType];
      (tokens[idx] as any)._alertType = alertType;

      // 在 blockquote_open renderer 中直接修改第一个 inline token 的 children，
      // 移除 [!TYPE] 标记，这样不需要覆盖全局 inline renderer
      stripAlertMarker(tokens, idx);

      return `<div class="gfm-alert ${alert.cssClass}" data-line="${tokens[idx].map ? tokens[idx].map[0] : ""}">
  <div class="gfm-alert-title">${alert.icon} ${alert.label}</div>
  <div class="gfm-alert-body">`;
    }
    return originalBlockquoteOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.blockquote_close = (tokens, idx, options, env, self) => {
    const openIdx = findMatchingOpen(tokens, idx);
    if (openIdx !== -1 && (tokens[openIdx] as any)._alertType) {
      return `</div></div>`;
    }
    return originalBlockquoteClose(tokens, idx, options, env, self);
  };

  // 注意：不再覆盖 md.renderer.rules.inline
}

/**
 * 检测 blockquote 内第一个 inline token 是否以 [!TYPE] 开头
 */
function findAlertType(tokens: any[], blockquoteOpenIdx: number): string | null {
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
function stripAlertMarker(tokens: any[], blockquoteOpenIdx: number) {
  for (let i = blockquoteOpenIdx + 1; i < tokens.length; i++) {
    if (tokens[i].type === "blockquote_close") break;
    if (tokens[i].type === "inline" && tokens[i].children) {
      const children = tokens[i].children;

      // 找到第一个 text token，移除 [!TYPE] 标记
      for (let j = 0; j < children.length; j++) {
        if (children[j].type === "text") {
          const match = children[j].content.match(ALERT_REGEX);
          if (match) {
            children[j].content = children[j].content.replace(ALERT_REGEX, "");
            // 如果清除后为空，移除这个 token
            if (!children[j].content) {
              children.splice(j, 1);
            }
            // 同时移除紧跟的 softbreak（换行）
            if (j < children.length && children[j].type === "softbreak") {
              children.splice(j, 1);
            }
          }
          break;
        }
      }

      // 同步更新 content
      tokens[i].content = tokens[i].content.replace(ALERT_REGEX, "");
      break;
    }
  }
}

function findMatchingOpen(tokens: any[], closeIdx: number): number {
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
