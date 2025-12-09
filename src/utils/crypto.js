import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

const ECPair = ECPairFactory(ecc);

if (!window.Buffer) {
    window.Buffer = Buffer;
}

// SOLANA
export const deriveKeypair = (mnemonic) => {
    try {
        const seed = bip39.mnemonicToSeedSync(mnemonic);
        const derivedSeed = derivePath("m/44'/501'/0'/0'", seed).key;
        return Keypair.fromSeed(derivedSeed);
    } catch (error) {
        throw new Error(`Keypair derivation failed: ${error.message}`);
    }
};

// EVM
export const deriveEvmAddress = (mnemonic, index) => {
    try {
        const path = `m/44'/60'/0'/0/${index}`;
        const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
        const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, path);
        return wallet.address;
    } catch (error) {
        console.warn(`EVM derivation failed for index ${index}:`, error);
        return null;
    }
};

// TRON
export const deriveTronAddress = (mnemonic, index) => {
    try {
        const path = `m/44'/195'/0'/0/${index}`;
        const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
        const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, path);
        const ethAddress = hdNode.address;
        const rawAddr = ethAddress.substring(2);
        const input = "41" + rawAddr;
        const hash1 = ethers.sha256("0x" + input);
        const hash2 = ethers.sha256(hash1);
        const checksum = hash2.substring(2, 10);
        const fullHex = input + checksum;
        const bytes = ethers.getBytes("0x" + fullHex);
        return bs58.encode(bytes);
    } catch (e) {
        console.warn(`Tron derivation failed: ${e}`);
        return null;
    }
};

// BTC
export const deriveBtcAddress = (mnemonic, type, index) => {
    try {
        const network = bitcoin.networks.bitcoin;
        const mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);

        let pathPrefix;
        if (type === 'native') pathPrefix = "m/84'/0'/0'/0";
        else if (type === 'nested') pathPrefix = "m/49'/0'/0'/0";
        else pathPrefix = "m/44'/0'/0'/0"; // legacy

        const path = `${pathPrefix}/${index}`;
        const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, path);

        // ethers private key is 0x... (32 bytes). Slice '0x'.
        const privateKeyBuffer = Buffer.from(hdNode.privateKey.slice(2), 'hex');
        const keyPair = ECPair.fromPrivateKey(privateKeyBuffer, { network });

        if (type === 'native') {
            const { address } = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network });
            return address;
        } else if (type === 'nested') {
            const { address } = bitcoin.payments.p2sh({
                redeem: bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network }),
                network,
            });
            return address;
        } else {
            const { address } = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey, network });
            return address;
        }
    } catch (e) {
        console.warn(`BTC Derivation failed (${type}): ${e}`);
        return null;
    }
};
