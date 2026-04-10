#!/bin/bash
# 一键打包发版脚本
# 用法: ./publish.sh [patch|minor|major]
# 默认 patch（0.1.0 → 0.1.1）

set -e

BUMP=${1:-patch}

# 升版本号
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
if ('$BUMP' === 'major') pkg.version = \`\${major+1}.0.0\`;
else if ('$BUMP' === 'minor') pkg.version = \`\${major}.\${minor+1}.0\`;
else pkg.version = \`\${major}.\${minor}.\${patch+1}\`;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('Version: ' + pkg.version);
"

VERSION=$(node -p "require('./package.json').version")

# 构建 + 打包
npm run build:prod
npx @vscode/vsce package

echo ""
echo "✅ 打包完成: markdown-super-${VERSION}.vsix"
echo ""
echo "👉 下一步: 去 https://marketplace.visualstudio.com/manage 上传这个文件"
