import React from 'react';

const WalletRow = ({ data, comment, onCopy, onEdit }) => {
    return (
        <tr className="even:bg-gray-100 odd:bg-white hover:bg-blue-50">
            <td
                className="py-2 px-4 border cursor-pointer hover:text-blue-600 truncate max-w-xs"
                onClick={() => onCopy(data.mnemonic)}
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
                onClick={() => onCopy(data.address)}
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
                {data.links.tronscan && (
                    <a href={data.links.tronscan} target="_blank" rel="noreferrer" className="text-red-500 hover:underline">TronScan</a>
                )}
                {data.links.btc && (
                    <a href={data.links.btc} target="_blank" rel="noreferrer" className="text-yellow-600 hover:underline">Mempool</a>
                )}
                {data.links.opensea && (
                    <a href={data.links.opensea} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">OpenSea</a>
                )}
            </td>
            <td className="py-2 px-4 border text-center">
                <div className="flex items-center justify-between space-x-2">
                    <span className="truncate max-w-[150px] text-gray-700" title={comment}>
                        {comment || ''}
                    </span>
                    <button
                        onClick={() => onEdit(data.address)}
                        className="text-gray-400 hover:text-blue-500"
                    >
                        ✏️
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default WalletRow;
