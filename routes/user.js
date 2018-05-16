const jwt = require('jsonwebtoken');
const keys = require('../config/keys');
const bCrypt = require('bcrypt-nodejs');
const dateFormat = require('dateformat');
const Op = require('sequelize').Op;
const https = require('https');
var request = require('sync-request');
const lodash = require('lodash');

module.exports = (app, passport, User, Currency, Deposit, currency_balance, AWS) => {
    app.post('/api/user/login', (req, res) => {
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

            if(bCrypt.compareSync(password, user.password)) {
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
            }
            else {
                return res.status(404).json({ code: "404", message: 'Password incorrect' });
            }
        }).catch(err => {
            console.log(err);
            return res.status(500).json({ code: "404", message: 'Please try again'});
        });
    });

    app.post('/api/user/forgot-password', (req, res) => {
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

    app.post('/api/user/check-otp', (req, res) => {
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

    app.post('/api/user/forgot-password-reset', (req, res) => {
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

    app.post('/api/user/register', (req, res) => {
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
    app.post('/api/user/profile', passport.authenticate('jwt', { session: false }), (req, res) => {
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
    app.post('/api/user/change-password', passport.authenticate('jwt', { session: false }), (req,res) => {
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
    app.post('/api/user/most-recent-activity', passport.authenticate('jwt', { session: false }), async (req,res) => {
        var values = '';
        var buy_history = '';

        Deposit.belongsTo(Currency,{foreignKey: 'currency_id'});
        let currencyCodes = await Deposit.findAll(
        { 
            attributes: { exclude: ['credit_card_no','card_expmonth','card_expyear','cvv'] },
            where: {
                user_id: req.user.id,
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

        if(currencyCodes.length > 0){
            res.json({
                code: "200",
                message: currencyCodes
            });
        }else{
            res.json({
                code: "404",
                message: 'No records found.'
            });
        }        
    });

    //coinwise balance
    app.post('/api/user/coinwise-balance', passport.authenticate('jwt',{session: false}), async (req,res) => {
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
            var response =request('GET','https://coincap.io/page/'+currencyBalance[i].Currency.currency_id);
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

};
