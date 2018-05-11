const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
var models = require("./models");

const app = express();

var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};
app.use(allowCrossDomain);


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(passport.initialize());

require('./config/passport')(passport, models.User);

require('./routes/user')(app, passport, models.User);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));