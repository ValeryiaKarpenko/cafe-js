const { mnemonicGenerate, mnemonicValidate } = require('@polkadot/util-crypto');
const { Keyring } = require('@polkadot/keyring');
const { ApiPromise, WsProvider } = require('@polkadot/api');

const provider = new WsProvider('ws://127.0.0.1:9944');
let api = new ApiPromise({
    provider,
    types: {
        Cafe: {
            owner: 'AccountId',
            waiters: 'Vec<AccountId>'
        }
    }
});

const nonceMap = new Map();
let keyring = null;
let alice = null;
let aliceNonce = 0;

(async () => {
    await api.isReady;
    keyring = new Keyring({ type: 'sr25519' });
    alice = keyring.addFromUri('//Alice');
    aliceNonce = await api.query.system.accountNonce(alice.address);
})();

let firstTime = true;
const getNonce = () => {
    let nonce = String(aliceNonce);

    if (firstTime) {
        firstTime = false;
        console.log(" firstTime -", nonce);
        return nonce;
    }

    aliceNonce = ++aliceNonce;
    console.log(" secondTime -", aliceNonce);
    return aliceNonce;
};

const getNonceFromMap = async (mnemonic) => {
    let nonce = nonceMap.get(mnemonic);
    const accountNonce = keyring.addFromMnemonic(mnemonic);
    if (!nonce) {
        const getCurrentNonce = await api.query.system.accountNonce(accountNonce.address);
        if (nonceMap.get(mnemonic)) {
            nonce = nonceMap.get(mnemonic)
            nonceMap.set(mnemonic, ++nonce);
            return ++nonce;
        };
        nonceMap.set(mnemonic, getCurrentNonce);
        console.log(" firstTimeAccountNonce -", String(getCurrentNonce));
        return getCurrentNonce;
    }
    nonceMap.set(mnemonic, ++nonce);
    console.log(" secondTimeAccountNonce -", nonce);
    return nonce;
};

async function checkGas(mnemonic, res) {
    if (!mnemonicValidate(mnemonic)) {
        res.status(400).send("Invalid mnemonic");
        return false;
    }

    const keyPair = keyring.addFromMnemonic(mnemonic);
    let gas;
    try {
        gas = await api.query.balances.freeBalance(keyPair.address);
    } catch (error) {
        console.log('checkGas() Error: ', error)
    }
    if (gas < 1000) {
        await api.tx.balances
            .transfer(keyPair.address, 20000)
            .signAndSend(alice, { nonce: getNonce() });
    }
    return keyPair;
}

function checkJson(data, res) {
    for (let key in data) {
        if (data[key] === undefined) {
            res.status(400).send(`Required field ${key} is undefined`)
            return false;
        }
    }
    return true;
}

exports.getGas = async function (req, res) {
    const address = req.query.address;
    let gas = await api.query.balances.freeBalance(address);
    res.status(200).json(gas);
}

exports.checkHealth = function (req, res) {
    res.status(200).json('ok');
}

exports.addTokenForGas = async function (req, res) {
    const address = req.body.address;

    await api.tx.balances
        .transfer(address, 20000)
        .signAndSend(alice, { nonce: getNonce() });

    res.sendStatus(200);
};

exports.createAccount = async function (req, res) {
    const mnemonic = mnemonicGenerate();
    const keyPair = keyring.addFromMnemonic(mnemonic);
    mnemonicValidate(mnemonic);

    await api.tx.balances
        .transfer(keyPair.address, 20000)
        .signAndSend(alice, { nonce: getNonce() });

    res.status(200).json({ mnemonic: mnemonic, address: keyPair.address });
};

exports.addCafe = async function (req, res) {
    const cafeData = {
        mnemonic: req.body.mnemonic,
        cafeAccount: req.body.cafeAccount,
        waiters: req.body.waiters
    };

    if (!checkJson(cafeData, res)) {
        return;
    }

    const keyPair = await checkGas(cafeData.mnemonic, res);

    if (!keyPair) {
        return;
    }

    await api.tx.cafe
        .addCafe(cafeData.cafeAccount, cafeData.waiters)
        .signAndSend(keyPair, { nonce: await getNonceFromMap(cafeData.mnemonic) }, ({ events = [], status }) => {
            if (status.isFinalized) {
                res.status(200).json({operation_hash: status.asFinalized});
            }
    });
};

exports.emissionCafe = async function (req, res) {
    const cafeData = {
        mnemonic: req.body.mnemonic,
        cafeAccount: req.body.cafeAccount,
        value: req.body.value
    };

    if (!checkJson(cafeData, res)) {
        return;
    }

    const keyPair = await checkGas(cafeData.mnemonic, res);

    if (!keyPair) {
        return;
    }

    const cafe = await api.query.cafe.cafeOf(cafeData.cafeAccount);
    if (String(cafe.owner) !== String(keyPair.address)) {
        res.status(400).send("You are not an owner");
        return;
    }

    await api.tx.cafe
        .emissionCafe(cafeData.cafeAccount, cafeData.value)
        .signAndSend(keyPair, { nonce: await getNonceFromMap(cafeData.mnemonic) }, ({ events = [], status }) => {
            if (status.isFinalized) {
                res.status(200).json({operation_hash: status.asFinalized});
            }
    });
};

exports.removeCafe = async function (req, res) {
    const cafeData = {
        mnemonic: req.body.mnemonic,
        cafeAccount: req.body.cafeAccount
    };

    if (!checkJson(cafeData, res)) {
        return;
    }

    const keyPair = await checkGas(cafeData.mnemonic, res);

    if (!keyPair) {
        return;
    }

    const cafe = await api.query.cafe.cafeOf(cafeData.cafeAccount);
    if (String(cafe.owner) !== String(keyPair.address)) {
        res.status(400).send("You are not an owner");
        return;
    }

    await api.tx.cafe
        .removeCafe(cafeData.cafeAccount)
        .signAndSend(keyPair, { nonce: await getNonceFromMap(cafeData.mnemonic) }, ({ events = [], status }) => {
            if (status.isFinalized) {
                res.status(200).json({operation_hash: status.asFinalized});
            }
    });
};

exports.addWaiter = async function (req, res) {
    const cafeData = {
        mnemonic: req.body.mnemonic,
        cafeAccount: req.body.cafeAccount,
        waiter: req.body.waiter
    };

    if (!checkJson(cafeData, res)) {
        return;
    }

    const keyPair = await checkGas(cafeData.mnemonic, res);

    if (!keyPair) {
        return;
    }

    const cafe = await api.query.cafe.cafeOf(cafeData.cafeAccount);
    if (String(cafe.owner) !== String(keyPair.address)) {
        res.status(400).send("You are not an owner");
        return;
    }

    await api.tx.cafe
        .addWaiter(cafeData.cafeAccount, cafeData.waiter)
        .signAndSend(keyPair, { nonce: await getNonceFromMap(cafeData.mnemonic) }, ({ events = [], status }) => {
            if (status.isFinalized) {
                res.status(200).json({operation_hash: status.asFinalized});
            }
    });
};

exports.deleteWaiter = async function (req, res) {
    const cafeData = {
        mnemonic: req.body.mnemonic,
        cafeAccount: req.body.cafeAccount,
        waiter: req.body.waiter
    };

    if (!checkJson(cafeData, res)) {
        return;
    }

    const keyPair = await checkGas(cafeData.mnemonic, res);

    if (!keyPair) {
        return;
    }

    const cafe = await api.query.cafe.cafeOf(cafeData.cafeAccount);
    if (String(cafe.owner) !== String(keyPair.address)) {
        res.status(400).send("You are not an owner");
        return;
    }

    await api.tx.cafe
        .deleteWaiter(cafeData.cafeAccount, cafeData.waiter)
        .signAndSend(keyPair, { nonce: await getNonceFromMap(cafeData.mnemonic) }, ({ events = [], status }) => {
            if (status.isFinalized) {
                res.status(200).json({operation_hash: status.asFinalized});
            }
    });
};

exports.addBonus = async function (req, res) {
    const cafeData = {
        mnemonic: req.body.mnemonic,
        cafeAccount: req.body.cafeAccount,
        to: req.body.to,
        value: req.body.value
    };

    if (!checkJson(cafeData, res)) {
        return;
    }

    const keyPair = await checkGas(cafeData.mnemonic, res);

    if (!keyPair) {
        return;
    }

    const cafe = await api.query.cafe.cafeOf(cafeData.cafeAccount);
    for (var i = 0; i < cafe.waiters.length; i++) {
        if (cafe.waiters[i] == undefined) {
            res.status(400).send("You are not waiter");
            return;
        }
    }

    await api.tx.cafe
        .addBonus(cafeData.cafeAccount, cafeData.to, cafeData.value)
        .signAndSend(keyPair, { nonce: await getNonceFromMap(cafeData.mnemonic) }, ({ events = [], status }) => {
            if (status.isFinalized) {
                res.status(200).json({operation_hash: status.asFinalized});
            }
    });
};

exports.spentBonus = async function (req, res) {
    const cafeData = {
        mnemonic: req.body.mnemonic,
        to: req.body.to,
        value: req.body.value
    };

    if (!checkJson(cafeData, res)) {
        return;
    }

    const keyPair = await checkGas(cafeData.mnemonic, res);

    if (!keyPair) {
        return;
    }

    await api.tx.cafe
        .spentBonus(cafeData.to, cafeData.value)
        .signAndSend(keyPair, { nonce: await getNonceFromMap(cafeData.mnemonic) }, ({ events = [], status }) => {
            if (status.isFinalized) {
                res.status(200).json({operation_hash: status.asFinalized});
            }
    });
};

exports.getCafe = async function (req, res) {
    const address = req.query.address;

    if (!address) {
        res.status(400).send("Address is undefined");
        return;
    }

    const cafe = await api.query.cafe.cafeOf(address);

    const infoOfCafe = {
        owner: cafe.owner,
        waiters: cafe.waiters
    };
    res.status(200).json(infoOfCafe);

};

exports.getAccountBalance = async function (req, res) {
    const address = req.query.address;

    if (!address) {
        res.status(400).send("Address is undefined");
        return;
    }

    const userBalance = await api.query.cafe.accountOf(address);
    res.status(200).json({ "balance": userBalance })

};
