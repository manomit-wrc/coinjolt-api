const jwt = require('jsonwebtoken');
const keys = require('../config/keys');
const bCrypt = require('bcrypt-nodejs');
const dateFormat = require('dateformat');
const Op = require('sequelize').Op;

module.exports = (app, passport, User, Currency, Deposit, AWS) => {
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
        
        function notOnlyALogger(msg){
            console.log('****log****');
            console.log(msg);
        }

        Deposit.belongsTo(Currency,{foreignKey: 'currency_id'});
        let currencyCodes = await Deposit.findAll(
        { 
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

};
