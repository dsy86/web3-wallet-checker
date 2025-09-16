# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个使用 React 构建的 Solana 钱包余额检查器应用。该应用允许用户输入助记词列表，并查询对应钱包的 SOL 余额。

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
- **区块链**: Solana Web3.js
- **加密库**: bip39, ed25519-hd-key, tweetnacl

### 关键组件结构
- `App.js` - 主应用组件，包含 MnemonicChecker
- `MnemonicChecker.js` - 核心功能组件，处理助记词验证和余额查询

### Webpack 配置覆盖
项目使用 `config-overrides.js` 来配置浏览器端的 Node.js polyfills：
- stream, crypto, buffer, assert, http/https, os, url 等模块的浏览器兼容性

### 钱包派生逻辑
- 使用 BIP39 标准验证和转换助记词
- 使用 Solana 标准派生路径 `m/44'/501'/0'/0'`
- 通过 ed25519-hd-key 进行密钥派生

### Solana 连接
- 连接到 QuickNode 提供的 Solana 主网 RPC 端点
- 使用 "confirmed" 承诺级别查询余额

## 重要注意事项

### 安全考虑
- 该应用处理用户的助记词，属于敏感信息
- 仅用于余额查询，不执行任何交易操作
- 助记词在本地处理，不发送到外部服务

### 开发模式
- 使用 `react-app-rewired` 而非标准的 `react-scripts`
- Tailwind CSS 配置为 purge 模式以优化构建大小

### 依赖说明
- 包含多个加密和区块链相关的 polyfills 以支持浏览器环境
- 使用特定版本的 Solana Web3.js (1.95.4) 确保兼容性