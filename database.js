require('dotenv').config();

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.SCHEMA_NAME, process.env.SQL_USERNAME, process.env.SQL_PASSWORD, {
    host: 'localhost',
    dialect: 'mysql'
});

module.exports = sequelize;
