import * as vscode from "vscode";

type PreviewTheme = "auto" | "light";

export class PreviewPanel {
  public static currentPanel: PreviewPanel | undefined;
  private static readonly viewType = "markdownSuper.preview";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _currentDocUri: string | undefined;
  private _lastMessage: unknown = null;
  private _theme: PreviewTheme = "light";
  private _disposables: vscode.Disposable[] = [];

  /**
   * 创建或显示预览面板
   */
  public static createOrShow(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
    column: vscode.ViewColumn
  ) {
    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel._panel.reveal(column);
      PreviewPanel.currentPanel._update(document);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PreviewPanel.viewType,
      "Markdown Super Preview",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "dist"),
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      }
    );

    PreviewPanel.currentPanel = new PreviewPanel(panel, context.extensionUri, document);
  }

  /**
   * 如果预览面板可见，更新内容
   */
  public static updateIfVisible(document: vscode.TextDocument) {
    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel._update(document);
    }
  }

  /**
   * 编辑器光标移动时，通知 webview 滚动到对应行
   */
  public static scrollToLine(line: number) {
    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel._panel.webview.postMessage({
        type: "scrollToLine",
        line,
      });
    }
  }

  /**
   * 切换预览主题
   */
  public static toggleTheme() {
    if (PreviewPanel.currentPanel) {
      const p = PreviewPanel.currentPanel;
      p._theme = p._theme === "auto" ? "light" : "auto";
      p._panel.webview.postMessage({
        type: "setTheme",
        theme: p._theme,
      });
    }
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    document: vscode.TextDocument
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    this._panel.webview.html = this._getHtml(this._panel.webview);
    this._update(document);

    // 设置 context key，用于控制主题切换按钮显示
    vscode.commands.executeCommand("setContext", "markdownSuperPreviewActive", true);

    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  private _update(document: vscode.TextDocument) {
    this._currentDocUri = document.uri.toString();
    this._panel.title = `Preview: ${this._getFileName(document.uri)}`;

    const config = vscode.workspace.getConfiguration("markdownSuper");

    const msg = {
      type: "update",
      content: document.getText(),
      config: {
        mermaidEnabled: config.get<boolean>("mermaid.enabled", true),
        katexEnabled: config.get<boolean>("katex.enabled", true),
        theme: this._theme,
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
        // 预览点击 → 编辑器跳转到对应行
        if (typeof message.line === "number") {
          this._revealLineInEditor(message.line as number);
        }
        break;
    }
  }

  /**
   * 跳转编辑器到指定行
   */
  private _revealLineInEditor(line: number) {
    // 找到当前文档对应的编辑器
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
