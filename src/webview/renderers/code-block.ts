/**
 * 代码块增强渲染器
 *
 * 在已渲染的 HTML 上做后处理：
 * 1. 添加语言标签（如 "python"、"javascript"）
 * 2. 添加复制按钮 + "Copied!" 反馈
 * 3. 可选行号显示
 */

export function enhanceCodeBlocks(container: HTMLElement, showLineNumbers: boolean) {
  const codeBlocks = container.querySelectorAll("pre.code-block");

  for (const pre of codeBlocks) {
    // 避免重复增强
    if (pre.querySelector(".code-block-header")) continue;

    const lang = pre.getAttribute("data-lang") || "";
    const code = pre.querySelector("code");
    if (!code) continue;

    // --- 头部：语言标签 + 复制按钮 ---
    const header = document.createElement("div");
    header.className = "code-block-header";

    if (lang) {
      const langLabel = document.createElement("span");
      langLabel.className = "code-lang-label";
      langLabel.textContent = lang;
      header.appendChild(langLabel);
    }

    const copyBtn = document.createElement("button");
    copyBtn.className = "code-copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      const text = code.textContent || "";
      navigator.clipboard.writeText(text).then(() => {
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          copyBtn.textContent = "Copy";
          copyBtn.classList.remove("copied");
        }, 2000);
      });
    });
    header.appendChild(copyBtn);

    pre.insertBefore(header, pre.firstChild);

    // --- 行号 ---
    if (showLineNumbers) {
      const lines = (code.textContent || "").split("\n");
      // 去掉最后一个空行（代码块末尾通常有换行）
      if (lines[lines.length - 1] === "") lines.pop();

      const lineNumbers = document.createElement("div");
      lineNumbers.className = "code-line-numbers";
      lineNumbers.innerHTML = lines.map((_, i) => `<span>${i + 1}</span>`).join("\n");

      pre.classList.add("with-line-numbers");
      pre.insertBefore(lineNumbers, code);
    }
  }
}
