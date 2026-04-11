/**
 * Markmap 思维导图渲染器（纯 CSS 方案，零依赖）
 *
 * 将 ```markmap 代码块（markdown 格式的标题/列表）渲染为
 * 可折叠的树形结构。无需 markmap-lib/markmap-view。
 */

export async function renderMarkmapBlocks(container: HTMLElement) {
  const blocks = container.querySelectorAll("pre.markmap-block");
  if (blocks.length === 0) return;

  for (const block of blocks) {
    const code = block.textContent?.trim();
    if (!code) continue;

    try {
      const tree = parseMarkmapMarkdown(code);
      const wrapper = document.createElement("div");
      wrapper.className = "markmap-rendered";
      const dataLine = block.getAttribute("data-line");
      if (dataLine) wrapper.setAttribute("data-line", dataLine);
      wrapper.appendChild(renderTree(tree));
      block.replaceWith(wrapper);
    } catch (err) {
      const errorEl = document.createElement("div");
      errorEl.className = "markmap-error";
      errorEl.textContent = `Markmap error: ${err instanceof Error ? err.message : String(err)}`;
      block.parentElement?.insertBefore(errorEl, block.nextSibling);
    }
  }
}

interface TreeNode {
  text: string;
  children: TreeNode[];
}

/**
 * 解析 markdown 标题/列表为树结构
 */
function parseMarkmapMarkdown(markdown: string): TreeNode {
  const lines = markdown.split("\n").filter((l) => l.trim());
  const root: TreeNode = { text: "Mindmap", children: [] };
  const stack: { node: TreeNode; level: number }[] = [{ node: root, level: 0 }];

  for (const line of lines) {
    let text: string;
    let level: number;

    // 匹配 # 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      level = headingMatch[1].length;
      text = headingMatch[2].trim();
      if (level === 1) {
        root.text = text;
        continue;
      }
    } else {
      // 匹配 - 或 * 列表项
      const listMatch = line.match(/^(\s*)[*-]\s+(.+)/);
      if (listMatch) {
        level = Math.floor(listMatch[1].length / 2) + 7; // 列表比标题层级更深
        text = listMatch[2].trim();
      } else {
        continue;
      }
    }

    const node: TreeNode = { text, children: [] };

    // 找到合适的父节点
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, level });
  }

  return root;
}

/**
 * 渲染树为 HTML
 */
function renderTree(node: TreeNode): HTMLElement {
  const el = document.createElement("div");
  el.className = "mm-tree";

  const nodeEl = document.createElement("div");
  nodeEl.className = "mm-node";
  nodeEl.textContent = node.text;

  if (node.children.length > 0) {
    nodeEl.classList.add("mm-expandable");
    nodeEl.addEventListener("click", (e) => {
      e.stopPropagation();
      el.classList.toggle("mm-collapsed");
    });
  }

  el.appendChild(nodeEl);

  if (node.children.length > 0) {
    const childrenEl = document.createElement("div");
    childrenEl.className = "mm-children";
    for (const child of node.children) {
      childrenEl.appendChild(renderTree(child));
    }
    el.appendChild(childrenEl);
  }

  return el;
}
