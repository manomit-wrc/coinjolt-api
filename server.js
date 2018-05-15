const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
var models = require("./models");
var AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
var exphbs  = require('express-handlebars');

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

var hbs = exphbs.create({
extname: '.hbs', //we will be creating this layout shortly
helpers: {
    if_eq: function (a, b, opts) {
      if (a == b) // Or === depending on your needs
        return opts.fn(this);
      else
        return opts.inverse(this);
    },
    if_neq: function (a, b, opts) {
      if (a != b) // Or === depending on your needs
        return opts.fn(this);
      else
        return opts.inverse(this);
    },
    inArray: function(array, value, block) {
      if (array.indexOf(value) !== -1) {
        return block.fn(this);
        }
        else {
          return block.inverse(this);
        }
    },

    for: function(from, to, incr, block) {
        var accum = 0;
        for(var i = from; i < to; i += incr)
            accum += block.fn(i);
        return accum;
    },
    total_price: function(v1, v2) {
      return v1 * v2;
    },
    ternary: (exp, ...a) => {
      return eval(exp);
    },
    eq: function (v1, v2) {
        return v1 == v2;
    },
    ne: function (v1, v2) {
        return v1 !== v2;
    },
    lt: function (v1, v2) {
        return v1 < v2;
    },
    gt: function (v1, v2) {
        return v1 > v2;
    },
    lte: function (v1, v2) {
        return v1 <= v2;
    },
    gte: function (v1, v2) {
        return v1 >= v2;
    },
    and: function (v1, v2) {
        return v1 && v2;
    },
    or: function (v1, v2) {
        return v1 || v2;
    },
    dateFormat: require('handlebars-dateformat'),
    inc: function(value, options) {
      return parseInt(value) + 1;
    },
    perc: function(value, total, options) {
        return Math.round((parseInt(value) / parseInt(total) * 100) * 100) / 100;
    },
    img_src: function(value, options) {
      if (fs.existsSync("public/events/"+value) && value != "") {
        return "/events/"+value;
      }
      else {
        return "/admin/assets/img/pattern-cover.png";
      }
    },

    events: function() {
      return Event.find({}, { event_name: 1 }).map(function (event) {
        return event
      });
    },
    profile_src: function(value, options) {
      if (fs.existsSync("public/profile/"+value) && value != "") {
        return "/profile/"+value;
      }
      else {
        return "/admin/assets/img/pattern-cover.png";
      }
    },
    product_img: function(value, options) {
      if (fs.existsSync("public/product/"+value) && value != "") {
        return "/product/"+value;
      }
      else {
        return "/admin/assets/img/pattern-cover.png";
      }
    },
    formatCurrency: function(value) {
      return value.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,");
    },
    twoDecimalPoint: function(value){
        return parseFloat(Math.round(value * 100) / 100).toFixed(2);  
    },
    fiveDecimalPoint: function(value){
      return parseFloat(Math.round(value * 100) / 100).toFixed(5);
    },
    nFormatter: function (num, digits) {
      var si = [{
          value: 1,
          symbol: ""
        },
        {
          value: 1E3,
          symbol: "k"
        },
        {
          value: 1E6,
          symbol: "M"
        },
        {
          value: 1E9,
          symbol: "B"
        },
        {
          value: 1E12,
          symbol: "T"
        },
        {
          value: 1E15,
          symbol: "P"
        },
        {
          value: 1E18,
          symbol: "E"
        }
      ];
      var rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
      var i;
      for (i = si.length - 1; i > 0; i--) {
        if (num >= si[i].value) {
          break;
        }
      }
      return (num / si[i].value).toFixed(digits).replace(rx, "$1") + si[i].symbol;
    },
    toLowerCase: function(value){
      return value.toLowerCase();
    },
    toUpperCase: function(value){
      return value.toUpperCase();
    },
    checkCurrencies: function(value, arr) {
      var tempArr = lodash.filter(arr, x => x.Currency.alt_name === value);
      return tempArr.length > 0 ? tempArr[0].balance : '';
    },
    checkAnswer: function(value, arr) {
      var tempArr = lodash.filter(arr, x => x.option_id === value);
      return tempArr.length > 0 ? true : false;
    }
  }
});


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(passport.initialize());

require('./config/passport')(passport, models.User);

require('./routes/user')(app, passport, models.User, models.Currency, models.Deposit, models.currency_balance, AWS);

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));