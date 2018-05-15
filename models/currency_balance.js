'use strict';
module.exports = (sequelize, DataTypes) => {
  var currency_balance = sequelize.define('currency_balance', {
    user_id: DataTypes.INTEGER,
    currency_id: DataTypes.INTEGER,
    balance: DataTypes.STRING
  }, {});
  currency_balance.associate = function(models) {
    // associations can be defined here
  };
  return currency_balance;
};