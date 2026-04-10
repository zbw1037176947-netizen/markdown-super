import * as vscode from "vscode";
import { PreviewPanel } from "./panels/PreviewPanel";

export function activate(context: vscode.ExtensionContext) {
  // 命令：在当前列打开预览
  context.subscriptions.push(
    vscode.commands.registerCommand("markdownSuper.openPreview", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === "markdown") {
        PreviewPanel.createOrShow(context, editor.document, vscode.ViewColumn.Active);
      }
    })
  );

  // 命令：在侧边列打开预览
  context.subscriptions.push(
    vscode.commands.registerCommand("markdownSuper.openPreviewToSide", () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === "markdown") {
        PreviewPanel.createOrShow(context, editor.document, vscode.ViewColumn.Beside);
      }
    })
  );

  // 命令：切换预览主题
  context.subscriptions.push(
    vscode.commands.registerCommand("markdownSuper.toggleTheme", () => {
      PreviewPanel.toggleTheme();
    })
  );

  // 监听编辑器切换，自动同步预览内容
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && editor.document.languageId === "markdown") {
        PreviewPanel.updateIfVisible(editor.document);
      }
    })
  );

  // 监听文档内容变化，实时更新预览
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === "markdown") {
        PreviewPanel.updateIfVisible(e.document);
      }
    })
  );

  // 监听编辑器可见范围变化（滚动时触发），同步预览滚动
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      if (e.textEditor.document.languageId === "markdown") {
        // 取可见区域的中间行作为同步目标
        const ranges = e.visibleRanges;
        if (ranges.length > 0) {
          const midLine = Math.floor(
            (ranges[0].start.line + ranges[0].end.line) / 2
          );
          PreviewPanel.scrollToLine(midLine);
        }
      }
    })
  );

  // 监听光标位置变化（点击、键盘移动），同步预览滚动
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.textEditor.document.languageId === "markdown") {
        const line = e.selections[0].active.line;
        PreviewPanel.scrollToLine(line);
      }
    })
  );
}

export function deactivate() {}
