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
        // WETH contract ABI (minimal version, only balanceOf method)
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

// Rastgele gecikme süresi hesaplama fonksiyonu
function getRandomDelay(totalIterations, totalDurationHours) {
    const totalDurationMs = totalDurationHours * 60 * 60 * 1000; // Toplam süreyi milisaniyeye çevir
    const averageDelayMs = totalDurationMs / totalIterations; // Ortalama gecikme süresi
    const minDelayMs = averageDelayMs * 0.5; // Minimum gecikme süresi
    const maxDelayMs = averageDelayMs * 1.5; // Maksimum gecikme süresi
    return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs; // Rastgele gecikme süresi
}

async function main() {
    let web3Instance = getWeb3();
    const maxIterations = 50;
    const totalDurationHours = 5; // Toplam süre: 5 saat
    let iterationCount = 0;
    const wethContractAddress = '0xA51894664A773981C6C112C43ce576f315d5b1B6'; // Taiko ağı için doğru WETH contract adresi

    while (iterationCount < maxIterations) {
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
        localNonce = await getNonce(web3Instance);
        let txHash = await executeTransaction(wrap, gasPriceWei, localNonce, web3Instance.utils.fromWei(amountToWrap, 'ether'));
        if (!txHash) break;
        localNonce++;
        let txLink = `https://taikoscan.io/tx/${txHash}`;
        console.log(`Wrap Transaction sent: ${txLink}, \nAmount: ${web3Instance.utils.fromWei(amountToWrap, 'ether')} ETH`);

        // WETH to ETH (Unwrap)
        const wethBalance = await getWethBalance(web3Instance, wethContractAddress, walletAddress);
        if (wethBalance.isZero()) {
            console.log("No WETH balance to unwrap. Skipping unwrap transaction.");
            break;
        }
        localNonce = await getNonce(web3Instance);
        txHash = await executeTransaction(unwrap, gasPriceWei, localNonce, web3Instance.utils.fromWei(wethBalance, 'ether'));
        if (!txHash) break;
        localNonce++;
        txLink = `https://taikoscan.io/tx/${txHash}`;
        console.log(`Unwrap Transaction sent: ${txLink}, \nAmount: ${web3Instance.utils.fromWei(wethBalance, 'ether')} WETH`);

        iterationCount++;

        // Rastgele gecikme süresi
        const delay = getRandomDelay(maxIterations, totalDurationHours);
        console.log(`Waiting for ${delay / 1000 / 60} minutes before next iteration...`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    console.log(`Completed ${maxIterations} iterations. Exiting loop.`);
}

main().catch(console.error);
