module.exports = function (app) {

    const controller = require('./controller.js');

    app.get('/health', controller.checkHealth);

    app.post('/create_account', controller.createAccount);

    app.post('/add_cafe', controller.addCafe);

    app.put('/emission_cafe', controller.emissionCafe);

    app.delete('/remove_cafe', controller.removeCafe);

    app.post('/add_waiter', controller.addWaiter);

    app.delete('/delete_Waiter', controller.deleteWaiter);

    app.post('/add_bonus', controller.addBonus);

    app.post('/spent_bonus', controller.spentBonus);

    app.get('/cafe', controller.getCafe);

    app.get('/account_balance', controller.getAccountBalance);
}