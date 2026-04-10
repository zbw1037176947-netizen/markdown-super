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
    const lines = text.split("\n");

    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // 跳过代码块内容
      if (line.trimStart().startsWith("```")) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;

      // 匹配 ATX 标题（# ~ ######）
      const match = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/);
      if (match) {
        headings.push({
          text: match[2].trim(),
          level: match[1].length,
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
