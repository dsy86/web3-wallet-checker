# Web3 Wallet Net Worth Checker

[中文说明 (Chinese Version)](./README_cn.md)

A React-based web application for batch checking wallet net worth across multiple networks from mnemonic phrases. It supports Solana, EVM, TRON, BTC, and HyperCore portfolio checks.

## 🎯 Features

- **Batch Net Worth Query**: Support checking multiple wallets and networks simultaneously.
- **Network Selection**: Choose which networks to query with checkboxes: EVM, Solana, TRON, BTC, and HyperCore.
- **Mnemonic Validation**: Validate mnemonics using the BIP39 standard.
- **Deep Address Discovery**: For EVM-like networks, starts from path index `0` and continues to deeper addresses when a wallet has net worth.
- **HyperCore Portfolio Query**: Uses Hyperliquid public info APIs and reads `summary.accountValueUsd` as HyperCore net worth.
- **Real-time Display**: Show results in real-time during the query process for immediate feedback.
- **Sorted Results**: Automatically sort results from highest net worth to lowest.
- **One-click Copy**: Click to copy mnemonics or wallet addresses.
- **Responsive Design**: Modern interface built with Tailwind CSS.

## 🔧 Tech Stack

- **Frontend**: React 18 + Tailwind CSS
- **Blockchain**: Solana Web3.js, ethers, bitcoinjs-lib, Hyperliquid info API
- **Encryption**: BIP39 + ed25519-hd-key + EVM/BTC HD derivation
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

2. Edit `.env.local` to configure API keys and Solana RPC endpoint:
```bash
REACT_APP_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
REACT_APP_DEBANK_ACCESS_KEY=your_debank_api_key
REACT_APP_MORALIS_API_KEY=your_moralis_api_key
```

**Note**: HyperCore uses the public Hyperliquid info API and does not require an API key. EVM net worth requires DeBank, and Solana net worth requires Moralis.

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
- `REACT_APP_SOLANA_RPC_URL`: Optional Solana RPC URL
- `NODE_VERSION`: `20` (Recommended for the current Cloudflare Pages build image)

> **Note**: If deploying via direct upload using the `wrangler` CLI, you need to write these variables to a local `.env` file, as dashboard variables only take effect during cloud builds.

### Local Preview Build

```bash
npm run build
npx serve -s build
```

## 📋 Usage Instructions

1. **Input Mnemonics**: Enter mnemonic phrases in the text area, one per line.
2. **Select Networks**: Check the networks you want to query: EVM, Solana, TRON, BTC, and/or HyperCore.
3. **Start Query**: Click the "Check Balances" button to start batch querying.
4. **View Results**: Results are displayed in real-time in the table, including:
   - Mnemonic (Click to copy)
   - Wallet Address (Click to copy)
   - Network type
   - Path index
   - Net worth in USD
5. **Sorted Display**: Results are automatically sorted by net worth from high to low.

## 🔐 Security Note

- **Local Processing**: All mnemonic processing is done locally in the browser.
- **No Data Storage**: The app does not store any mnemonic or private key information.
- **Read-only**: The app only reads balance information and does not execute any transactions.
- **Secure Connection**: Connects to external portfolio and chain APIs via HTTPS.

## 🛠 Technical Implementation

### Wallet Derivation

Solana uses the standard derivation path:
```
m/44'/501'/0'/0'
```

EVM and HyperCore use EVM-compatible addresses derived from:
```
m/44'/60'/0'/0/{index}
```

TRON and BTC use their own derivation paths in `src/utils/crypto.js`.

### Mnemonic Validation

Validates mnemonics using BIP39 standard:
```javascript
bip39.validateMnemonic(mnemonic)
```

### Net Worth Query

- EVM: DeBank total balance API
- Solana: Moralis Solana account and token APIs
- TRON: TronScan account API plus TRX pricing
- BTC: public BTC address APIs plus BTC pricing
- HyperCore: Hyperliquid `info` API, using `summary.accountValueUsd`

## 📁 Project Structure

```
src/
├── App.js              # Main App Component
├── MnemonicChecker.js  # Core Functionality Component
├── utils/
│   ├── api.js          # Network/API query helpers
│   └── crypto.js       # Mnemonic address derivation helpers
├── App.css             # App Styles
└── index.js            # App Entry Point
```

## ⚠️ Disclaimer

- This tool is for balance checking only. Please handle mnemonic information with care.
- Ensure usage in a secure environment to avoid mnemonic leakage.
- The developer is not responsible for any asset loss.

## 📄 License

This project is open source under the MIT License.
