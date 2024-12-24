require('dotenv').config();
const { getWeb3, walletAddress, switchRpc } = require('./config/web3');
const { wrap } = require('./src/module/wrap/wrap');
const { unwrap } = require('./src/module/wrap/unwrap');
const BN = require('bn.js');
const Web3 = require('web3');

// Rastgele gaz fiyatı hesaplama fonksiyonu
function randomGasPrice(web3Instance) {
    const minGwei = new BN(web3Instance.utils.toWei('0.11', 'gwei'));
    const maxGwei = new BN(web3Instance.utils.toWei('0.15', 'gwei'));
    const randomGwei = minGwei.add(new BN(Math.floor(Math.random() * (maxGwei.sub(minGwei).toNumber()))));
    return randomGwei;
}

// Nonce alma fonksiyonu
async function getNonce(web3Instance) {
    return await web3Instance.eth.getTransactionCount(walletAddress, 'pending');
}

// İşlem yürütme fonksiyonu
async function executeTransaction(action, gasPriceWei, localNonce, ...args) {
    let web3Instance = getWeb3();
    while (true) {
        try {
            const gasLimit = new BN(100000);
            const totalTxCost = gasLimit.mul(new BN(gasPriceWei));
            const balanceWei = await web3Instance.eth.getBalance(walletAddress);
            const balance = new BN(balanceWei);

            if (balance.lt(totalTxCost)) {
                console.log("Insufficient funds to cover the transaction cost. Transaction skipped.");
                return;
            }

            return await action(...args, gasPriceWei.toString(), localNonce);
        } catch (error) {
            console.error(`Error executing transaction: ${error.message}`);
            if (error.message.includes("Invalid JSON RPC response")) {
                console.log("Retrying...");
                web3Instance = switchRpc(); 
            } else if (error.message.includes("nonce too low")) {
                console.log("Nonce too low, retrying with new nonce...");
                localNonce = await getNonce(web3Instance);
            } else {
                await new Promise(resolve => setTimeout(resolve, 5000)); 
            }
        }
    }
}

// WETH bakiyesini alma fonksiyonu
async function getWethBalance(web3Instance, wethContractAddress, walletAddress) {
    const wethChecksumAddress = Web3.utils.toChecksumAddress(wethContractAddress);
    const wethContract = new web3Instance.eth.Contract([
        {
            "constant": true,
            "inputs": [{ "name": "_owner", "type": "address" }],
            "name": "balanceOf",
            "outputs": [{ "name": "balance", "type": "uint256" }],
            "type": "function"
        }
    ], wethChecksumAddress);

    const balance = await wethContract.methods.balanceOf(walletAddress).call();
    return new BN(balance);
}

// İşlemin gerçekleşip gerçekleşmediğini teyit eden fonksiyon
async function confirmTransaction(web3Instance, txHash) {
    const receipt = await web3Instance.eth.getTransactionReceipt(txHash);
    return receipt && receipt.status;
}

// WETH bakiyesini periyodik olarak kontrol eden fonksiyon
async function waitForWethBalance(web3Instance, wethContractAddress, walletAddress, timeout = 60000, interval = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const wethBalance = await getWethBalance(web3Instance, wethContractAddress, walletAddress);
        if (!wethBalance.isZero()) {
            return wethBalance;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error("WETH balance did not appear within the timeout period.");
}

// ETH bakiyesini periyodik olarak kontrol eden fonksiyon
async function waitForEthBalance(web3Instance, walletAddress, requiredBalance, timeout = 60000, interval = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const balanceWei = await web3Instance.eth.getBalance(walletAddress);
        const balance = new BN(balanceWei);
        if (balance.gte(requiredBalance)) {
            return balance;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error("Required ETH balance did not appear within the timeout period.");
}

// Rastgele bir bekleme süresi oluşturma (0 ile max ms arasında)
function getRandomWaitTime(maxMilliseconds) {
    return Math.floor(Math.random() * maxMilliseconds);
}

async function main() {
    let web3Instance = getWeb3();
    const maxIterations = 50;
    const totalDurationMilliseconds = 5 * 60 * 60 * 1000; // 5 saat toplam süre
    const maxWaitTimePerIteration = totalDurationMilliseconds / maxIterations;
    let completedIterations = 0;
    let completedSwaps = 0;
    const wethContractAddress = '0xA51894664A773981C6C112C43ce576f315d5b1B6'; // Taiko ağı için doğru WETH contract adresi

    while (completedIterations < maxIterations) {
        const waitTime = getRandomWaitTime(maxWaitTimePerIteration);
        console.log(`Waiting for ${waitTime / 1000} seconds before next iteration.`);
        
        // Belirlenen zamana kadar bekleyin
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        const gasPriceWei = randomGasPrice(web3Instance);
        let localNonce = await getNonce(web3Instance);

        const balanceWei = await web3Instance.eth.getBalance(walletAddress);
        const balance = new BN(balanceWei);
        const gasLimit = new BN(500000); 
        const totalTxCost = gasLimit.mul(gasPriceWei);

        console.log(`Gas Limit: ${gasLimit.toString()}, Gas Price: ${web3Instance.utils.fromWei(gasPriceWei, 'gwei')} Gwei`);
        console.log(`Total Tx Cost: ${web3Instance.utils.fromWei(totalTxCost.toString(), 'ether')} ETH`);

        if (balance.lt(totalTxCost)) {
            console.log("Insufficient funds to cover the transaction cost. Transaction skipped.");
            break;
        }

        // ETH to WETH (Wrap)
        const amountToWrap = balance.muln(90).divn(100); // %90 of the balance
        await waitForEthBalance(web3Instance, walletAddress, amountToWrap.add(totalTxCost)); // Check if the required ETH balance is available

        localNonce = await getNonce(web3Instance);
        let txHash = await executeTransaction(wrap, gasPriceWei, localNonce, web3Instance.utils.fromWei(amountToWrap, 'ether'));
        if (!txHash) break;
        localNonce++;
        let txLink = `https://taikoscan.io/tx/${txHash}`;
        console.log(`Wrap Transaction sent: ${txLink}, \nAmount: ${web3Instance.utils.fromWei(amountToWrap, 'ether')} ETH`);
        completedSwaps++;

        // Wait for wrap transaction to be confirmed
        let confirmed = false;
        while (!confirmed) {
            confirmed = await confirmTransaction(web3Instance, txHash);
            if (!confirmed) {
                console.log("Wrap transaction not confirmed yet. Waiting...");
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before checking again
            }
        }
        console.log("Wrap transaction confirmed.");

        // WETH to ETH (Unwrap)
        const wethBalance = await waitForWethBalance(web3Instance, wethContractAddress, walletAddress);
        console.log(`WETH Balance: ${web3Instance.utils.fromWei(wethBalance, 'ether')} WETH`);

        localNonce = await getNonce(web3Instance);
        txHash = await executeTransaction(unwrap, gasPriceWei, localNonce, web3Instance.utils.fromWei(wethBalance, 'ether'));
        if (!txHash) break;
        localNonce++;
        txLink = `https://taikoscan.io/tx/${txHash}`;
        console.log(`Unwrap Transaction sent: ${txLink}, \nAmount: ${web3Instance.utils.fromWei(wethBalance, 'ether')} WETH`);
        completedSwaps++;

        completedIterations++;
        console.log(`Completed ${completedIterations} iterations and ${completedSwaps} swaps.`);
    }

    console.log(`Completed all ${maxIterations} iterations. Exiting loop.`);
}

main().catch(console.error);
