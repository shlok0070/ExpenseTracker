const express = require('express');
const User = require('./User');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

app.use(bodyParser.json());  // for parsing application/json
app.use('/signup', express.static(path.join(__dirname, 'public')));

app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    
    try {
        const user = await User.create({
            name,
            email,
            password,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        res.status(201).json(user);  // Respond with JSON
    } catch (error) {
        console.error(error);  // Log the error to the console
        if (error.name === 'SequelizeUniqueConstraintError') {
            res.status(400).json({ message: 'Email is already in use' });  // Respond with JSON
        } else {
            res.status(500).json({ message: 'An error occurred' });  // Respond with JSON
        }
    }
});


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
