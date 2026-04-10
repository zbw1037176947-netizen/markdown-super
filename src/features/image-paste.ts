/**
 * 图片粘贴 & 拖拽功能
 *
 * - Ctrl+V 粘贴剪贴板图片 → 保存到 ./assets/ → 插入 ![](./assets/xxx.png)
 * - 拖拽图片文件到编辑器 → 同上
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

/**
 * 注册图片粘贴处理器（VS Code 1.82+ DocumentPasteEditProvider）
 */
export function registerImagePaste(context: vscode.ExtensionContext) {
  // 粘贴处理器
  const pasteProvider: vscode.DocumentPasteEditProvider = {
    async provideDocumentPasteEdits(
      document: vscode.TextDocument,
      _ranges: readonly vscode.Range[],
      dataTransfer: vscode.DataTransfer,
      _token: vscode.CancellationToken
    ): Promise<vscode.DocumentPasteEdit[] | undefined> {
      // 检查剪贴板中是否有图片
      const imageItem = getImageFromDataTransfer(dataTransfer);
      if (!imageItem) return undefined;

      const imageData = await imageItem.asFile()?.data();
      if (!imageData) return undefined;

      const ext = getExtension(imageItem.mimeType);
      const saved = await saveImageToAssets(document, imageData, ext);
      if (!saved) return undefined;

      const snippet = new vscode.SnippetString(`![${saved.alt}](${saved.relativePath})`);
      const edit = new vscode.DocumentPasteEdit(snippet, "Paste as Markdown image");
      edit.yieldTo = []; // 优先级最高
      return [edit];
    },
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentPasteEditProvider(
      { language: "markdown" },
      pasteProvider,
      {
        pasteMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"],
      }
    )
  );

  // 拖拽处理器
  const dropProvider: vscode.DocumentDropEditProvider = {
    async provideDocumentDropEdits(
      document: vscode.TextDocument,
      _position: vscode.Position,
      dataTransfer: vscode.DataTransfer,
      _token: vscode.CancellationToken
    ): Promise<vscode.DocumentDropEdit | undefined> {
      const imageItem = getImageFromDataTransfer(dataTransfer);
      if (!imageItem) return undefined;

      const file = imageItem.asFile();
      if (!file) return undefined;

      const imageData = await file.data();
      if (!imageData) return undefined;

      const ext = getExtension(imageItem.mimeType) || path.extname(file.name || "").slice(1) || "png";
      const saved = await saveImageToAssets(document, imageData, ext);
      if (!saved) return undefined;

      const snippet = new vscode.SnippetString(`![${saved.alt}](${saved.relativePath})`);
      const edit = new vscode.DocumentDropEdit(snippet);
      edit.label = "Drop as Markdown image";
      return edit;
    },
  };

  context.subscriptions.push(
    vscode.languages.registerDocumentDropEditProvider(
      { language: "markdown" },
      dropProvider,
      {
        dropMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "files"],
      }
    )
  );
}

/**
 * 从 DataTransfer 中获取图片项
 */
function getImageFromDataTransfer(
  dataTransfer: vscode.DataTransfer
): vscode.DataTransferItem | undefined {
  for (const mimeType of ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"]) {
    const item = dataTransfer.get(mimeType);
    if (item) return item;
  }
  // 检查 files 类型中是否有图片
  const files = dataTransfer.get("text/uri-list");
  return undefined;
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
  };
  return map[mimeType] || "png";
}

/**
 * 保存图片到 assets 目录
 */
async function saveImageToAssets(
  document: vscode.TextDocument,
  data: Uint8Array,
  ext: string
): Promise<{ relativePath: string; alt: string } | undefined> {
  const docDir = path.dirname(document.uri.fsPath);
  const assetsDir = path.join(docDir, "assets");

  // 确保 assets 目录存在
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // 生成文件名：YYYYMMDD-HHmmss-随机4位.ext
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
    return {
      relativePath: `./assets/${fileName}`,
      alt: "image",
    };
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to save image: ${err}`);
    return undefined;
  }
}
