const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('./database');
const { v4: uuidv4 } = require('uuid');  // Importing the UUID library to generate UUIDs

const ForgotPasswordRequest = sequelize.define('forgotPasswordRequest', {
    id: {
        type: DataTypes.UUID,     // UUID type for the id
        defaultValue: () => uuidv4(),  // Default value uses the UUID library to generate a UUID
        allowNull: false,
        primaryKey: true
    },
    userId: {
        type: DataTypes.INTEGER,  // Assuming the User's id is of type INTEGER
        allowNull: false,
        references: {
            model: 'users',   // 'users' refers to the name of the User table in the database
            key: 'id'
        }
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    tableName: 'forgotPasswordRequests',
    timestamps: false
});

module.exports = ForgotPasswordRequest;
