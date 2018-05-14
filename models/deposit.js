'use strict';
module.exports = function(sequelize, DataTypes) {
  var Deposit = sequelize.define('Deposit', {
    user_id: DataTypes.INTEGER,
    transaction_id: DataTypes.STRING,
    checkout_id: DataTypes.STRING,
    account_id: DataTypes.STRING,
    type: DataTypes.INTEGER,
    description: DataTypes.TEXT,
    amount: DataTypes.STRING,
    gross: DataTypes.STRING,
    processing_fee: DataTypes.STRING,
    payer_email: DataTypes.STRING,
    payer_name: DataTypes.STRING,
    current_rate: DataTypes.STRING,
    converted_amount: DataTypes.STRING,
    balance: DataTypes.STRING,
    payment_method: DataTypes.STRING,
    credit_card_no: DataTypes.INTEGER,
    card_expmonth: DataTypes.INTEGER,
    card_expyear: DataTypes.STRING,
    cvv: DataTypes.INTEGER,
    currency_id: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
      }
    }
  });
  return Deposit;

};

