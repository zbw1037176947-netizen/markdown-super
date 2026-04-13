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

      // 用"视口顶部行"作为初始定位锚点（不是光标行），保持与滚动同步一致
      const topLine = editor.visibleRanges[0]?.start.line ?? editor.selection.active.line;

      if (mode === "inplace") {
        PreviewPanel.createOrShow(context, editor.document, vscode.ViewColumn.Active, "inplace", topLine);
      } else {
        PreviewPanel.createOrShow(context, editor.document, vscode.ViewColumn.Beside, "side", topLine);
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

  // 监听编辑器滚动 → 同步预览
  // 锚点统一用"视口顶部行"，保证与预览侧的追踪逻辑对称
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  const syncPreview = (editor: vscode.TextEditor) => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      // 校验编辑器仍是当前活跃的 markdown 编辑器，防止切换文档后旧事件误同步
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor !== editor) return;
      if (editor.document.languageId !== "markdown") return;
      const ranges = editor.visibleRanges;
      if (ranges.length === 0) return;
      const topLine = ranges[0].start.line;
      PreviewPanel.scrollToLine(topLine);
    }, 30);
  };

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
      if (e.textEditor.document.languageId === "markdown") {
        syncPreview(e.textEditor);
      }
    })
  );
}

export function deactivate() {}
