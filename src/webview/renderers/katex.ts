/**
 * KaTeX 数学公式渲染器
 *
 * 两部分：
 * 1. markdown-it 插件：解析 $...$ 和 $$...$$ 语法
 * 2. 后处理器：在 DOM 中渲染公式
 */

import katex from "katex";
import "katex/dist/katex.min.css";
import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";

/**
 * markdown-it 插件：解析 $...$ (inline) 和 $$...$$ (display) 数学公式
 */
export function katexPlugin(md: MarkdownIt) {
  // Inline: $...$
  md.inline.ruler.after("escape", "math_inline", (state: StateInline, silent: boolean) => {
    if (state.src[state.pos] !== "$") return false;
    // 排除 $$
    if (state.src[state.pos + 1] === "$") return false;

    const start = state.pos + 1;
    let end = start;
    while (end < state.posMax && state.src[end] !== "$") {
      if (state.src[end] === "\\") end++; // 跳过转义
      end++;
    }
    if (end >= state.posMax) return false;

    if (!silent) {
      const token = state.push("math_inline", "math", 0);
      token.content = state.src.slice(start, end).trim();
      token.markup = "$";
    }

    state.pos = end + 1;
    return true;
  });

  // Block: $$...$$
  md.block.ruler.after("blockquote", "math_block", (state: StateBlock, startLine: number, endLine: number, silent: boolean) => {
    const startPos = state.bMarks[startLine] + state.tShift[startLine];
    if (state.src.slice(startPos, startPos + 2) !== "$$") return false;

    if (silent) return true;

    let nextLine = startLine;
    let found = false;

    while (++nextLine < endLine) {
      const pos = state.bMarks[nextLine] + state.tShift[nextLine];
      if (state.src.slice(pos, pos + 2) === "$$") {
        found = true;
        break;
      }
    }

    if (!found) return false;

    const token = state.push("math_block", "math", 0);
    token.block = true;
    token.content = state.src
      .split("\n")
      .slice(startLine + 1, nextLine)
      .join("\n")
      .trim();
    token.markup = "$$";
    token.map = [startLine, nextLine + 1];
    state.line = nextLine + 1;

    return true;
  });

  // 渲染规则
  md.renderer.rules.math_inline = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, { throwOnError: false });
    } catch {
      return `<code class="katex-error">${md.utils.escapeHtml(tokens[idx].content)}</code>`;
    }
  };

  md.renderer.rules.math_block = (tokens, idx) => {
    try {
      return `<div class="katex-block">${katex.renderToString(tokens[idx].content, {
        throwOnError: false,
        displayMode: true,
      })}</div>`;
    } catch {
      return `<pre class="katex-error">${md.utils.escapeHtml(tokens[idx].content)}</pre>`;
    }
  };
}

/**
 * 后处理器：处理可能遗漏的 KaTeX 渲染
 */
export function renderKatexBlocks(_container: HTMLElement) {
  // 当前 inline 和 block 公式都已在 markdown-it 插件中处理
  // 这里预留给后续扩展（如手动标记的 <math> 标签）
}
