import * as vscode from "vscode";
import * as path from "path";

const THEMES = ["github", "notion", "medium", "vue", "purple-night", "minimalist", "chinese-doc", "auto"] as const;
type PreviewTheme = (typeof THEMES)[number];
type PreviewMode = "side" | "inplace";

export class PreviewPanel {
  public static currentPanel: PreviewPanel | undefined;
  private static readonly viewType = "markdownSuper.preview";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _currentDocUri: string | undefined;
  private _currentDocDir: vscode.Uri | undefined;
  private _sourceDocUri: string | undefined; // 原地预览前的编辑器文档 URI
  private _mode: PreviewMode = "side";
  private _lastMessage: unknown = null;
  private _themeIndex: number = 0;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
    column: vscode.ViewColumn,
    mode: PreviewMode = "side"
  ) {
    if (PreviewPanel.currentPanel) {
      // 如果是 inplace 模式且预览已打开，toggle 关闭
      if (mode === "inplace" && PreviewPanel.currentPanel._mode === "inplace") {
        PreviewPanel.currentPanel._closeAndRestore();
        return;
      }
      PreviewPanel.currentPanel._panel.reveal(column);
      PreviewPanel.currentPanel._updateResourceRoots(document);
      PreviewPanel.currentPanel._update(document);
      return;
    }

    const docDir = vscode.Uri.file(path.dirname(document.uri.fsPath));
    const resourceRoots: vscode.Uri[] = [
      vscode.Uri.joinPath(context.extensionUri, "dist"),
      vscode.Uri.joinPath(context.extensionUri, "media"),
      docDir,
    ];

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (workspaceFolder) {
      resourceRoots.push(workspaceFolder.uri);
    }

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      "Markdown Super Preview",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: resourceRoots,
      }
    );

    PreviewPanel.currentPanel = new PreviewPanel(
      panel,
      context.extensionUri,
      document,
      mode
    );
  }

  /**
   * 关闭预览并回到编辑器（用于右键菜单 "Edit in Source"）
   * 通过 webview 消息获取当前行号，再跳转
   */
  public static closeAndEdit() {
    if (PreviewPanel.currentPanel) {
      // 请求 webview 发回带行号的 closePreview 消息
      PreviewPanel.currentPanel._panel.webview.postMessage({ type: "requestClose" });
    }
  }

  public static updateIfVisible(document: vscode.TextDocument) {
    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel._update(document);
    }
  }

  public static scrollToLine(line: number) {
    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel._panel.webview.postMessage({
        type: "scrollToLine",
        line,
      });
    }
  }

  public static toggleTheme() {
    if (PreviewPanel.currentPanel) {
      const p = PreviewPanel.currentPanel;
      p._themeIndex = (p._themeIndex + 1) % THEMES.length;
      const theme = THEMES[p._themeIndex];
      p._panel.webview.postMessage({
        type: "setTheme",
        theme,
      });
      vscode.window.showInformationMessage(`Markdown Super: Theme → ${theme}`);
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    document: vscode.TextDocument,
    mode: PreviewMode
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._currentDocDir = vscode.Uri.file(path.dirname(document.uri.fsPath));
    this._mode = mode;
    this._sourceDocUri = document.uri.toString();

    this._panel.webview.html = this._getHtml(this._panel.webview);
    this._update(document);

    vscode.commands.executeCommand("setContext", "markdownSuperPreviewActive", true);

    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  /**
   * 关闭预览，如果是 inplace 模式则恢复编辑器并跳到指定行
   */
  private _closeAndRestore(line?: number) {
    const sourceUri = this._sourceDocUri;
    const wasInplace = this._mode === "inplace";

    this._panel.dispose();

    if (sourceUri) {
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === sourceUri
      );
      if (doc) {
        vscode.window.showTextDocument(doc, wasInplace ? vscode.ViewColumn.Active : undefined).then((editor) => {
          if (line !== undefined && line >= 0) {
            const pos = new vscode.Position(line, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          }
        });
      }
    }
  }

  private _updateResourceRoots(document: vscode.TextDocument) {
    this._currentDocDir = vscode.Uri.file(path.dirname(document.uri.fsPath));
  }

  private _update(document: vscode.TextDocument) {
    this._currentDocUri = document.uri.toString();
    this._currentDocDir = vscode.Uri.file(path.dirname(document.uri.fsPath));
    this._panel.title = `Preview: ${this._getFileName(document.uri)}`;

    const config = vscode.workspace.getConfiguration("markdownSuper");

    const docDirUri = this._panel.webview.asWebviewUri(this._currentDocDir).toString();

    const msg = {
      type: "update",
      content: document.getText(),
      baseUri: docDirUri,
      config: {
        mermaidEnabled: config.get<boolean>("mermaid.enabled", true),
        katexEnabled: config.get<boolean>("katex.enabled", true),
        theme: THEMES[this._themeIndex],
        fontSize: config.get<number>("fontSize", 16),
        lineNumbers: config.get<boolean>("codeBlock.lineNumbers", false),
      },
    };
    this._lastMessage = msg;
    this._panel.webview.postMessage(msg);
  }

  private _handleMessage(message: { type: string; [key: string]: unknown }) {
    switch (message.type) {
      case "ready":
        if (this._lastMessage) {
          this._panel.webview.postMessage(this._lastMessage);
        }
        break;
      case "openLink":
        if (typeof message.href === "string") {
          vscode.env.openExternal(vscode.Uri.parse(message.href));
        }
        break;
      case "revealLine":
        if (typeof message.line === "number") {
          this._revealLineInEditor(message.line as number);
        }
        break;
      case "closePreview":
        this._closeAndRestore(typeof message.line === "number" ? (message.line as number) : undefined);
        break;
    }
  }

  private _revealLineInEditor(line: number) {
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === this._currentDocUri) {
        const pos = new vscode.Position(line, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(
          new vscode.Range(pos, pos),
          vscode.TextEditorRevealType.InCenter
        );
        break;
      }
    }
  }

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview.js")
    );
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview.css")
    );
    const nonce = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   style-src ${webview.cspSource} 'unsafe-inline';
                   script-src 'nonce-${nonce}';
                   font-src ${webview.cspSource};
                   img-src ${webview.cspSource} https: data:;">
    <title>Markdown Super Preview</title>
    <link rel="stylesheet" href="${cssUri}">
</head>
<body>
    <div id="loading">Loading preview...</div>
    <div id="preview" style="display:none;"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private _getFileName(uri: vscode.Uri): string {
    const parts = uri.path.split("/");
    return parts[parts.length - 1] || "Untitled";
  }

  private _dispose() {
    PreviewPanel.currentPanel = undefined;
    vscode.commands.executeCommand("setContext", "markdownSuperPreviewActive", false);
    this._panel.dispose();
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables = [];
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
