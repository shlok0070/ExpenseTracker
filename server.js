const express = require('express');
const User = require('./User');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const app = express();

// Serve static files from the "public" directory
app.use(express.static('public'));

app.use(bodyParser.json());  // for parsing application/json
app.use('/signup', express.static(path.join(__dirname, 'public')));

app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);  // 10 is the number of salt rounds

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
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

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            return res.status(400).json({ message: 'Email does not exist' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Wrong password' });
        }
        
        res.status(200).json({ message: 'User logged in successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
