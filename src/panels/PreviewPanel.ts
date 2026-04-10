import * as vscode from "vscode";

export class PreviewPanel {
  public static currentPanel: PreviewPanel | undefined;
  private static readonly viewType = "markdownSuper.preview";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _currentDocUri: string | undefined;
  private _disposables: vscode.Disposable[] = [];

  /**
   * 创建或显示预览面板
   */
  public static createOrShow(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
    column: vscode.ViewColumn
  ) {
    // 如果面板已存在，直接显示并更新内容
    if (PreviewPanel.currentPanel) {
      PreviewPanel.currentPanel._panel.reveal(column);
      PreviewPanel.currentPanel._update(document);
      return;
    }

    // 创建新面板
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

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    document: vscode.TextDocument
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // 设置 HTML
    this._panel.webview.html = this._getHtml(this._panel.webview);

    // 发送初始内容
    this._update(document);

    // 监听面板关闭
    this._panel.onDidDispose(() => this._dispose(), null, this._disposables);

    // 监听 webview 消息
    this._panel.webview.onDidReceiveMessage(
      (message) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  /**
   * 更新预览内容（发送 markdown 原文到 webview，由 webview 端渲染）
   */
  private _update(document: vscode.TextDocument) {
    this._currentDocUri = document.uri.toString();
    this._panel.title = `Preview: ${this._getFileName(document.uri)}`;

    // 读取用户配置
    const config = vscode.workspace.getConfiguration("markdownSuper");

    this._panel.webview.postMessage({
      type: "update",
      content: document.getText(),
      config: {
        mermaidEnabled: config.get<boolean>("mermaid.enabled", true),
        katexEnabled: config.get<boolean>("katex.enabled", true),
        theme: config.get<string>("theme", "auto"),
        fontSize: config.get<number>("fontSize", 16),
      },
    });
  }

  /**
   * 处理 webview 发来的消息
   */
  private _handleMessage(message: { type: string; [key: string]: unknown }) {
    switch (message.type) {
      case "ready":
        // Webview 加载完成，发送当前文档内容
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === "markdown") {
          this._update(editor.document);
        }
        break;
      case "openLink":
        // 打开外部链接
        if (typeof message.href === "string") {
          vscode.env.openExternal(vscode.Uri.parse(message.href));
        }
        break;
    }
  }

  /**
   * 生成 webview HTML
   */
  private _getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "dist", "webview.js")
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
    <style>
        body {
            margin: 0;
            padding: 16px 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: var(--vscode-editor-foreground);
            background: var(--vscode-editor-background);
        }
        #preview {
            max-width: 900px;
            margin: 0 auto;
        }
        #loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
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
