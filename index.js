require('dotenv').config();
const { getWeb3, walletAddress, switchRpc } = require('./config/web3');
const { wrap } = require('./src/module/wrap/wrap');
const { unwrap } = require('./src/module/wrap/unwrap');
const BN = require('bn.js');

function randomGasPrice(web3Instance) {
    const minGwei = new BN(web3Instance.utils.toWei('0.11', 'gwei'));
    const maxGwei = new BN(web3Instance.utils.toWei('0.15', 'gwei'));
    const randomGwei = minGwei.add(new BN(Math.floor(Math.random() * (maxGwei.sub(minGwei).toNumber()))));
    return randomGwei;
}

async function getNonce(web3Instance) {
    return await web3Instance.eth.getTransactionCount(walletAddress, 'pending');
}

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

function getRandomDelay(totalIterations, totalDurationHours) {
    const totalDurationMs = totalDurationHours * 60 * 60 * 1000;
    const averageDelayMs = totalDurationMs / totalIterations;
    const minDelayMs = averageDelayMs * 0.5;
    const maxDelayMs = averageDelayMs * 1.5;
    return Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;
}

async function main() {
    let web3Instance = getWeb3();
    const maxIterations = 50;
    const totalDurationHours = 5;
    let iterationCount = 0;

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
        const wethBalanceWei = await web3Instance.eth.getBalance(walletAddress); // Assume same wallet holds WETH
        localNonce = await getNonce(web3Instance);
        txHash = await executeTransaction(unwrap, gasPriceWei, localNonce, web3Instance.utils.fromWei(wethBalanceWei, 'ether'));
        if (!txHash) break;
        localNonce++;
        txLink = `https://taikoscan.io/tx/${txHash}`;
        console.log(`Unwrap Transaction sent: ${txLink}, \nAmount: ${web3Instance.utils.fromWei(wethBalanceWei, 'ether')} WETH`);

        iterationCount++;

        // Rastgele bekleme süresi (5 saat içinde)
        const delay = getRandomDelay(maxIterations, totalDurationHours);
        console.log(`Waiting for ${delay / 1000 / 60} minutes before next iteration...`);
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    console.log(`Completed ${maxIterations} iterations. Exiting loop.`);
}

main().catch(console.error);
