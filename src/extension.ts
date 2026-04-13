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

      const cursorLine = editor.selection.active.line;

      // 先设置挂起的滚动位置，createOrShow 后 webview 渲染完会自动执行
      PreviewPanel.requestScrollAfterRender(cursorLine);

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

  // 监听编辑器滚动/光标变化 → 同步预览
  // 使用单一锚点行逻辑 + 节流，避免两个事件竞争
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  const requestSync = (editor: vscode.TextEditor) => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      if (editor.document.languageId !== "markdown") return;

      // 策略：优先用光标行（如果光标在可见区域内）；否则用可见区域的顶部第 1/3 位置
      const cursorLine = editor.selection.active.line;
      const ranges = editor.visibleRanges;
      if (ranges.length === 0) return;

      const topLine = ranges[0].start.line;
      const botLine = ranges[0].end.line;

      // 光标可见 → 用光标；否则用视口上 1/3 的行
      let syncLine: number;
      if (cursorLine >= topLine && cursorLine <= botLine) {
        syncLine = cursorLine;
      } else {
        syncLine = topLine + Math.floor((botLine - topLine) / 3);
      }

      PreviewPanel.scrollToLine(syncLine);
    }, 30);
  };

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      if (e.textEditor.document.languageId === "markdown") {
        requestSync(e.textEditor);
      }
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.textEditor.document.languageId === "markdown") {
        requestSync(e.textEditor);
      }
    })
  );
}

export function deactivate() {}
