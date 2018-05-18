const jwt = require('jsonwebtoken');
const keys = require('../config/keys');
const bCrypt = require('bcrypt-nodejs');
const dateFormat = require('dateformat');
const sequelize = require('sequelize');
const Op = require('sequelize').Op;
const https = require('https');
const request = require('sync-request');
const lodash = require('lodash');

module.exports = (app, passport, User, Currency, Deposit, currency_balance, AWS) => {

    app.post('/coinjolt-api/api/user/login', (req, res) => {
        const email = req.body.email;
        const password = req.body.password;

        User.findOne({
            where: {
                email
            }
        }).then(user => {
            if(!user) {
                return res.status(404).json({ code: "404", message: 'User not found' });   
            }
            if (bCrypt.compareSync(password, user.password)) {
                const payload = { id: user.id, email: user.email };
                jwt.sign(
                    payload,
                    keys.secretOrKey,
                    { expiresIn: 3600 }, (err, token) => {
                        res.json({
                            code: "200",
                            token: 'Bearer ' + token
                        });
                    }
                );
            }
            else {
                return res.status(404).json({ code: "404", message: 'Password incorrect' });
            }
        }).catch(err => {
            console.log(err);
            return res.status(500).json({ code: "404", message: 'Please try again'});
        });
    });

    app.post('/coinjolt-api/api/user/forgot-password', (req, res) => {
        const email = req.body.email;
        const random_number = Math.floor(100000 + Math.random() * 900000);
        console.log(email,random_number);
        User.findOne({
            where: {
                email
            }
        }).then(user => {
            if(!user) {
                return res.status(404).json({ code: "404", message: 'Email not found' });
            }
            else {
                User.update(
                    {otp: random_number},
                    {
                        where: {
                            email: email 
                        }
                    }
                ).then(rows => {
                    var ses = new AWS.SES({apiVersion: '2010-12-01'});
                    ses.sendEmail({
                        Source: keys.senderEmail, 
                        Destination: { ToAddresses: [email] },
                        Message: {
                            Subject: {
                                Data: "Forgot password"
                            },
                            Body: {
                                Text: {
                                    Data: random_number.toString()
                                }
                            }
                        }
                    }, function(err, data) {
                        console.log(err);
                        res.json({
                            code: "200",
                            message: 'An OTP has been sent to your email.'
                        });
                    });
                });
            }
        }).catch(err => {
            res.json({
                code: "404",
                message: 'Please try again'
            });
        });
    });

    app.post('/coinjolt-api/api/user/check-otp', (req, res) => {
        const email = req.body.email;
        const otp = req.body.otp;
        
        User.findOne({
            where: {
                email: email,
                otp: otp
            }
        }).then(user => {
            if(user) {
                res.json({
                    code: "200",
                    message: 'OTP verified successfully'
                });
            }
            else {
                res.json({
                    code: "404",
                    message: 'Incorrect OTP'
                });
            }
        });
    });

    app.post('/coinjolt-api/api/user/forgot-password-reset', (req, res) => {
        const email = req.body.email;
        User.update(
            {password: bCrypt.hashSync(req.body.password)},
            {
                where: {
                    email: email 
                }
            }
        ).then(user => {
            res.json({
                code: "200",
                message: 'Password updated successfully'
            });
        });
    });

    app.post('/coinjolt-api/api/user/register', (req, res) => {
        User.findOne({
            where: {
                email: req.body.email
            }
        }).then(user => {
            if(user) {
                res.json({
                    code: "404",
                    message: 'Email already exists'
                }); 
            }
            else {
                User.create({
                    first_name: req.body.first_name,
                    last_name: req.body.last_name,
                    email: req.body.email,
                    password: bCrypt.hashSync(req.body.password),
                    image: keys.S3_URL + 'profile/nobody.jpg',
                    identity_proof: 'javascript:void(0)',
                    type: 2
                }).then(user => {
                    const payload = { id: user.id, email: user.email };
                    jwt.sign(
                        payload,
                        keys.secretOrKey,
                        { expiresIn: 3600 },
                        (err, token) => {
                            res.json({
                                code: "200",
                                token: 'Bearer ' + token
                            });
                        }
                        );
                });
            }
        });
    });

    app.post('/coinjolt-api/api/user/profile', passport.authenticate('jwt', { session: false }), (req, res) => {
        User.findById(req.user.id, {
            attributes: { exclude: ['password', 'activation_key'] }
        }).then(user => {
            //user.dob = dateFormat(user.dob, "dd-mm-yyyy");
            res.json({
                code: "200",
                user: user
            });
        }).catch(err => {
            return res.status(500).json({ code: "404", message: 'Please try again'});
        });
    });

    //change password//
    app.post('/coinjolt-api/api/user/change-password', passport.authenticate('jwt', { session: false }), (req, res) => {
        if (bCrypt.compareSync(req.body.old_password, req.user.password)) {
            const password = bCrypt.hashSync(req.body.new_password);
            User.update({
                password: password
            }, {
                where: {
                    id: req.user.id
                }
            }).then(function (result) {
                res.json({
                    code: "200",
                    message: 'Password updated successfully.'
                });
            }).catch(function (err) {

                console.log(err);
            });
        } else {
            res.json({
                code: "404",
                message: 'Old password doesn\'t matched'
            });
        }
    });

    //most recent activity
    app.post('/coinjolt-api/api/user/most-recent-activity', passport.authenticate('jwt', { session: false }), async (req, res) => {
        var values = '';
        var buy_history = '';

        Deposit.belongsTo(Currency,{foreignKey: 'currency_id'});
        let currencyCodes = await Deposit.findAll(
        { 
            attributes: { exclude: ['credit_card_no','card_expmonth','card_expyear','cvv'] },
            where: {
                user_id: req.user.id,
                currency_id: req.body.currency_id,
                type: {
                    [Op.or]: [1, 2]
                }
            },
            limit: 5,
            order: [
                ['createdAt', 'DESC']
            ],
            //logging: notOnlyALogger,
            include: [{ 
                model: Currency, required: true
                
            }] 
        }); 
        values = await Currency.findAll({
            attributes: ['alt_name','currency_id']
        });

        for (var i = 0; i < currencyCodes.length; i++) {
            var type = currencyCodes[i].type;
            if (type == 1) {
                currencyCodes[i].type = 'Buy';
            } else if (type == 2) {
                currencyCodes[i].type = 'Sell';
            }
        }

        if (currencyCodes.length > 0) {
            res.json({
                code: "200",
                data: currencyCodes
            });
        } else {
            res.json({
                code: "404",
                message: 'No records found.'
            });
        }        
    });

    //coinwise balance
    app.post('/coinjolt-api/api/user/coinwise-balance', passport.authenticate('jwt',{session: false}), async (req, res) => {
        currency_balance.belongsTo(Currency,{foreignKey: 'currency_id'});
        var currencyBalance = await currency_balance.findAll({
            where:{
                user_id: req.user.id
            },
            include: [{
                model: Currency
            }]
        });
        var usdPrice = 0, balance = 0, coin_rate = 0;
        var currencyArr = [];
        var response_image = request('GET','https://www.cryptocompare.com/api/data/coinlist/');
        let data_for_image = JSON.parse(response_image.body);
        for (var i = 0; i < currencyBalance.length; i++) {
            balance = currencyBalance[i].balance;
            var response = request('GET','https://coincap.io/page/' + currencyBalance[i].Currency.currency_id);
            let data = JSON.parse(response.body);
            coin_rate = data.price_usd;
            usdPrice = (parseFloat(coin_rate) * parseFloat(balance)).toFixed(2);
            currencyBalance[i].Currency.usdPrice = usdPrice;

            //GET IMAGE LINK FROM API           
            var image_code = currencyBalance[i].Currency.currency_id;           
            var tempArr = lodash.filter(data_for_image.Data, (x) => x.Name === image_code);            
            //END

            currencyArr.push({
                usdPrice: usdPrice.toString(),
                balance: balance,
                id: currencyBalance[i].id,
                currency_id: currencyBalance[i].currency_id,
                user_id:  currencyBalance[i].user_id,
                display_name: currencyBalance[i].Currency.display_name,
                currency_short_name: currencyBalance[i].Currency.currency_id,
                image_url: tempArr.length > 0 ? 'https://www.cryptocompare.com'+tempArr[0].ImageUrl : ''
            });
        }
        res.json({
            code: "200",
            data: currencyArr
        });
    });

    //get all list of coins
    app.post('/coinjolt-api/api/user/all-coins', (req, res) => {
        Currency.findAll({
            attributes: [ 'id', 'currency_id', 'display_name' ]
        }).then(currency => {
            if(!currency) {
                return res.status(404).json({ code: "404", message: 'Currency not found' });   
            }
            res.json({
                code: "200",
                data: currency
            });
        }).catch(err => {
            console.log(err);
            return res.status(500).json({ code: "404", message: 'Please try again'});
        });
    });

    //get the current rate of a particular coin
    app.post('/coinjolt-api/api/user/cur-rate', async (req, res) => {
        const currency_id = req.body.currency_id;
        currency_details = await Currency.findAll({
            where: {
                id: currency_id
            }
        });
        currency_code = currency_details[0].alt_name;
        currency_code = currency_code.toUpperCase();
        var response = request('GET','https://coincap.io/page/' + currency_code);
        let data = JSON.parse(response.body);
        coin_rate = data.price_usd;
        res.json({
            code: "200",
            data: coin_rate
        });
    });

    //get the calculated quantity of a particular coin
    app.post('/coinjolt-api/api/user/calculate-qty', passport.authenticate('jwt',{session: false}), async (req, res) => {
        const usd_value = req.body.usd_value;
        const cur_rate = req.body.cur_rate;
        calculated_qty = parseFloat(usd_value) / parseFloat(cur_rate);
        var user_current_bal = await calUsdBalance(Deposit, req.user.id);
        if (usd_value == 0) {
            res.json({
                code: "402",
                message: "Amount should be atleast $1",
                success: false
            });
        }
        if (usd_value > 0) {
            if (parseFloat(usd_value) > parseFloat(user_current_bal)) {
                res.json({
                    code: "402",
                    message: "Amount exceeds current balance of $" + user_current_bal,
                    success: false
                });
            } else {
                res.json({
                    code: "200",
                    data: calculated_qty
                });
            }
        }
    });

    //buy a particular coin
    app.post('/coinjolt-api/api/user/buy-coin', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const usd_value = req.body.usd_value;
        const currency_id = req.body.currency_id;
        const cur_rate = req.body.cur_rate;
        const converted_amount = req.body.converted_amount;
        
        var digits = 9;
        var numfactor = Math.pow(10, parseInt(digits - 1));
        var random_num =  Math.floor(Math.random() * numfactor) + 1;

        var balance_count = await Deposit.count({
            where: {
                user_id: req.user.id,
                currency_id: currency_id
            }
        });
        if (balance_count > 0) {
            let currCrypto_bal = await Deposit.findAll({ 
                attributes: ['balance'],
                where: {
                    user_id: req.user.id,
                    currency_id: currency_id
                },
                limit: 1,
                order: [
                    ['createdAt', 'DESC']
                ]
            });
            var crypto_balance = currCrypto_bal[0].balance;
            var updated_balance = parseFloat(crypto_balance) + parseFloat(converted_amount);
        } else {
            var crypto_balance = 0;
            var updated_balance = 0;
        }

        Deposit.create({
            user_id: req.user.id,
            transaction_id: random_num,
            checkout_id: random_num,
            amount: usd_value,
            current_rate: cur_rate,
            converted_amount: converted_amount,
            type: 1,
            payment_method: 0,
            balance: updated_balance,
            currency_id: currency_id
        }).then(transaction => {
            currency_balance.findAndCountAll({
                where: {
                    user_id: req.user.id,
                    currency_id: currency_id
                }
            }).then(results => {
                var count = results.count;
                if (count > 0) {
                    currency_balance.update({
                        balance: updated_balance
                    }, {
                        where: {
                            user_id: req.user.id,
                            currency_id: currency_id
                        }
                    });
                } else {
                    currency_balance.create({
                        user_id: req.user.id,
                        balance: updated_balance,
                        currency_id: currency_id
                    });
                }
                res.json({
                    code: "200",
                    success: true
                });
            });
        }).catch(function (err) {
            console.log(err);
        });
    });

    //get the calculated amount of a particular coin
    app.post('/coinjolt-api/api/user/calculate-amt', passport.authenticate('jwt',{session: false}), async (req, res) => {
        const coin_value = req.body.coin_value;
        const currency_id = req.body.currency_id;
        const cur_rate = req.body.cur_rate;
        calculated_amt = parseFloat(cur_rate) * parseFloat(coin_value);
        if (coin_value == 0) {
            res.json({
                code: "402",
                message: "Currency amount should be more than 0",
                success: false
            });
        }
        if (coin_value > 0) {
            let cur_balance = await currency_balance.findAll({
                attributes: ['balance'],
                where: {
                    user_id: req.user.id,
                    currency_id: currency_id
                }
            });
            var crypto_balance = cur_balance[0].balance;
            if (parseFloat(coin_value) > parseFloat(crypto_balance)) {
                res.json({
                    code: "402",
                    message: "Amount exceeds currency balance",
                    success: false
                });
            } else {
                res.json({
                    code: "200",
                    data: calculated_amt
                });
            }
        }
    });

    //sell a particular coin
    app.post('/coinjolt-api/api/user/sell-coin', passport.authenticate('jwt', { session: false }), async (req, res) => {
        const currency_id = req.body.currency_id;
        const cur_rate = req.body.cur_rate;
        const coin_value = req.body.coin_value;
        const converted_amount = parseFloat(cur_rate * coin_value);

        var digits = 9;
        var numfactor = Math.pow(10, parseInt(digits - 1));
        var random_num =  Math.floor(Math.random() * numfactor) + 1;

        var balance_count = await Deposit.count({
            where: {
                user_id: req.user.id,
                currency_id: currency_id
            }
        });
        if (balance_count > 0) {
            let currCrypto_bal = await Deposit.findAll({ 
                attributes: ['balance'],
                where: {
                    user_id: req.user.id,
                    currency_id: currency_id
                },
                limit: 1,
                order: [
                    ['createdAt', 'DESC']
                ]
            });
            var crypto_balance = currCrypto_bal[0].balance;
            var updated_balance = parseFloat(crypto_balance) - parseFloat(coin_value);
        } else {
            var crypto_balance = 0;
            var updated_balance = 0;
        }

        Deposit.create({
            user_id: req.user.id,
            transaction_id: random_num,
            checkout_id: random_num,
            amount: converted_amount,
            current_rate: cur_rate,
            converted_amount: coin_value,
            type: 2,
            payment_method: 0,
            balance: updated_balance,
            currency_id: currency_id
        }).then(transaction => {
            currency_balance.findAndCountAll({
                where: {
                    user_id: req.user.id,
                    currency_id: currency_id
                }
            }).then(results => {
                var count = results.count;
                if (count > 0) {
                    currency_balance.update({
                        balance: updated_balance
                    }, {
                        where: {
                            user_id: req.user.id,
                            currency_id: currency_id
                        }
                    });
                } else {
                    currency_balance.create({
                        user_id: req.user.id,
                        balance: updated_balance,
                        currency_id: currency_id
                    });
                }
                res.json({
                    code: "200",
                    success: true
                });
            });
        }).catch(function (err) {
            console.log(err);
        });
    });

};

async function calUsdBalance(Deposit, id) {
    try {
        sold_amount = await Deposit.findAll({
            where: {user_id: id, type: 2},
            attributes: [[ sequelize.fn('SUM', sequelize.col('amount')), 'SELL_TOTAL_AMT']]
        });

        withdraw_amount = await Deposit.findAll({
            where: {user_id: id, type: 3},
            attributes: [[ sequelize.fn('SUM', sequelize.col('amount')), 'TOT_USD_AMT']]
        });

        transaction_amount = await Deposit.findAll({
            where: {user_id: id, type: 1},
            attributes: [[ sequelize.fn('SUM', sequelize.col('amount')), 'TOT_AMT']]
        });

        deposit_amount = await Deposit.findAll({
            where: {user_id: id, type: 0},
            attributes: [[ sequelize.fn('SUM', sequelize.col('amount')), 'TOT_DEP_AMT']]
        });

        var cal_currusd = sold_amount[0].get('SELL_TOTAL_AMT') - withdraw_amount[0].get('TOT_USD_AMT');
        var new_currusd = cal_currusd - transaction_amount[0].get('TOT_AMT');
        var curr_usd = new_currusd + deposit_amount[0].get('TOT_DEP_AMT');
        var final = parseFloat(Math.round(curr_usd * 100) / 100).toFixed(2);
        return final;
    } catch (err) {
        console.log('Opps, an error occurred', err);
    }
}
