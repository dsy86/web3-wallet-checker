# Solana 钱包余额检查器

一个基于 React 的 Web 应用，用于批量检查 Solana 钱包的 SOL 余额。通过输入助记词列表，快速查看对应钱包地址的余额信息。

## 🎯 功能特性

- **批量余额查询**: 支持同时检查多个钱包的 SOL 余额
- **助记词验证**: 使用 BIP39 标准验证助记词的有效性
- **实时显示**: 查询过程中实时显示结果，提供即时反馈
- **余额排序**: 自动按余额从高到低排序显示结果
- **一键复制**: 点击即可复制助记词或钱包地址
- **响应式设计**: 使用 Tailwind CSS 构建的现代化界面

## 🔧 技术栈

- **前端**: React 18 + Tailwind CSS
- **区块链**: Solana Web3.js
- **加密**: BIP39 + ed25519-hd-key
- **构建工具**: Create React App + react-app-rewired

## 🚀 快速开始

### 环境要求

- Node.js 14+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 环境配置

1. 复制环境变量示例文件：
```bash
cp .env.example .env.local
```

2. 编辑 `.env.local` 文件，配置 Solana RPC 端点（可选）：
```bash
REACT_APP_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

**注意**: 默认使用免费的公共 RPC 端点。如需更好的性能，可以注册 [QuickNode](https://www.quicknode.com/) 或 [Alchemy](https://www.alchemy.com/) 等服务获取私有端点。

### 运行开发服务器

```bash
npm start
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

### 构建生产版本

```bash
npm run build
```

## 🚀 一键部署到 Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/3qIqwI?referralCode=fNWlAp)

### 手动部署步骤

1. **登录 Railway**: 访问 [railway.app](https://railway.app) 并登录
2. **连接 GitHub**: 授权 Railway 访问你的 GitHub 仓库
3. **导入项目**:
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 选择此仓库
4. **自动部署**: Railway 会自动检测配置并开始部署
5. **访问应用**: 部署完成后，Railway 会提供一个公共 URL

### 本地测试生产构建

```bash
npm run build
npm run start:production
```

## 📋 使用说明

1. **输入助记词**: 在文本框中输入助记词，每行一个
2. **开始查询**: 点击"Check Balances"按钮开始批量查询
3. **查看结果**: 结果会实时显示在表格中，包含：
   - 助记词（可点击复制）
   - 钱包地址（可点击复制）
   - SOL 余额
4. **排序显示**: 结果按余额从高到低自动排序

## 🔐 安全说明

- **本地处理**: 所有助记词处理均在浏览器本地完成
- **无数据存储**: 应用不存储任何助记词或私钥信息
- **仅查询余额**: 应用只读取余额信息，不执行任何交易操作
- **连接安全**: 通过 HTTPS 连接到可信的 Solana RPC 节点

## 🛠 技术实现

### 钱包派生

使用标准的 Solana 钱包派生路径：
```
m/44'/501'/0'/0'
```

### 助记词验证

使用 BIP39 标准验证助记词：
```javascript
bip39.validateMnemonic(mnemonic)
```

### 余额查询

连接到 Solana 主网查询实时余额：
```javascript
connection.getBalance(publicKey)
```

### 部署配置

项目包含完整的 Railway 部署配置：
- `railway.toml` - Railway 平台配置
- `nixpacks.toml` - Nixpacks 构建配置
- `serve.json` - 静态文件服务配置
- `package.json` 中的 `start:production` 脚本

## 📁 项目结构

```
src/
├── App.js              # 主应用组件
├── MnemonicChecker.js  # 核心功能组件
├── App.css             # 应用样式
└── index.js            # 应用入口
```

## 🧪 运行测试

```bash
npm test
```

## ⚠️ 免责声明

- 此工具仅用于查询钱包余额，请谨慎处理助记词信息
- 请确保在安全的环境中使用，避免助记词泄露
- 开发者不对任何资产损失承担责任

## 📄 许可证

本项目基于 MIT 许可证开源。