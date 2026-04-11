import * as vscode from "vscode";
import { PreviewPanel } from "./panels/PreviewPanel";
import { registerImagePaste } from "./features/image-paste";
import { registerFormatting } from "./features/formatting";
import { MarkdownOutlineProvider } from "./features/outline";
import { WordCountStatusBar } from "./features/word-count";

export function activate(context: vscode.ExtensionContext) {
  // 注册图片粘贴 & 拖拽
  registerImagePaste(context);

  // 注册快捷格式化
  registerFormatting(context);

  // 注册 TOC 大纲侧边栏
  const outlineProvider = new MarkdownOutlineProvider();
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("markdownSuperOutline", outlineProvider),
    vscode.window.onDidChangeActiveTextEditor(() => outlineProvider.refresh()),
    vscode.workspace.onDidChangeTextDocument(() => outlineProvider.refresh()),
    vscode.commands.registerCommand("markdownSuper.outlineReveal", (line: number) => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const pos = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
      PreviewPanel.scrollToLine(line);
    })
  );

  // 注册字数统计状态栏
  const wordCount = new WordCountStatusBar();
  context.subscriptions.push(wordCount);
  // 命令：打开预览（根据设置决定 side 或 inplace）
  context.subscriptions.push(
    vscode.commands.registerCommand("markdownSuper.openPreviewToSide", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "markdown") return;

      const config = vscode.workspace.getConfiguration("markdownSuper");
      const mode = config.get<string>("previewMode", "side");

      if (mode === "inplace") {
        PreviewPanel.createOrShow(context, editor.document, vscode.ViewColumn.Active, "inplace");
      } else {
        PreviewPanel.createOrShow(context, editor.document, vscode.ViewColumn.Beside, "side");
      }
    })
  );

  // 命令：关闭预览回到编辑器（右键菜单 "Edit in Source"）
  context.subscriptions.push(
    vscode.commands.registerCommand("markdownSuper.editInSource", () => {
      PreviewPanel.closeAndEdit();
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
