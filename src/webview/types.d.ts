/**
 * VS Code Webview API 类型声明
 */
interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

/**
 * CSS 模块声明
 */
declare module "*.css" {
  const content: string;
  export default content;
}
