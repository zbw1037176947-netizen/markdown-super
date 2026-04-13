/**
 * markdown-it 插件：在块级元素上注入 data-line 属性
 *
 * 这样 webview 端可以通过 data-line 找到每个元素对应的源码行号，
 * 实现编辑器 ↔ 预览的双向滚动同步。
 *
 * markdown-it 的 token.map 记录了 [startLine, endLine]，
 * 我们只需要在渲染时把 startLine 写入 HTML 属性。
 */

import type MarkdownIt from "markdown-it";
import type Token from "markdown-it/lib/token.mjs";

type RenderRule = NonNullable<MarkdownIt["renderer"]["rules"][string]>;

export function injectSourceLines(md: MarkdownIt) {
  const defaultRender: RenderRule = (tokens, idx, options, _env, self) =>
    self.renderToken(tokens, idx, options);

  // 通用处理：给所有带 map 的 opening token 注入 data-line
  const addLineAttr = (tokenName: string) => {
    const original: RenderRule = md.renderer.rules[tokenName] ?? defaultRender;

    md.renderer.rules[tokenName] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.map && token.map.length >= 2) {
        token.attrSet("data-line", String(token.map[0]));
      }
      return original(tokens, idx, options, env, self);
    };
  };

  const blockTokens = [
    "paragraph_open",
    "heading_open",
    "blockquote_open",
    "bullet_list_open",
    "ordered_list_open",
    "list_item_open",
    "table_open",
    "fence",
    "code_block",
    "hr",
    "html_block",
  ];

  for (const tokenName of blockTokens) {
    addLineAttr(tokenName);
  }

  // fence 需要特殊处理：highlight 函数返回完整 <pre><code>，在结果 HTML 里注入 data-line
  const originalFence: RenderRule = md.renderer.rules.fence ?? defaultRender;

  md.renderer.rules.fence = (tokens: Token[], idx, options, env, self) => {
    const token = tokens[idx];
    const line = token.map ? token.map[0] : null;

    let result = originalFence(tokens, idx, options, env, self);

    if (line !== null) {
      result = result.replace(/^<pre/, `<pre data-line="${line}"`);
    }

    return result;
  };
}
