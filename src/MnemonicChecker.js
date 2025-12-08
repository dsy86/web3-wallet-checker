import React, { useState } from 'react';
import { Connection, clusterApiUrl, Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key'; // Helper to derive key from seed using ed25519 standard
import { Buffer } from 'buffer'; // Ensure Buffer is available for derivation logic

// Ensure Buffer is globally available for browser environments that might lack it
if (!window.Buffer) {
  window.Buffer = Buffer;
}

const MnemonicChecker = () => {
  const [mnemonics, setMnemonics] = useState('');
  const [walletData, setWalletData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [toastMessage, setToastMessage] = useState(''); // For showing the Toast

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(''); // Hide the toast after 2 seconds
    }, 2000);
  };

  const deriveKeypair = (mnemonic) => {
    try {
      // Convert mnemonic to seed using bip39
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      // Derive key using Solana path m/44'/501'/0'/0' with ed25519-hd-key
      const derivedSeed = derivePath("m/44'/501'/0'/0'", seed).key;
      return Keypair.fromSeed(derivedSeed);
    } catch (error) {
      throw new Error(`Keypair derivation failed: ${error.message}`);
    }
  };

  const fetchNetWorth = async (address) => {
    try {
      const apiKey = process.env.REACT_APP_MORALIS_API_KEY;
      if (!apiKey) {
        console.warn("Moralis API Key is missing");
        return 0;
      }

      const headers = {
        'Accept': 'application/json',
        'X-API-Key': apiKey,
      };

      // 1. Fetch Native SOL Balance
      // Endpoint: /account/mainnet/{address}/balance
      const balanceResponse = await fetch(
        `https://solana-gateway.moralis.io/account/mainnet/${address}/balance`,
        { method: 'GET', headers }
      );
      const balanceData = await balanceResponse.json();
      const solBalance = parseFloat(balanceData.solana || 0);

      // 2. Fetch SOL Price
      // Endpoint: /token/mainnet/{address}/price
      // Wrapped SOL Mint: So11111111111111111111111111111111111111112
      const solPriceResponse = await fetch(
        `https://solana-gateway.moralis.io/token/mainnet/So11111111111111111111111111111111111111112/price`,
        { method: 'GET', headers }
      );
      const solPriceData = await solPriceResponse.json();
      const solPrice = solPriceData.usdPrice || 0;

      let totalUsd = solBalance * solPrice;

      // 3. Fetch Token Balances
      // Endpoint: /account/mainnet/{address}/tokens
      const tokensResponse = await fetch(
        `https://solana-gateway.moralis.io/account/mainnet/${address}/tokens`,
        { method: 'GET', headers }
      );
      const tokensData = await tokensResponse.json();

      // 4. Calculate Token Values (Iterate for top tokens)
      // Note: fetching price for every token might be slow/rate-limited. 
      // We will only fetch price for tokens that are verified or look legit (not possible spam).
      // Basic implementation: Promise.all for prices.
      if (Array.isArray(tokensData) && tokensData.length > 0) {
        const pricePromises = tokensData.map(async (token) => {
          // Skip if spam or tiny amount (optional optimization)
          if (token.possibleSpam) return 0;

          try {
            const tokenPriceResponse = await fetch(
              `https://solana-gateway.moralis.io/token/mainnet/${token.mint}/price`,
              { method: 'GET', headers }
            );
            const priceData = await tokenPriceResponse.json();
            const price = priceData.usdPrice || 0;

            // Calculate value
            const amount = parseFloat(token.amount); // Already adjusted? No, 'tokens' usually returns raw & adjusted.
            // Step 158 output showed "amount" as adjusted string "0.03".
            return parseFloat(token.amount) * price;
          } catch (e) {
            return 0;
          }
        });

        const tokenValues = await Promise.all(pricePromises);
        const totalTokenValue = tokenValues.reduce((a, b) => a + b, 0);
        totalUsd += totalTokenValue;
      }

      return totalUsd;

    } catch (error) {
      console.warn(`Failed to fetch net worth for ${address}:`, error);
      // Return 0 implies failure, but we might have partial data? 
      // Better to return 0 so user sees something is wrong if total fail.
      return 0;
    }
  };

  const handleCheckBalances = async () => {
    setLoading(true);
    setWalletData([]); // Clear previous data on new query
    const mnemonicList = mnemonics
      .split('\n')
      .map(m => m.trim().toLowerCase()) // Convert to lowercase
      .filter(m => m);

    const connection = new Connection(
      process.env.REACT_APP_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
      "confirmed"
    );

    let data = [];

    for (let i = 0; i < mnemonicList.length; i++) {
      const mnemonic = mnemonicList[i];
      try {
        if (!bip39.validateMnemonic(mnemonic)) {
          throw new Error('Invalid mnemonic');
        }

        const keypair = deriveKeypair(mnemonic);

        // Query net worth (includes SOL and Tokens)
        const netWorth = await fetchNetWorth(keypair.publicKey.toString());

        // Store data
        data.push({
          mnemonic: mnemonic,
          address: keypair.publicKey.toString(),
          netWorth: netWorth,
        });

        // Update the table immediately for real-time feedback
        setWalletData(prevData => [
          ...prevData,
          {
            mnemonic: mnemonic,
            address: keypair.publicKey.toString(),
            netWorth: netWorth,
          }
        ]);

        // Update progress
        setLoadingMessage(`Checking... ${i + 1}/${mnemonicList.length}`);
      } catch (error) {
        console.warn(`Invalid mnemonic: ${mnemonic}, ${error.message}`);
      }
    }

    // Sort data by net worth in descending order
    data.sort((a, b) => b.netWorth - a.netWorth);
    setWalletData(data); // Update state with sorted data

    setLoading(false);
    setLoadingMessage(''); // Clear loading message
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-100 rounded-lg shadow-md mt-6 relative">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Solana Wallet Checker</h1>
      <textarea
        className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
        rows="5"
        value={mnemonics}
        onChange={(e) => setMnemonics(e.target.value)}
        placeholder="Enter your mnemonics, one per line"
      />
      <button
        onClick={handleCheckBalances}
        className={`w-full py-2 rounded text-white font-semibold ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
        disabled={loading}
      >
        {loading ? loadingMessage || 'Checking...' : 'Check Balances'}
      </button>

      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded shadow-lg">
          {toastMessage}
        </div>
      )}

      {walletData.length > 0 && (
        <table className="w-full mt-6 bg-white rounded-lg shadow-md overflow-hidden">
          <thead className="bg-blue-500 text-white">
            <tr>
              <th className="py-2 px-4 border">Mnemonic</th>
              <th className="py-2 px-4 border">Wallet Address</th>
              <th className="py-2 px-4 border">Net Worth ($)</th>
            </tr>
          </thead>
          <tbody>
            {walletData.map((data, index) => (
              <tr key={index} className="even:bg-gray-100 odd:bg-white">
                <td
                  className="py-2 px-4 border cursor-pointer hover:text-blue-600 truncate"
                  onClick={() => copyToClipboard(data.mnemonic)}
                  title={data.mnemonic}
                >
                  {data.mnemonic.length > 20 ? data.mnemonic.slice(0, 10) + '...' + data.mnemonic.slice(-10) : data.mnemonic}
                </td>
                <td
                  className="py-2 px-4 border cursor-pointer hover:text-blue-600 truncate"
                  onClick={() => copyToClipboard(data.address)}
                  title={data.address}
                >
                  {data.address.slice(0, 10) + '...' + data.address.slice(-10)}
                </td>
                <td className="py-2 px-4 border text-center">
                  ${data.netWorth.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MnemonicChecker;