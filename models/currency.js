'use strict';
module.exports = (sequelize, DataTypes) => {
  var Currency = sequelize.define('Currency', {
    alt_name: DataTypes.STRING,
    display_name: DataTypes.STRING,
    currency_id: DataTypes.STRING
  }, {});
  Currency.associate = function(models) {
    // associations can be defined here
  };
  return Currency;
};