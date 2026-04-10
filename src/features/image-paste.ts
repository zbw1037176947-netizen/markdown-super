/**
 * 图片粘贴 & 拖拽功能
 *
 * 使用 VS Code 稳定的 clipboard API + command 方式：
 * - 注册 markdownSuper.pasteImage 命令
 * - 监听编辑器 paste 事件（通过 editor.action.clipboardPasteAction 覆盖）
 *
 * 拖拽使用 DocumentDropEditProvider（稳定 API）
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export function registerImagePaste(context: vscode.ExtensionContext) {
  // 注册手动粘贴图片命令（作为备选入口）
  context.subscriptions.push(
    vscode.commands.registerCommand("markdownSuper.pasteImage", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "markdown") return;

      // 读取剪贴板（VS Code 只能读文本，图片需要用 clipboard-files 方式）
      // 这里提供一个显式的粘贴图片流程
      const clipboardText = await vscode.env.clipboard.readText();

      // 如果剪贴板是图片 URL 或 data URI
      if (clipboardText && (clipboardText.startsWith("data:image/") || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(clipboardText))) {
        const snippet = new vscode.SnippetString(`![\${1:image}](${clipboardText})`);
        editor.insertSnippet(snippet);
        return;
      }

      vscode.window.showInformationMessage(
        "No image found in clipboard. Use Ctrl+V for text, or screenshot tools that copy to clipboard."
      );
    })
  );

  // 拖拽处理器（稳定 API）
  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(
      { language: "markdown" },
      {
        async provideDocumentDropEdits(
          document: vscode.TextDocument,
          _position: vscode.Position,
          dataTransfer: vscode.DataTransfer,
          _token: vscode.CancellationToken
        ): Promise<vscode.DocumentDropEdit | undefined> {
          // 检查拖拽的文件
          for (const mimeType of ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"]) {
            const item = dataTransfer.get(mimeType);
            if (!item) continue;

            const file = item.asFile();
            if (!file) continue;

            const data = await file.data();
            if (!data) continue;

            const ext = mimeType.split("/")[1] || "png";
            const saved = await saveImageToAssets(document, data, ext);
            if (!saved) continue;

            const snippet = new vscode.SnippetString(`![image](${saved.relativePath})`);
            return new vscode.DocumentDropEdit(snippet);
          }

          return undefined;
        },
      },
      { dropMimeTypes: ["image/*"] }
    )
  );
}

/**
 * 保存图片到 assets 目录
 */
async function saveImageToAssets(
  document: vscode.TextDocument,
  data: Uint8Array,
  ext: string
): Promise<{ relativePath: string } | undefined> {
  const docDir = path.dirname(document.uri.fsPath);
  const config = vscode.workspace.getConfiguration("markdownSuper");
  const saveDir = config.get<string>("image.saveDir", "./assets");
  const assetsDir = path.resolve(docDir, saveDir);

  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    "-",
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  const random = Math.random().toString(36).substring(2, 6);
  const fileName = `${timestamp}-${random}.${ext}`;
  const filePath = path.join(assetsDir, fileName);

  try {
    fs.writeFileSync(filePath, Buffer.from(data));
    const relativePath = path.relative(docDir, filePath).replace(/\\/g, "/");
    return { relativePath: `./${relativePath}` };
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to save image: ${err}`);
    return undefined;
  }
}
