/**
 * Markdown 快捷格式化
 *
 * Ctrl+B → 加粗 **text**
 * Ctrl+I → 斜体 *text*
 * Ctrl+K → 插入链接 [text](url)
 * Ctrl+Shift+K → 插入图片 ![alt](url)
 * Ctrl+Shift+C → 行内代码 `code`
 */

import * as vscode from "vscode";

export function registerFormatting(context: vscode.ExtensionContext) {
  const commands: [string, (editor: vscode.TextEditor) => void][] = [
    ["markdownSuper.bold", wrapSelection("**", "**")],
    ["markdownSuper.italic", wrapSelection("*", "*")],
    ["markdownSuper.inlineCode", wrapSelection("`", "`")],
    ["markdownSuper.link", insertLink],
    ["markdownSuper.image", insertImage],
    ["markdownSuper.strikethrough", wrapSelection("~~", "~~")],
  ];

  for (const [id, handler] of commands) {
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(id, handler)
    );
  }
}

/**
 * 通用包裹选中文本函数
 * 如果已经被包裹则取消包裹（toggle）
 */
function wrapSelection(prefix: string, suffix: string) {
  return (editor: vscode.TextEditor) => {
    editor.edit((editBuilder) => {
      for (const selection of editor.selections) {
        const text = editor.document.getText(selection);

        // 检查是否已经被包裹 → 取消
        if (text.startsWith(prefix) && text.endsWith(suffix) && text.length >= prefix.length + suffix.length) {
          const unwrapped = text.slice(prefix.length, text.length - suffix.length);
          editBuilder.replace(selection, unwrapped);
        } else if (text.length > 0) {
          // 有选中文本 → 包裹
          editBuilder.replace(selection, `${prefix}${text}${suffix}`);
        } else {
          // 无选中文本 → 插入模板，光标放在中间
          editBuilder.replace(selection, `${prefix}${suffix}`);
        }
      }
    }).then(() => {
      // 无选中文本时，把光标移到 prefix 和 suffix 之间
      if (editor.selections.every((s) => s.isEmpty)) {
        const newSelections = editor.selections.map((s) => {
          const pos = s.active.translate(0, -suffix.length);
          return new vscode.Selection(pos, pos);
        });
        editor.selections = newSelections;
      }
    });
  };
}

function insertLink(editor: vscode.TextEditor) {
  const text = editor.document.getText(editor.selection);
  const snippet = text
    ? new vscode.SnippetString(`[${text}]($1)`)
    : new vscode.SnippetString("[$1]($2)");
  editor.insertSnippet(snippet);
}

function insertImage(editor: vscode.TextEditor) {
  const text = editor.document.getText(editor.selection);
  const snippet = text
    ? new vscode.SnippetString(`![${text}]($1)`)
    : new vscode.SnippetString("![$1]($2)");
  editor.insertSnippet(snippet);
}
