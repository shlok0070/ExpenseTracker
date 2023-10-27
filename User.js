const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('./database');
const ForgotPasswordRequest = require('./ForgotPasswordRequest');  // Assuming the models are in the same directory

const User = sequelize.define('user', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true  // This ensures the email will be unique
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    isPremium: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    totalExpenses: {
        type: DataTypes.FLOAT,
        allowNull: true,
        defaultValue: 0.0
    },
    
}, {
    tableName: 'users'
});

module.exports = User;

User.hasMany(ForgotPasswordRequest, { foreignKey: 'userId' });
ForgotPasswordRequest.belongsTo(User, { foreignKey: 'userId' });