const jwt = require('jsonwebtoken');
require('dotenv').config();
const SECRET_KEY = process.env.SECRET_KEY;  // Choose a secret key

function generateToken(userId) {
    return jwt.sign({ userId }, SECRET_KEY, { expiresIn: '1h' });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch {
        return null;
    }
}

module.exports = {
    generateToken,
    verifyToken
};
