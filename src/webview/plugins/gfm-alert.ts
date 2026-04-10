/**
 * markdown-it 插件：GFM Alert (Admonition)
 *
 * 解析 GitHub 风格的提示块：
 *   > [!NOTE]
 *   > Content here
 *
 * 支持 5 种类型：NOTE, TIP, IMPORTANT, WARNING, CAUTION
 */

import type MarkdownIt from "markdown-it";

const ALERT_TYPES: Record<string, { icon: string; label: string; cssClass: string }> = {
  NOTE:      { icon: "ℹ️",  label: "Note",      cssClass: "alert-note" },
  TIP:       { icon: "💡", label: "Tip",       cssClass: "alert-tip" },
  IMPORTANT: { icon: "❗", label: "Important", cssClass: "alert-important" },
  WARNING:   { icon: "⚠️",  label: "Warning",   cssClass: "alert-warning" },
  CAUTION:   { icon: "🔴", label: "Caution",   cssClass: "alert-caution" },
};

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
    // 检查 blockquote 内第一个 inline token 是否以 [!TYPE] 开头
    const alertType = findAlertType(tokens, idx);
    if (alertType) {
      const alert = ALERT_TYPES[alertType];
      // 标记这个 blockquote 为 alert，在 close 时用
      (tokens[idx] as any)._alertType = alertType;
      return `<div class="gfm-alert ${alert.cssClass}" data-line="${tokens[idx].map ? tokens[idx].map[0] : ""}">
  <div class="gfm-alert-title">${alert.icon} ${alert.label}</div>
  <div class="gfm-alert-body">`;
    }
    return originalBlockquoteOpen(tokens, idx, options, env, self);
  };

  md.renderer.rules.blockquote_close = (tokens, idx, options, env, self) => {
    // 找到对应的 open token
    const openIdx = findMatchingOpen(tokens, idx);
    if (openIdx !== -1 && (tokens[openIdx] as any)._alertType) {
      return `</div></div>`;
    }
    return originalBlockquoteClose(tokens, idx, options, env, self);
  };

  // 修改 inline 渲染，移除 [!TYPE] 标记文本
  const originalInline =
    md.renderer.rules.inline ||
    ((tokens: any, idx: any, options: any, env: any, self: any) =>
      self.renderInline(tokens[idx].children, options, env));

  md.renderer.rules.inline = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    // 检查是否在 alert blockquote 中，且是第一个 inline
    if (token.content && /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/.test(token.content)) {
      // 移除 [!TYPE] 标记，渲染剩余内容
      const cleaned = token.content.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/, "");
      if (!cleaned.trim()) return "";
      // 手动渲染清理后的内容
      token.content = cleaned;
    }
    return self.renderInline(token.children || [], options, env);
  };
}

function findAlertType(tokens: any[], blockquoteOpenIdx: number): string | null {
  // 在 blockquote_open 之后找第一个 inline token
  for (let i = blockquoteOpenIdx + 1; i < tokens.length; i++) {
    if (tokens[i].type === "blockquote_close") break;
    if (tokens[i].type === "inline") {
      const match = tokens[i].content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/);
      if (match) return match[1];
      break;
    }
  }
  return null;
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
