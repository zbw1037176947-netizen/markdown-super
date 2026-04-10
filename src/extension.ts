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
}

export function deactivate() {}
