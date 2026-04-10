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

export function injectSourceLines(md: MarkdownIt) {
  // 保存原始渲染规则的引用
  const defaultRender =
    md.renderer.rules.paragraph_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

  // 通用处理：给所有带 map 的 opening token 注入 data-line
  const addLineAttr = (tokenName: string) => {
    const original =
      md.renderer.rules[tokenName] ||
      ((tokens: any, idx: any, options: any, _env: any, self: any) =>
        self.renderToken(tokens, idx, options));

    md.renderer.rules[tokenName] = (tokens, idx, options, env, self) => {
      const token = tokens[idx];
      if (token.map && token.map.length >= 2) {
        token.attrSet("data-line", String(token.map[0]));
      }
      return original(tokens, idx, options, env, self);
    };
  };

  // 给所有常见的块级 opening token 注入 data-line
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

  // fence（代码块）需要特殊处理，因为它的 data-line 要加到外层 <pre> 上
  // 而 highlight 函数返回的是完整的 <pre><code>，所以在 highlight 返回的 HTML 里注入
  const originalFence =
    md.renderer.rules.fence ||
    ((tokens: any, idx: any, options: any, _env: any, self: any) =>
      self.renderToken(tokens, idx, options));

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const line = token.map ? token.map[0] : null;

    // 调用 highlight 或默认渲染
    let result = originalFence(tokens, idx, options, env, self);

    // 在第一个 <pre 标签上注入 data-line
    if (line !== null) {
      result = result.replace(/^<pre/, `<pre data-line="${line}"`);
    }

    return result;
  };
}
