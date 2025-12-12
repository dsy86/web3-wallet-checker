# Solana Wallet Balance Checker

[中文说明 (Chinese Version)](./README_cn.md)

A React-based Web Application for batch checking SOL balances of Solana wallets. Quickly view balance information for corresponding wallet addresses by inputting a list of mnemonic phrases.

## 🎯 Features

- **Batch Balance Query**: Support checking SOL balances for multiple wallets simultaneously.
- **Mnemonic Validation**: Validate mnemonics using the BIP39 standard.
- **Real-time Display**: Show results in real-time during the query process for immediate feedback.
- **Sorted Results**: Automatically sort results from highest balance to lowest.
- **One-click Copy**: Click to copy mnemonics or wallet addresses.
- **Responsive Design**: Modern interface built with Tailwind CSS.

## 🔧 Tech Stack

- **Frontend**: React 18 + Tailwind CSS
- **Blockchain**: Solana Web3.js
- **Encryption**: BIP39 + ed25519-hd-key
- **Build Tools**: Create React App + react-app-rewired

## 🚀 Quick Start

### Prerequisites

- Node.js 14+
- npm or yarn

### Installation

```bash
npm install
```

### Configuration

1. Copy the example environment file:
```bash
cp .env.example .env.local
```

2. Edit `.env.local` to configure Solana RPC endpoint (optional):
```bash
REACT_APP_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
```

**Note**: Uses a free public RPC endpoint by default. For better performance, consider using private endpoints from services like [QuickNode](https://www.quicknode.com/) or [Alchemy](https://www.alchemy.com/).

### Run Development Server

```bash
npm start
```

Visit [http://localhost:3000](http://localhost:3000) to view the app.

## ☁️ Deploy to Cloudflare Pages

This project is recommended to be deployed on Cloudflare Pages, supporting automated builds and global CDN acceleration.

### 1. Preparation

- Register/Login to [Cloudflare Dashboard](https://dash.cloudflare.com/)
- Fork or Push this project to your GitHub repository

### 2. Create Project

1. Go to Cloudflare Pages dashboard
2. Click "Connect to Git"
3. Select your repository

### 3. Build Configuration

Cloudflare will automatically detect the React project. Please confirm the following settings:

- **Framework Preset**: Create React App
- **Build command**: `npm run build`
- **Build output directory**: `build`

### 4. Environment Variables

Add the following environment variables in build settings (Security > Environment variables):

- `REACT_APP_DEBANK_ACCESS_KEY`: Your DeBank Open API Key
- `REACT_APP_MORALIS_API_KEY`: Your Moralis API Key
- `NODE_VERSION`: `18` (Recommended)

> **Note**: If deploying via direct upload using the `wrangler` CLI, you need to write these variables to a local `.env` file, as dashboard variables only take effect during cloud builds.

### Local Preview Build

```bash
npm run build
npx serve -s build
```

## 📋 Usage Instructions

1. **Input Mnemonics**: Enter mnemonic phrases in the text area, one per line.
2. **Start Query**: Click the "Check Balances" button to start batch querying.
3. **View Results**: Results are displayed in real-time in the table, including:
   - Mnemonic (Click to copy)
   - Wallet Address (Click to copy)
   - SOL Balance
4. **Sorted Display**: Results are automatically sorted by balance from high to low.

## 🔐 Security Note

- **Local Processing**: All mnemonic processing is done locally in the browser.
- **No Data Storage**: The app does not store any mnemonic or private key information.
- **Read-only**: The app only reads balance information and does not execute any transactions.
- **Secure Connection**: Connects to trusted Solana RPC nodes via HTTPS.

## 🛠 Technical Implementation

### Wallet Derivation

Uses the standard Solana wallet derivation path:
```
m/44'/501'/0'/0'
```

### Mnemonic Validation

Validates mnemonics using BIP39 standard:
```javascript
bip39.validateMnemonic(mnemonic)
```

### Balance Query

Connects to Solana mainnet to query real-time balance:
```javascript
connection.getBalance(publicKey)
```

## 📁 Project Structure

```
src/
├── App.js              # Main App Component
├── MnemonicChecker.js  # Core Functionality Component
├── App.css             # App Styles
└── index.js            # App Entry Point
```

## ⚠️ Disclaimer

- This tool is for balance checking only. Please handle mnemonic information with care.
- Ensure usage in a secure environment to avoid mnemonic leakage.
- The developer is not responsible for any asset loss.

## 📄 License

This project is open source under the MIT License.