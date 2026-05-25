# Web3 钱包净值检查器

这个是 [English Version](./README.md) 的中文说明。

一个基于 React 的 Web 应用，用于通过助记词批量检查多个网络上的钱包净值。当前支持 Solana、EVM、TRON、BTC 和 HyperCore portfolio 查询。

## 🎯 功能特性

- **批量净值查询**: 支持同时检查多个钱包和多个网络的净值
- **网络选择**: 可通过复选框选择要查询的网络：EVM、Solana、TRON、BTC 和 HyperCore
- **助记词验证**: 使用 BIP39 标准验证助记词的有效性
- **深度地址探测**: 对 EVM 类地址从 path index `0` 开始查询，如果有 net worth 会继续查询更深层地址
- **HyperCore Portfolio 查询**: 使用 Hyperliquid public info API，并取 `summary.accountValueUsd` 作为 HyperCore net worth
- **实时显示**: 查询过程中实时显示结果，提供即时反馈
- **净值排序**: 自动按净值从高到低排序显示结果
- **一键复制**: 点击即可复制助记词或钱包地址
- **响应式设计**: 使用 Tailwind CSS 构建的现代化界面

## 🔧 技术栈

- **前端**: React 18 + Tailwind CSS
- **区块链**: Solana Web3.js, ethers, bitcoinjs-lib, Hyperliquid info API
- **加密**: BIP39 + ed25519-hd-key + EVM/BTC HD 派生
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

2. 编辑 `.env.local` 文件，配置 API Key 和 Solana RPC 端点：
```bash
REACT_APP_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
REACT_APP_DEBANK_ACCESS_KEY=your_debank_api_key
REACT_APP_MORALIS_API_KEY=your_moralis_api_key
```

**注意**: HyperCore 使用 Hyperliquid public info API，不需要额外 API Key。EVM 净值查询需要 DeBank，Solana 净值查询需要 Moralis。

### 运行开发服务器

```bash
npm start
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## ☁️ 部署到 Cloudflare Pages

本项目推荐部署到 Cloudflare Pages，支持自动化构建和全球 CDN 加速。

### 1. 准备工作

- 注册/登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
- 将本项目 Fork 或 Push 到你的 GitHub 仓库

### 2. 创建项目

1. 进入 Cloudflare Pages 面板
2. 点击 "Connect to Git"
3. 选择你的仓库

### 3. 构建配置

Cloudflare 会自动检测 React 项目，请确认以下配置：

- **Framework Preset**: Create React App
- **Build command**: `npm run build`
- **Build output directory**: `build`

### 4. 环境变量

在构建设置中添加以下环境变量（Security > Environment variables）：

- `REACT_APP_DEBANK_ACCESS_KEY`: 您的 DeBank Open API Key
- `REACT_APP_MORALIS_API_KEY`: 您的 Moralis API Key
- `REACT_APP_SOLANA_RPC_URL`: 可选的 Solana RPC URL
- `NODE_VERSION`: `20` (推荐，匹配当前 Cloudflare Pages 构建镜像)

> **注意**: 如果使用 `wrangler` 命令行工具直接上传部署，需要将这些变量写入本地 `.env` 文件，因为后台变量仅在云端构建时生效。

### 本地预览构建

```bash
npm run build
npx serve -s build
```

## 📋 使用说明

1. **输入助记词**: 在文本框中输入助记词，每行一个
2. **选择网络**: 勾选需要查询的网络：EVM、Solana、TRON、BTC 和/或 HyperCore
3. **开始查询**: 点击"Check Balances"按钮开始批量查询
4. **查看结果**: 结果会实时显示在表格中，包含：
   - 助记词（可点击复制）
   - 钱包地址（可点击复制）
   - 网络类型
   - Path index
   - USD 净值
5. **排序显示**: 结果按净值从高到低自动排序

## 🔐 安全说明

- **本地处理**: 所有助记词处理均在浏览器本地完成
- **无数据存储**: 应用不存储任何助记词或私钥信息
- **仅查询余额**: 应用只读取余额信息，不执行任何交易操作
- **连接安全**: 通过 HTTPS 连接到外部 portfolio 和链上数据 API

## 🛠 技术实现

### 钱包派生

Solana 使用标准钱包派生路径：
```
m/44'/501'/0'/0'
```

EVM 和 HyperCore 使用 EVM 兼容地址，派生路径为：
```
m/44'/60'/0'/0/{index}
```

TRON 和 BTC 使用各自的派生路径，具体实现见 `src/utils/crypto.js`。

### 助记词验证

使用 BIP39 标准验证助记词：
```javascript
bip39.validateMnemonic(mnemonic)
```

### 净值查询

- EVM: DeBank total balance API
- Solana: Moralis Solana account 和 token APIs
- TRON: TronScan account API 加 TRX 价格
- BTC: 公共 BTC address API 加 BTC 价格
- HyperCore: Hyperliquid `info` API，使用 `summary.accountValueUsd`

## 📁 项目结构

```
src/
├── App.js              # 主应用组件
├── MnemonicChecker.js  # 核心功能组件
├── utils/
│   ├── api.js          # 网络/API 查询工具
│   └── crypto.js       # 助记词地址派生工具
├── App.css             # 应用样式
└── index.js            # 应用入口
```

## ⚠️ 免责声明

- 此工具仅用于查询钱包余额，请谨慎处理助记词信息
- 请确保在安全的环境中使用，避免助记词泄露
- 开发者不对任何资产损失承担责任

## 📄 许可证

本项目基于 MIT 许可证开源。
