/**
 * PlantUML 渲染器
 *
 * 使用官方 deflate + Base64 变种编码（参考 https://plantuml.com/text-encoding），
 * 相比 hex 编码大幅减小 URL 长度，支持大型图表。
 *
 * 服务器地址可通过 markdownSuper.plantuml.server 配置，默认公共实例。
 */

import * as pako from "pako";

const DEFAULT_SERVER = "https://www.plantuml.com/plantuml";

export async function renderPlantUmlBlocks(container: HTMLElement, serverUrl?: string) {
  const blocks = container.querySelectorAll("pre.plantuml-block");
  if (blocks.length === 0) return;

  const server = (serverUrl || DEFAULT_SERVER).replace(/\/+$/, "");

  for (const block of blocks) {
    const code = block.textContent?.trim();
    if (!code) continue;

    try {
      const encoded = encodePlantUml(code);
      const url = `${server}/svg/${encoded}`;

      const wrapper = document.createElement("div");
      wrapper.className = "plantuml-rendered";
      const dataLine = block.getAttribute("data-line");
      if (dataLine) wrapper.setAttribute("data-line", dataLine);

      const img = document.createElement("img");
      img.src = url;
      img.alt = "PlantUML diagram";
      img.style.maxWidth = "100%";
      img.onerror = () => {
        wrapper.innerHTML = `<div class="plantuml-error">PlantUML rendering failed. Check your diagram syntax or server URL (<code>${escapeHtml(server)}</code>).</div>`;
      };

      wrapper.appendChild(img);
      block.replaceWith(wrapper);
    } catch (err) {
      const errorEl = document.createElement("div");
      errorEl.className = "plantuml-error";
      errorEl.textContent = `PlantUML error: ${err instanceof Error ? err.message : String(err)}`;
      block.parentElement?.insertBefore(errorEl, block.nextSibling);
    }
  }
}

/**
 * PlantUML 文本编码：UTF-8 → deflate（raw, 无 zlib header）→ Base64 变种
 * 参考：https://plantuml.com/text-encoding
 */
function encodePlantUml(text: string): string {
  const utf8 = new TextEncoder().encode(text);
  const compressed = pako.deflateRaw(utf8, { level: 9 });
  return encode64(compressed);
}

/**
 * PlantUML 专用的 Base64 变种（非标准字符映射表）
 */
const PLANTUML_B64 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function encode64(data: Uint8Array): string {
  let result = "";
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i];
    const b2 = i + 1 < data.length ? data[i + 1] : 0;
    const b3 = i + 2 < data.length ? data[i + 2] : 0;

    result += PLANTUML_B64[(b1 >> 2) & 0x3f];
    result += PLANTUML_B64[((b1 << 4) | (b2 >> 4)) & 0x3f];
    result += PLANTUML_B64[((b2 << 2) | (b3 >> 6)) & 0x3f];
    result += PLANTUML_B64[b3 & 0x3f];
  }
  return result;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
