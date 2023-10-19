const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('expense', 'root', 'nodecomplete1', {
    host: 'localhost',
    dialect: 'mysql'
});

module.exports = sequelize;
