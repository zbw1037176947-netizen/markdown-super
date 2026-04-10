/**
 * 字数统计 & 阅读时长（VS Code 状态栏）
 *
 * 中文按字计数，英文按词计数。
 * 阅读速度：中文 300 字/分钟，英文 200 词/分钟。
 */

import * as vscode from "vscode";

export class WordCountStatusBar implements vscode.Disposable {
  private _statusBarItem: vscode.StatusBarItem;
  private _disposables: vscode.Disposable[] = [];

  constructor() {
    this._statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this._statusBarItem.name = "Markdown Word Count";

    // 初始更新
    this._update();

    // 监听编辑器变化
    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this._update()),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (
          vscode.window.activeTextEditor &&
          e.document === vscode.window.activeTextEditor.document
        ) {
          this._update();
        }
      })
    );
  }

  private _update() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "markdown") {
      this._statusBarItem.hide();
      return;
    }

    const text = editor.document.getText();
    const stats = countWords(text);
    const readingTime = Math.max(1, Math.ceil(stats.chinese / 300 + stats.english / 200));

    this._statusBarItem.text = `$(book) ${stats.total.toLocaleString()} 字 · 约 ${readingTime} 分钟`;
    this._statusBarItem.tooltip = `中文: ${stats.chinese.toLocaleString()} 字\n英文: ${stats.english.toLocaleString()} 词\n预计阅读: ${readingTime} 分钟`;
    this._statusBarItem.show();
  }

  dispose() {
    this._statusBarItem.dispose();
    for (const d of this._disposables) d.dispose();
  }
}

interface WordStats {
  chinese: number;
  english: number;
  total: number;
}

function countWords(text: string): WordStats {
  // 去掉代码块、front matter、HTML 标签
  let cleaned = text
    .replace(/^---[\s\S]*?---/m, "") // front matter
    .replace(/```[\s\S]*?```/g, "") // 代码块
    .replace(/<[^>]+>/g, "") // HTML 标签
    .replace(/!\[.*?\]\(.*?\)/g, "") // 图片
    .replace(/\[([^\]]*)\]\(.*?\)/g, "$1"); // 链接（保留文本）

  // 中文字符计数
  const chineseMatches = cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g);
  const chinese = chineseMatches ? chineseMatches.length : 0;

  // 移除中文后计算英文词数
  const withoutChinese = cleaned.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, " ");
  const englishMatches = withoutChinese.match(/[a-zA-Z0-9]+/g);
  const english = englishMatches ? englishMatches.length : 0;

  return { chinese, english, total: chinese + english };
}
