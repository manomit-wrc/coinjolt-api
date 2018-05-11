const jwt = require('jsonwebtoken');
const keys = require('../config/keys');
const bCrypt = require('bcrypt-nodejs');
const dateFormat = require('dateformat');

module.exports = (app, passport, User) => {
    app.post('/api/user/login', (req, res) => {
        const email = req.body.email;
        const password = req.body.password;

        User.findOne({
            where: {
                email
            }
        }).then(user => {
            if(!user) {
                return res.status(404).json({ success: false, message: 'User not found' });   
            }

            if(bCrypt.compareSync(password, user.password)) {
                const payload = { id: user.id, email: user.email };
                jwt.sign(
                    payload,
                    keys.secretOrKey,
                    { expiresIn: 3600 },
                    (err, token) => {
                      res.json({
                        success: true,
                        token: 'Bearer ' + token
                      });
                    }
                );
            }
            else {
                return res.status(404).json({ success: false, message: 'Password incorrect' });
            }
        }).catch(err => {
            console.log(err);
            return res.status(500).json({ success: false, message: 'Please try again'});
        });
    });

    app.post('/api/user/profile', passport.authenticate('jwt', { session: false }), (req, res) => {
        User.findById(req.user.id, {
            attributes: { exclude: ['password', 'activation_key'] }
        }).then(user => {
                //user.dob = dateFormat(user.dob, "dd-mm-yyyy");
                res.json({
                    success: true,
                    user: user
                });
            }).catch(err => {
                return res.status(500).json({ success: false, message: 'Please try again'});
            });
    });
};
