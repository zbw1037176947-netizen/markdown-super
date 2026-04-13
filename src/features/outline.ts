/**
 * Markdown 大纲侧边栏（TOC Tree View）
 *
 * 解析当前 Markdown 文件的标题，以树形结构显示在侧边栏。
 * 点击标题可跳转到编辑器和预览的对应位置。
 */

import * as vscode from "vscode";

interface HeadingItem {
  text: string;
  level: number;
  line: number;
  children: HeadingItem[];
}

export class MarkdownOutlineProvider implements vscode.TreeDataProvider<HeadingItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<HeadingItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  refresh() {
    // 防抖 200ms，避免打字时频繁刷新
    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._onDidChangeTreeData.fire(undefined);
    }, 200);
  }

  getTreeItem(element: HeadingItem): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.text,
      element.children.length > 0
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );

    // 显示层级图标
    const icons: Record<number, string> = {
      1: "$(symbol-class)",
      2: "$(symbol-method)",
      3: "$(symbol-field)",
      4: "$(symbol-variable)",
      5: "$(symbol-variable)",
      6: "$(symbol-variable)",
    };
    item.iconPath = new vscode.ThemeIcon(
      icons[element.level]?.replace("$(", "").replace(")", "") || "symbol-variable"
    );

    item.description = `H${element.level}`;

    // 点击时跳转
    item.command = {
      command: "markdownSuper.outlineReveal",
      title: "Go to heading",
      arguments: [element.line],
    };

    return item;
  }

  getChildren(element?: HeadingItem): HeadingItem[] {
    if (element) {
      return element.children;
    }

    // 根节点：解析当前文档
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "markdown") {
      return [];
    }

    return this._parseHeadings(editor.document);
  }

  private _parseHeadings(document: vscode.TextDocument): HeadingItem[] {
    const headings: HeadingItem[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // 支持 ``` 和 ~~~ 两种围栏，且要求闭合用同类型且长度不小于开始
    let fenceChar: "`" | "~" | null = null;
    let fenceLen = 0;
    let inFrontMatter = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Front matter（--- 包裹，仅文档开头）
      if (i === 0 && line.trim() === "---") {
        inFrontMatter = true;
        continue;
      }
      if (inFrontMatter) {
        if (line.trim() === "---") inFrontMatter = false;
        continue;
      }

      // 围栏代码块：检测开始/结束
      const fenceMatch = line.match(/^(\s*)(`{3,}|~{3,})/);
      if (fenceMatch) {
        const indent = fenceMatch[1].length;
        const marker = fenceMatch[2];
        const ch = marker[0] as "`" | "~";
        const len = marker.length;

        if (fenceChar === null) {
          // 开始围栏（CommonMark 允许最多 3 个空格缩进）
          if (indent <= 3) {
            fenceChar = ch;
            fenceLen = len;
          }
        } else if (ch === fenceChar && len >= fenceLen && indent <= 3) {
          // 结束围栏
          fenceChar = null;
          fenceLen = 0;
        }
        continue;
      }
      if (fenceChar !== null) continue;

      // 缩进代码块（4 个空格或 tab 开头，且前一行为空/也是缩进块）
      // 简化处理：只在非空白前缀时识别标题，避免误把缩进示例中的 # 当标题
      if (/^(\s{4,}|\t)/.test(line)) continue;

      // 匹配 ATX 标题（# ~ ######）
      const match = line.match(/^(\s{0,3})(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/);
      if (match) {
        headings.push({
          text: match[3].trim(),
          level: match[2].length,
          line: i,
          children: [],
        });
      }
    }

    // 构建层级树
    return this._buildTree(headings);
  }

  /**
   * 将扁平的标题列表构建为嵌套树
   */
  private _buildTree(headings: HeadingItem[]): HeadingItem[] {
    if (headings.length === 0) return [];

    const root: HeadingItem[] = [];
    const stack: HeadingItem[] = [];

    for (const heading of headings) {
      const node: HeadingItem = { ...heading, children: [] };

      // 弹出所有层级 >= 当前标题的栈元素
      while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    }

    return root;
  }
}
