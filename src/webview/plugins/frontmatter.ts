/**
 * markdown-it 插件：Front Matter 卡片渲染
 *
 * 将 YAML front matter（--- 包裹）渲染为信息卡片
 */

import type MarkdownIt from "markdown-it";

export function frontmatterPlugin(md: MarkdownIt) {
  // 在 block ruler 最前面插入 front matter 解析规则
  md.block.ruler.before("hr", "frontmatter", (state, startLine, endLine, silent) => {
    // 只在文档开头匹配
    if (startLine !== 0) return false;

    const startPos = state.bMarks[startLine] + state.tShift[startLine];
    if (state.src.slice(startPos, startPos + 3) !== "---") return false;

    if (silent) return true;

    // 找到结束的 ---
    let nextLine = startLine;
    let found = false;

    while (++nextLine < endLine) {
      const pos = state.bMarks[nextLine] + state.tShift[nextLine];
      const lineText = state.src.slice(pos, state.eMarks[nextLine]).trim();
      if (lineText === "---") {
        found = true;
        break;
      }
    }

    if (!found) return false;

    const content = state.src
      .split("\n")
      .slice(startLine + 1, nextLine)
      .join("\n")
      .trim();

    const token = state.push("frontmatter", "div", 0);
    token.content = content;
    token.map = [startLine, nextLine + 1];
    state.line = nextLine + 1;

    return true;
  });

  // 渲染规则：解析 YAML 并生成卡片 HTML
  md.renderer.rules.frontmatter = (tokens, idx) => {
    const content = tokens[idx].content;
    const fields = parseSimpleYaml(content);

    if (fields.length === 0) return "";

    const rows = fields
      .map(
        ({ key, value }) =>
          `<tr><td class="fm-key">${md.utils.escapeHtml(key)}</td><td class="fm-value">${md.utils.escapeHtml(value)}</td></tr>`
      )
      .join("");

    return `<div class="frontmatter-card" data-line="0">
  <div class="fm-header">Front Matter</div>
  <table class="fm-table">${rows}</table>
</div>`;
  };
}

/**
 * 简易 YAML 解析（只处理 key: value 格式，不处理嵌套）
 */
function parseSimpleYaml(yaml: string): { key: string; value: string }[] {
  const results: { key: string; value: string }[] = [];
  for (const line of yaml.split("\n")) {
    const match = line.match(/^(\w[\w\s]*?):\s*(.*)$/);
    if (match) {
      let value = match[2].trim();
      // 去掉引号
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // 数组简写 [a, b, c]
      if (value.startsWith("[") && value.endsWith("]")) {
        value = value.slice(1, -1).trim();
      }
      results.push({ key: match[1].trim(), value });
    }
  }
  return results;
}
