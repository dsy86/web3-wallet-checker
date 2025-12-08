import React, { useState } from 'react';
import { Connection, clusterApiUrl, Keypair } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key'; // Helper to derive key from seed using ed25519 standard
import { Buffer } from 'buffer'; // Ensure Buffer is available for derivation logic

import { ethers } from 'ethers';

// Ensure Buffer is globally available for browser environments that might lack it
if (!window.Buffer) {
  window.Buffer = Buffer;
}

const DEBANK_TIMEOUT = 850; // DeBank Rate Limit Interval
const DEBANK_API_KEY = "058e80866a8d74cb04db12cc6a35f778cee54431";

const MnemonicChecker = () => {
  const [mnemonics, setMnemonics] = useState('');
  const [walletData, setWalletData] = useState([]);
  const [comments, setComments] = useState({}); // Address -> Comment
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [editingComment, setEditingComment] = useState('');

  // Queue System
  const queueRef = React.useRef([]); // Stores tasks: { id, mnemonic, pathIndex }
  const processingRef = React.useRef(false);
  const intervalRef = React.useRef(null);
  const walletsRef = React.useRef({}); // Store EVM wallets to track continuity: { [mnemonicIndex]: { [pathIndex]: balance } }

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

  const deriveEvmAddress = (mnemonic, index) => {
    try {
      // Standard Ethereum Path: m/44'/60'/0'/0/index
      const path = `m/44'/60'/0'/0/${index}`;

      // Ethers v6 Syntax
      const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
      const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, path);
      return wallet.address;
    } catch (error) {
      console.warn(`EVM derivation failed for index ${index}:`, error);
      return null;
    }
  };

  const fetchDebankBalance = async (address) => {
    try {
      const response = await fetch(`https://pro-openapi.debank.com/v1/user/total_balance?id=${address}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'AccessKey': DEBANK_API_KEY
        }
      });
      if (!response.ok) {
        if (response.status === 429) throw new Error("Rate Limit");
        throw new Error(`DeBank API Error: ${response.statusText}`);
      }
      const data = await response.json();
      return parseFloat(data.total_usd_value || 0);
    } catch (error) {
      console.warn(`Failed to fetch DeBank balance for ${address}:`, error);
      throw error; // Throw to trigger retry
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

  // Queue Processing Loop
  React.useEffect(() => {
    intervalRef.current = setInterval(async () => {
      if (queueRef.current.length > 0 && !processingRef.current) {
        processingRef.current = true;
        const task = queueRef.current.shift(); // FIFO

        const { mnemonicId, mnemonic, pathIndex } = task; // mnemonicID is index in mnemonicList
        console.log(`Processing EVM: ID=${mnemonicId} Path=${pathIndex}`);

        try {
          const address = deriveEvmAddress(mnemonic, pathIndex);
          if (address) {
            // Load Comment
            loadComment(address);

            const balance = await fetchDebankBalance(address);
            console.log(`Fetched EVM Balance: ${balance} for ${address}`);

            // Update UI Table
            setWalletData(prev => {
              const newer = [...prev];
              // Check if row already exists (retry case)
              const existingIdx = newer.findIndex(r => r.id === `evm-${mnemonicId}-${pathIndex}`);
              const row = {
                id: `evm-${mnemonicId}-${pathIndex}`,
                mnemonic: mnemonic,
                address: address,
                netWorth: balance,
                type: 'EVM',
                path: pathIndex,
                links: {
                  debank: `https://debank.com/profile/${address}`,
                  zerion: `https://app.zerion.io/${address}/overview`,
                  opensea: `https://opensea.io/${address}`
                }
              };

              if (existingIdx !== -1) newer[existingIdx] = row;
              else newer.push(row);

              return newer.sort((a, b) => b.netWorth - a.netWorth);
            });

            // Update Wallets Tracking for Continuity
            if (!walletsRef.current[mnemonicId]) walletsRef.current[mnemonicId] = {};
            walletsRef.current[mnemonicId][pathIndex] = balance;

            // Deep Search Logic (Producer)
            // Condition: If current > 0, produce next.
            // Or if previous (path-1) > 0, produce next.
            // Or if previous-previous (path-2) > 0, produce next.
            // HTML Logic: `if (balance > 0 || prevBalance > 0 || (path>=2 && prevPrevBalance > 0))`

            const prevBalance = walletsRef.current[mnemonicId][pathIndex - 1] || 0;
            const prevPrevBalance = walletsRef.current[mnemonicId][pathIndex - 2] || 0;

            if (balance > 0 || (pathIndex > 0 && prevBalance > 0) || (pathIndex >= 2 && prevPrevBalance > 0) || pathIndex === 0) {
              // Note: pathIndex === 0 always triggers path 1 check if we want to follow strict "check next" logic?
              // In HTML logic: `GenerateWalletFromMnemonic(path + 1)` is called if `path==0` OR conditions met.
              // So yes, always start path 1 if we did path 0.

              // Check if next path already in queue to avoid dupes?
              // Simple check: we just produce path + 1.
              // We should ensure we don't produce infinitely if balance is 0 but we keep passing checks.
              // The condition `balance > 0` is key. 
              // If `path=0` (bal=0), `path=1` is added.
              // If `path=1` (bal=0), `prev(0)=0`, stop. Correct.

              // Only produce next if we haven't already passed a "stop" point.
              // Add task to queue
              const nextPath = pathIndex + 1;
              queueRef.current.push({ mnemonicId, mnemonic, pathIndex: nextPath });
            }
          }
        } catch (error) {
          console.warn(`Task failed, retrying: ${task.pathIndex}`, error);
          // Retry: Push back to start or end? End seems safer for rate limit.
          queueRef.current.push(task);
        } finally {
          processingRef.current = false;
        }
      }
    }, DEBANK_TIMEOUT);

    return () => clearInterval(intervalRef.current);
  }, []);

  const handleCheckBalances = async () => {
    setLoading(true);
    setWalletData([]); // Clear previous data
    walletsRef.current = {}; // Clear wallet tracking

    // Clear Queue
    queueRef.current = [];

    const mnemonicList = mnemonics
      .split('\n')
      .map(m => m.trim().toLowerCase()) // Convert to lowercase
      .filter(m => m);

    // Initial Processing
    for (let i = 0; i < mnemonicList.length; i++) {
      const mnemonic = mnemonicList[i];

      // --- EVM Check (Initial Path 0) ---
      // Add to Queue
      queueRef.current.push({ mnemonicId: i, mnemonic: mnemonic, pathIndex: 0 });

      // --- Solana Check (Existing Logic) ---
      try {
        if (bip39.validateMnemonic(mnemonic)) {
          const keypair = deriveKeypair(mnemonic);
          const address = keypair.publicKey.toString();
          loadComment(address); // Load saved comment

          fetchNetWorth(address).then(netWorth => {
            setWalletData(prevData => [
              ...prevData,
              {
                id: `sol-${i}`,
                mnemonic: mnemonic,
                address: address,
                netWorth: netWorth,
                type: 'SOL',
                path: 'N/A', // Solana usually strictly one path per mnemonic in this tool context
                links: {
                  solscan: `https://solscan.io/account/${address}`
                }
              }
            ].sort((a, b) => b.netWorth - a.netWorth));
          });
        }
      } catch (e) {
        console.warn(`Solana derivation failed for ${i}`, e);
      }
    }

    // We don't really know when everything is done due to recursive EVM nature, 
    // but the Loop keeps running. Loading state is tricky here. 
    // We might just leave "Checking..." or change it to "Monitoring...".
    // For now, we set loading false after initiating initial batch, 
    // or maybe keep it true until some condition? 
    // The previous tool just ran a loop and finished. Now we have async queue.
    // Let's set loading false immediately but show a "Scanning..." indicator elsewhere?
    // Or just let the user see rows popping in.
    setLoading(false);
  };

  const openEditModal = (address) => {
    setEditingAddress(address);
    setEditingComment(comments[address] || '');
    setIsEditModalOpen(true);
  };

  const saveComment = () => {
    if (editingAddress) {
      const newComment = editingComment.trim();
      if (newComment) {
        localStorage.setItem(`comment-${editingAddress}`, newComment);
      } else {
        localStorage.removeItem(`comment-${editingAddress}`);
      }

      setComments(prev => ({
        ...prev,
        [editingAddress]: newComment
      }));
    }
    setIsEditModalOpen(false);
    setEditingAddress(null);
    setEditingComment('');
  };

  // Helper to load comment
  const loadComment = (address) => {
    const saved = localStorage.getItem(`comment-${address}`);
    if (saved) {
      setComments(prev => ({ ...prev, [address]: saved }));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-100 rounded-lg shadow-md mt-6 relative">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Wallet Net Worth Checker (SOL & EVM)</h1>
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
        {loading ? loadingMessage || 'Initiating Scan...' : 'Check Balances'}
      </button>

      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50">
          {toastMessage}
        </div>
      )}

      {/* Edit Comment Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h3 className="text-lg font-bold mb-4">Edit Comment</h3>
            <p className="text-sm text-gray-500 mb-2 truncate">{editingAddress}</p>
            <textarea
              className="w-full border border-gray-300 rounded p-2 mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
              rows="4"
              value={editingComment}
              onChange={(e) => setEditingComment(e.target.value)}
              placeholder="Enter comment..."
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={saveComment}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {walletData.length > 0 && (
        <table className="w-full mt-6 bg-white rounded-lg shadow-md overflow-hidden text-sm">
          <thead className="bg-blue-500 text-white">
            <tr>
              <th className="py-2 px-4 border">Mnemonic</th>
              <th className="py-2 px-4 border">Type</th>
              <th className="py-2 px-4 border">Path</th>
              <th className="py-2 px-4 border">Wallet Address</th>
              <th className="py-2 px-4 border">Net Worth ($)</th>
              <th className="py-2 px-4 border">Links</th>
              <th className="py-2 px-4 border">Comment</th>
            </tr>
          </thead>
          <tbody>
            {walletData.map((data, index) => (
              <tr key={index} className="even:bg-gray-100 odd:bg-white hover:bg-blue-50">
                <td
                  className="py-2 px-4 border cursor-pointer hover:text-blue-600 truncate max-w-xs"
                  onClick={() => copyToClipboard(data.mnemonic)}
                  title={data.mnemonic}
                >
                  {data.mnemonic.length > 20 ? data.mnemonic.slice(0, 10) + '...' + data.mnemonic.slice(-10) : data.mnemonic}
                </td>
                <td className="py-2 px-4 border text-center font-bold">
                  <span className={data.type === 'SOL' ? 'text-green-600' : 'text-purple-600'}>{data.type}</span>
                </td>
                <td className="py-2 px-4 border text-center">
                  {data.path}
                </td>
                <td
                  className="py-2 px-4 border cursor-pointer hover:text-blue-600 truncate max-w-xs"
                  onClick={() => copyToClipboard(data.address)}
                  title={data.address}
                >
                  {data.address.slice(0, 8) + '...' + data.address.slice(-8)}
                </td>
                <td className="py-2 px-4 border text-center font-mono">
                  ${data.netWorth.toFixed(2)}
                </td>
                <td className="py-2 px-4 border text-center space-x-2">
                  {data.links.solscan && (
                    <a href={data.links.solscan} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Solscan</a>
                  )}
                  {data.links.debank && (
                    <a href={data.links.debank} target="_blank" rel="noreferrer" className="text-orange-500 hover:underline">DeBank</a>
                  )}
                  {data.links.opensea && (
                    <a href={data.links.opensea} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">OpenSea</a>
                  )}
                </td>
                <td className="py-2 px-4 border text-center">
                  <div className="flex items-center justify-between space-x-2">
                    <span className="truncate max-w-[150px] text-gray-700" title={comments[data.address]}>
                      {comments[data.address] || ''}
                    </span>
                    <button
                      onClick={() => openEditModal(data.address)}
                      className="text-gray-400 hover:text-blue-500"
                    >
                      ✏️
                    </button>
                  </div>
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