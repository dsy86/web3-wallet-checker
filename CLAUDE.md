# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个使用 React 构建的 Web3 钱包净值检查器应用。该应用允许用户输入助记词列表，并查询对应钱包地址在 Solana、EVM、TRON、BTC 和 HyperCore 上的 net worth。

## 常用命令

### 开发
- `npm start` - 启动开发服务器，在 http://localhost:3000 运行应用
- `npm test` - 运行测试套件（交互式监视模式）
- `npm run build` - 构建生产版本应用到 build 文件夹

### 代码检查
- 项目使用默认的 Create React App ESLint 配置

## 技术架构

### 核心技术栈
- **前端框架**: React 18.3.1
- **构建工具**: Create React App + react-app-rewired (用于 webpack 配置覆盖)
- **样式**: Tailwind CSS
- **区块链/API**: Solana Web3.js, ethers, bitcoinjs-lib, Hyperliquid info API, DeBank, Moralis, TronScan
- **加密库**: bip39, ed25519-hd-key, tweetnacl, ecpair, @bitcoinerlab/secp256k1

### 关键组件结构
- `App.js` - 主应用组件，包含 MnemonicChecker
- `MnemonicChecker.js` - 核心功能组件，处理助记词验证、网络选择、队列调度和净值查询
- `src/utils/api.js` - 各网络 API 查询逻辑，包括 HyperCore net worth 查询
- `src/utils/crypto.js` - 助记词地址派生逻辑

### Webpack 配置覆盖
项目使用 `config-overrides.js` 来配置浏览器端的 Node.js polyfills：
- stream, crypto, buffer, assert, http/https, os, url 等模块的浏览器兼容性

### 钱包派生逻辑
- 使用 BIP39 标准验证和转换助记词
- 使用 Solana 标准派生路径 `m/44'/501'/0'/0'`
- EVM 和 HyperCore 使用 EVM 兼容地址，派生路径 `m/44'/60'/0'/0/{index}`
- TRON 使用 `m/44'/195'/0'/0/{index}`
- BTC 支持 native、nested SegWit 和 legacy 三类地址
- 对 EVM、TRON、BTC、HyperCore 使用 path index `0` 起查；如果当前或相邻前序地址有 net worth，会继续探测更深层 path

### 网络查询
- EVM 使用 DeBank total balance API，需要 `REACT_APP_DEBANK_ACCESS_KEY`
- Solana 使用 Moralis Solana account/token API，需要 `REACT_APP_MORALIS_API_KEY`
- TRON 使用 TronScan account API，并结合 TRX 价格计算 USD 净值
- BTC 使用公共地址 API 查询余额，并结合 BTC 价格计算 USD 净值
- HyperCore 使用 Hyperliquid public `info` API，不需要额外 API Key；只关心 `summary.accountValueUsd` 作为 net worth

## 重要注意事项

### 安全考虑
- 该应用处理用户的助记词，属于敏感信息
- 仅用于净值查询，不执行任何交易操作
- 助记词在本地处理，不发送到外部服务

### 开发模式
- 使用 `react-app-rewired` 而非标准的 `react-scripts`
- Tailwind CSS 配置为 purge 模式以优化构建大小
- Cloudflare Pages 构建环境会设置 `CI=true`，Create React App 会把 ESLint warning 当作错误；本地验证部署问题时建议运行 `env CI=true npm run build`

### 依赖说明
- 包含多个加密和区块链相关的 polyfills 以支持浏览器环境
- 使用特定版本的 Solana Web3.js (1.95.4) 确保兼容性
