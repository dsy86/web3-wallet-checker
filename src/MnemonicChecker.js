import React, { useState, useEffect, useRef } from 'react';
import * as bip39 from 'bip39';
import {
  deriveEvmAddress,
  deriveTronAddress,
  deriveBtcAddress,
  deriveKeypair,
  // deriveSolanaAddress is just deriveKeypair.publicKey.toString()
} from './utils/crypto';
import {
  fetchDebankBalance,
  fetchSolanaNetWorth,
  fetchTronBalance,
  fetchBtcBalance,
  fetchBtcPrice,
  fetchHyperCoreNetWorth
} from './utils/api';
import WalletRow from './components/WalletRow';

const DEBANK_TIMEOUT = 850;
const SOLANA_TIMEOUT = 1000;
const TRON_TIMEOUT = 1000;
const BTC_TIMEOUT = 1000;
const HYPERCORE_TIMEOUT = 1000;

const MnemonicChecker = () => {
  const [mnemonics, setMnemonics] = useState('');
  const [walletData, setWalletData] = useState([]);
  const [comments, setComments] = useState({}); // Address -> Comment

  // Progress State
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isScanning, setIsScanning] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [editingComment, setEditingComment] = useState('');

  // Network Selections
  const [selectedNetworks, setSelectedNetworks] = useState({
    evm: false,
    sol: false,
    tron: false,
    btc: false,
    hypercore: false
  });

  // Queue System
  const queueRef = useRef([]); // EVM Tasks
  const solanaQueueRef = useRef([]); // Solana Tasks
  const tronQueueRef = useRef([]); // Tron Tasks
  const btcQueueRef = useRef([]); // BTC Tasks
  const hyperCoreQueueRef = useRef([]); // HyperCore Tasks

  const processingRef = useRef(false);
  const solanaProcessingRef = useRef(false);
  const tronProcessingRef = useRef(false);
  const btcProcessingRef = useRef(false);
  const hyperCoreProcessingRef = useRef(false);

  const intervalRef = useRef(null);
  const solanaIntervalRef = useRef(null);
  const tronIntervalRef = useRef(null);
  const btcIntervalRef = useRef(null);
  const hyperCoreIntervalRef = useRef(null);

  const walletsRef = useRef({});
  const tronWalletsRef = useRef({});
  const btcWalletsRef = useRef({});
  const hyperCoreWalletsRef = useRef({});

  const pendingCountsRef = useRef({});

  // Load selections from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedNetworks');
    if (saved) {
      setSelectedNetworks(prev => ({ ...prev, ...JSON.parse(saved) }));
    }
  }, []);

  const toggleNetwork = (net) => {
    setSelectedNetworks(prev => {
      const next = { ...prev, [net]: !prev[net] };
      localStorage.setItem('selectedNetworks', JSON.stringify(next));
      return next;
    });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 2000);
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
      setComments(prev => ({ ...prev, [editingAddress]: newComment }));
    }
    setIsEditModalOpen(false);
    setEditingAddress(null);
    setEditingComment('');
  };

  const loadComment = (address) => {
    const saved = localStorage.getItem(`comment-${address}`);
    if (saved) {
      setComments(prev => ({ ...prev, [address]: saved }));
    }
  };

  const shorten = (str, len = 6) => {
    if (!str) return '';
    if (str.length <= len * 2) return str;
    return `${str.slice(0, len)}...${str.slice(-len)}`;
  };

  const logProcess = (network, mnemonic, address, worth = null) => {
    const shortMnemonic = shorten(mnemonic, 10);
    const shortAddress = shorten(address, 6);
    if (worth !== null) {
      console.log(`[${network}] ✅ Found $${worth.toFixed(2)} | Alloc: ${shortMnemonic} | Addr: ${shortAddress}`);
    } else {
      console.log(`[${network}] 🔍 Checking | Alloc: ${shortMnemonic} | Addr: ${shortAddress}`);
    }
  };



  const retryOneWallet = async (walletDataRow) => {
    const { address, mnemonic, type, id } = walletDataRow;
    let newWorth = null;

    setWalletData(prev => prev.map(r => r.id === id ? { ...r, isRetrying: true } : r));
    logProcess('RETRY', mnemonic, address);

    try {
      if (type === 'EVM') {
        newWorth = await fetchDebankBalance(address);
      } else if (type === 'SOL') {
        newWorth = await fetchSolanaNetWorth(address);
      } else if (type === 'TRON') {
        newWorth = await fetchTronBalance(address);
      } else if (type.includes('BTC')) {
        const btcBalance = await fetchBtcBalance(address);
        const btcPrice = await fetchBtcPrice();
        if (btcBalance !== null && btcPrice) {
          newWorth = btcBalance * btcPrice;
        } else {
          newWorth = null;
        }
      } else if (type === 'HyperCore') {
        newWorth = await fetchHyperCoreNetWorth(address);
      }
    } catch (e) {
      console.warn("Manual retry failed", e);
      newWorth = null;
    }

    setWalletData(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (newWorth !== null) {
        logProcess('RETRY', mnemonic, address, newWorth);
        return { ...r, netWorth: newWorth, isError: false, isRetrying: false };
      } else {
        return { ...r, isError: true, isRetrying: false };
      }
    }));
  };

  // EVM Queue
  useEffect(() => {
    intervalRef.current = setInterval(async () => {
      if (queueRef.current.length > 0 && !processingRef.current) {
        processingRef.current = true;
        const task = queueRef.current.shift();
        const { mnemonicId, mnemonic, pathIndex } = task;

        try {
          const address = deriveEvmAddress(mnemonic, pathIndex);
          if (address) {
            logProcess('EVM', mnemonic, address);
            loadComment(address);
            const balance = await fetchDebankBalance(address);
            if (balance !== null && balance > 0) logProcess('EVM', mnemonic, address, balance);

            setWalletData(prev => {
              const newer = [...prev];
              const existingIdx = newer.findIndex(r => r.id === `evm-${mnemonicId}-${pathIndex}`);
              const row = {
                id: `evm-${mnemonicId}-${pathIndex}`,
                mnemonic, address, netWorth: balance === null ? 0 : balance, type: 'EVM', path: pathIndex,
                isError: balance === null,
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

            if (!walletsRef.current[mnemonicId]) walletsRef.current[mnemonicId] = {};
            walletsRef.current[mnemonicId][pathIndex] = balance;

            const prevBalance = walletsRef.current[mnemonicId][pathIndex - 1] || 0;
            const prevPrevBalance = walletsRef.current[mnemonicId][pathIndex - 2] || 0;

            if (balance > 0 || (pathIndex > 0 && prevBalance > 0) || (pathIndex >= 2 && prevPrevBalance > 0) || pathIndex === 0) {
              queueRef.current.unshift({ mnemonicId, mnemonic, pathIndex: pathIndex + 1 });
            } else {
              pendingCountsRef.current[mnemonicId]--;
              if (pendingCountsRef.current[mnemonicId] === 0) {
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
              }
            }
          }
        } catch (error) {
          console.warn(`EVM Task failed: ${pathIndex}`, error);
          queueRef.current.push(task);
        } finally {
          processingRef.current = false;
        }
      }
      checkGlobalCompletion();
    }, DEBANK_TIMEOUT);
    return () => clearInterval(intervalRef.current);
  }, [isScanning]);

  // HyperCore Queue
  useEffect(() => {
    hyperCoreIntervalRef.current = setInterval(async () => {
      if (hyperCoreQueueRef.current.length > 0 && !hyperCoreProcessingRef.current) {
        hyperCoreProcessingRef.current = true;
        const task = hyperCoreQueueRef.current.shift();
        const { mnemonicId, mnemonic, pathIndex } = task;

        try {
          const address = deriveEvmAddress(mnemonic, pathIndex);
          if (address) {
            logProcess('HyperCore', mnemonic, address);
            loadComment(address);
            const netWorth = await fetchHyperCoreNetWorth(address);
            if (netWorth !== null && netWorth > 0) logProcess('HyperCore', mnemonic, address, netWorth);

            setWalletData(prev => {
              const newer = [...prev];
              const existingIdx = newer.findIndex(r => r.id === `hypercore-${mnemonicId}-${pathIndex}`);
              const row = {
                id: `hypercore-${mnemonicId}-${pathIndex}`,
                mnemonic, address, netWorth: netWorth === null ? 0 : netWorth, type: 'HyperCore', path: pathIndex,
                isError: netWorth === null,
                links: { hyperliquid: 'https://app.hyperliquid.xyz/' }
              };
              if (existingIdx !== -1) newer[existingIdx] = row;
              else newer.push(row);
              return newer.sort((a, b) => b.netWorth - a.netWorth);
            });

            if (!hyperCoreWalletsRef.current[mnemonicId]) hyperCoreWalletsRef.current[mnemonicId] = {};
            hyperCoreWalletsRef.current[mnemonicId][pathIndex] = netWorth;

            const prevBalance = hyperCoreWalletsRef.current[mnemonicId][pathIndex - 1] || 0;
            const prevPrevBalance = hyperCoreWalletsRef.current[mnemonicId][pathIndex - 2] || 0;

            if (netWorth > 0 || (pathIndex > 0 && prevBalance > 0) || (pathIndex >= 2 && prevPrevBalance > 0) || pathIndex === 0) {
              hyperCoreQueueRef.current.unshift({ mnemonicId, mnemonic, pathIndex: pathIndex + 1 });
            } else {
              pendingCountsRef.current[mnemonicId]--;
              if (pendingCountsRef.current[mnemonicId] === 0) {
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
              }
            }
          }
        } catch (error) {
          console.warn(`HyperCore Task failed: ${pathIndex}`, error);
          hyperCoreQueueRef.current.push(task);
        } finally {
          hyperCoreProcessingRef.current = false;
        }
      }
      checkGlobalCompletion();
    }, HYPERCORE_TIMEOUT);
    return () => clearInterval(hyperCoreIntervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  // Solana Queue
  useEffect(() => {
    solanaIntervalRef.current = setInterval(async () => {
      if (solanaQueueRef.current.length > 0 && !solanaProcessingRef.current) {
        solanaProcessingRef.current = true;
        const task = solanaQueueRef.current.shift();
        const { mnemonicId, mnemonic } = task;

        try {
          if (bip39.validateMnemonic(mnemonic)) {
            const keypair = deriveKeypair(mnemonic);
            const address = keypair.publicKey.toString();
            logProcess('SOL', mnemonic, address);
            loadComment(address);
            const netWorth = await fetchSolanaNetWorth(address);
            if (netWorth !== null && netWorth > 0) logProcess('SOL', mnemonic, address, netWorth);

            setWalletData(prevData => [
              ...prevData,
              {
                id: `sol-${mnemonicId}`, mnemonic, address, netWorth: netWorth === null ? 0 : netWorth, type: 'SOL', path: '-',
                isError: netWorth === null,
                links: { solscan: `https://solscan.io/account/${address}` }
              }
            ].sort((a, b) => b.netWorth - a.netWorth));
          }

          pendingCountsRef.current[mnemonicId]--;
          if (pendingCountsRef.current[mnemonicId] === 0) {
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
          }
        } catch (error) {
          console.warn(`Solana Task failed`, error);
          solanaQueueRef.current.push(task);
        } finally {
          solanaProcessingRef.current = false;
        }
      }
      checkGlobalCompletion();
    }, SOLANA_TIMEOUT);
    return () => clearInterval(solanaIntervalRef.current);
  }, [progress.total, progress.current, isScanning]);

  // Tron Queue
  useEffect(() => {
    tronIntervalRef.current = setInterval(async () => {
      if (tronQueueRef.current.length > 0 && !tronProcessingRef.current) {
        tronProcessingRef.current = true;
        const task = tronQueueRef.current.shift();
        const { mnemonicId, mnemonic, pathIndex } = task;

        try {
          const address = deriveTronAddress(mnemonic, pathIndex);
          if (address) {
            logProcess('TRON', mnemonic, address);
            loadComment(address);
            const netWorth = await fetchTronBalance(address);
            if (netWorth !== null && netWorth > 0) logProcess('TRON', mnemonic, address, netWorth);

            setWalletData(prev => {
              const newer = [...prev];
              const existingIdx = newer.findIndex(r => r.id === `tron-${mnemonicId}-${pathIndex}`);
              const row = {
                id: `tron-${mnemonicId}-${pathIndex}`, mnemonic, address, netWorth: netWorth === null ? 0 : netWorth, type: 'TRON', path: pathIndex,
                isError: netWorth === null,
                links: { tronscan: `https://tronscan.org/#/address/${address}` }
              };
              if (existingIdx !== -1) newer[existingIdx] = row;
              else newer.push(row);
              return newer.sort((a, b) => b.netWorth - a.netWorth);
            });

            if (!tronWalletsRef.current[mnemonicId]) tronWalletsRef.current[mnemonicId] = {};
            tronWalletsRef.current[mnemonicId][pathIndex] = netWorth;

            const prevBalance = tronWalletsRef.current[mnemonicId][pathIndex - 1] || 0;
            const prevPrevBalance = tronWalletsRef.current[mnemonicId][pathIndex - 2] || 0;

            if (netWorth > 0 || (pathIndex > 0 && prevBalance > 0) || (pathIndex >= 2 && prevPrevBalance > 0) || pathIndex === 0) {
              tronQueueRef.current.unshift({ mnemonicId, mnemonic, pathIndex: pathIndex + 1 });
            } else {
              pendingCountsRef.current[mnemonicId]--;
              if (pendingCountsRef.current[mnemonicId] === 0) {
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
              }
            }
          }
        } catch (e) {
          console.warn(`Tron task failed`, e);
          tronQueueRef.current.push(task);
        } finally {
          tronProcessingRef.current = false;
        }
      }
      checkGlobalCompletion();
    }, TRON_TIMEOUT);
    return () => clearInterval(tronIntervalRef.current);
  }, [isScanning]);

  // BTC Queue
  useEffect(() => {
    btcIntervalRef.current = setInterval(async () => {
      if (btcQueueRef.current.length > 0 && !btcProcessingRef.current) {
        btcProcessingRef.current = true;
        const task = btcQueueRef.current.shift();
        const { mnemonicId, mnemonic, pathIndex, type } = task;

        try {
          const address = deriveBtcAddress(mnemonic, type, pathIndex);
          if (address) {
            logProcess('BTC', mnemonic, address);
            loadComment(address);
            const btcBalance = await fetchBtcBalance(address);
            const btcPrice = await fetchBtcPrice();

            let netWorth = 0;
            let isError = false;

            if (btcBalance !== null) {
              netWorth = btcBalance * (btcPrice || 0);
              if (netWorth > 0) logProcess('BTC', mnemonic, address, netWorth);
            } else {
              isError = true;
            }

            setWalletData(prev => {
              const newer = [...prev];
              const id = `btc-${type}-${mnemonicId}-${pathIndex}`;
              const typeLabel = type === 'native' ? 'BTC (Native)' : type === 'nested' ? 'BTC (SegWit)' : 'BTC (Legacy)';
              const existingIdx = newer.findIndex(r => r.id === id);
              const row = {
                id, mnemonic, address, netWorth, type: typeLabel, path: pathIndex,
                isError,
                links: { btc: `https://mempool.space/address/${address}` }
              };
              if (existingIdx !== -1) newer[existingIdx] = row;
              else newer.push(row);
              return newer.sort((a, b) => b.netWorth - a.netWorth);
            });

            if (!btcWalletsRef.current[mnemonicId]) btcWalletsRef.current[mnemonicId] = {};
            if (!btcWalletsRef.current[mnemonicId][type]) btcWalletsRef.current[mnemonicId][type] = {};
            btcWalletsRef.current[mnemonicId][type][pathIndex] = netWorth;

            const prevBalance = btcWalletsRef.current[mnemonicId][type][pathIndex - 1] || 0;
            const prevPrevBalance = btcWalletsRef.current[mnemonicId][type][pathIndex - 2] || 0;

            if (netWorth > 0 || (pathIndex > 0 && prevBalance > 0) || (pathIndex >= 2 && prevPrevBalance > 0) || pathIndex === 0) {
              btcQueueRef.current.unshift({ mnemonicId, mnemonic, pathIndex: pathIndex + 1, type });
            } else {
              pendingCountsRef.current[mnemonicId]--;
              if (pendingCountsRef.current[mnemonicId] === 0) {
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
              }
            }
          }
        } catch (e) {
          console.warn(`BTC task failed`, e);
          btcQueueRef.current.push(task);
        } finally {
          btcProcessingRef.current = false;
        }
      }
      checkGlobalCompletion();
    }, BTC_TIMEOUT);
    return () => clearInterval(btcIntervalRef.current);
  }, [isScanning]);

  const checkGlobalCompletion = () => {
    if (queueRef.current.length === 0 && !processingRef.current &&
      solanaQueueRef.current.length === 0 && !solanaProcessingRef.current &&
      tronQueueRef.current.length === 0 && !tronProcessingRef.current &&
      btcQueueRef.current.length === 0 && !btcProcessingRef.current &&
      hyperCoreQueueRef.current.length === 0 && !hyperCoreProcessingRef.current &&
      isScanning) {
      setIsScanning(false);
    }
  };

  const handleCheckBalances = async () => {
    setWalletData([]);
    walletsRef.current = {}; tronWalletsRef.current = {}; btcWalletsRef.current = {}; hyperCoreWalletsRef.current = {};
    queueRef.current = []; solanaQueueRef.current = []; tronQueueRef.current = []; btcQueueRef.current = []; hyperCoreQueueRef.current = [];

    const mnemonicList = mnemonics.split('\n').map(m => m.trim().toLowerCase()).filter(m => m);

    pendingCountsRef.current = {};
    for (let i = 0; i < mnemonicList.length; i++) {
      let count = 0;
      if (selectedNetworks.evm) count++;
      if (selectedNetworks.sol) count++;
      if (selectedNetworks.tron) count++;
      if (selectedNetworks.btc) count += 3;
      if (selectedNetworks.hypercore) count++;
      pendingCountsRef.current[i] = count;
    }

    setProgress({ current: 0, total: mnemonicList.length });
    setIsScanning(true);

    for (let i = 0; i < mnemonicList.length; i++) {
      const mnemonic = mnemonicList[i];
      if (selectedNetworks.evm) queueRef.current.push({ mnemonicId: i, mnemonic, pathIndex: 0 });
      if (selectedNetworks.sol) solanaQueueRef.current.push({ mnemonicId: i, mnemonic });
      if (selectedNetworks.tron) tronQueueRef.current.push({ mnemonicId: i, mnemonic, pathIndex: 0 });
      if (selectedNetworks.hypercore) hyperCoreQueueRef.current.push({ mnemonicId: i, mnemonic, pathIndex: 0 });
      if (selectedNetworks.btc) {
        btcQueueRef.current.push({ mnemonicId: i, mnemonic, pathIndex: 0, type: 'native' });
        btcQueueRef.current.push({ mnemonicId: i, mnemonic, pathIndex: 0, type: 'nested' });
        btcQueueRef.current.push({ mnemonicId: i, mnemonic, pathIndex: 0, type: 'legacy' });
      }
    }
  };

  const totalNetWorth = walletData.reduce((acc, curr) => acc + curr.netWorth, 0);

  useEffect(() => {
    document.title = `Total: $${totalNetWorth.toFixed(2)} - Wallet Checker`;
  }, [totalNetWorth]);

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-100 rounded-lg shadow-md mt-6 relative">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Wallet Net Worth Checker (SOL & EVM)</h1>
        <div className="bg-green-100 px-4 py-2 rounded-lg shadow border border-green-300">
          <span className="text-gray-600 font-semibold mr-2">Total:</span>
          <span className="text-2xl font-bold text-green-700 font-mono">${totalNetWorth.toFixed(2)}</span>
        </div>
      </div>
      <textarea
        className="w-full p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
        rows="5"
        value={mnemonics}
        onChange={(e) => setMnemonics(e.target.value)}
        placeholder="Enter your mnemonics, one per line"
      />

      <div className="flex space-x-6 mb-4 p-2 bg-white rounded border border-gray-200">
        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={selectedNetworks.evm} onChange={() => toggleNetwork('evm')} className="form-checkbox h-5 w-5 text-blue-600" /><span className="text-gray-700">EVM</span></label>
        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={selectedNetworks.sol} onChange={() => toggleNetwork('sol')} className="form-checkbox h-5 w-5 text-green-600" /><span className="text-gray-700">SOLANA</span></label>
        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={selectedNetworks.tron} onChange={() => toggleNetwork('tron')} className="form-checkbox h-5 w-5 text-red-600" /><span className="text-gray-700">TRON</span></label>
        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={selectedNetworks.btc} onChange={() => toggleNetwork('btc')} className="form-checkbox h-5 w-5 text-yellow-600" /><span className="text-gray-700">BTC</span></label>
        <label className="flex items-center space-x-2 cursor-pointer"><input type="checkbox" checked={selectedNetworks.hypercore} onChange={() => toggleNetwork('hypercore')} className="form-checkbox h-5 w-5 text-cyan-600" /><span className="text-gray-700">HyperCore</span></label>
      </div>

      <button
        onClick={handleCheckBalances}
        className={`w-full py-2 rounded text-white font-semibold ${isScanning ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
        disabled={isScanning}
      >
        {isScanning ? `Checking... (${progress.current}/${progress.total})` : 'Check Balances'}
      </button>

      {toastMessage && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50">
          {toastMessage}
        </div>
      )}

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
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
              <button onClick={saveComment} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Save</button>
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
              <th className="py-2 px-4 border">Addr</th>
              <th className="py-2 px-4 border">Worth</th>
              <th className="py-2 px-4 border">Links</th>
              <th className="py-2 px-4 border">Comment</th>
            </tr>
          </thead>
          <tbody>
            {walletData.map((data, index) => (
              <WalletRow
                key={index}
                data={data}
                comment={comments[data.address]}
                onCopy={copyToClipboard}
                onEdit={openEditModal}
                onRetry={retryOneWallet}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MnemonicChecker;
