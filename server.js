const express = require('express');
const User = require('./User');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const app = express();
const Expense = require('./Expense');
const { verifyToken } = require('./tokenUtility');
const { generateToken } = require('./tokenUtility');
const rzp = require('./paymentService');

// Serve static files from the "public" directory
app.use(express.static('public'));

app.use(bodyParser.json());  // for parsing application/json
app.use('/signup', express.static(path.join(__dirname, 'public')));

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).send('Access Denied');

    const decoded = verifyToken(token);
    if (!decoded) return res.status(403).send('Invalid Token');

    req.userId = decoded.userId;
    next();
}

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

app.get('/purchase/premiummembership', authenticateToken, async (req, res) => {
    try {
        const options = {
            amount: 10000,  
            currency: "INR", 
            receipt: "receipt_order_74394",  
            payment_capture: '0'
        };

        const order = await rzp.orders.create(options);
        res.json({ key_id: rzp.key_id, order: order });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error creating order" });
    }
});

app.post('/purchase/updatetransactionstatus', authenticateToken, async (req, res) => {
    try {
        const { payment_id } = req.body;
        const userId = req.userId;  // Get user ID from the token

        // Capture the payment using Razorpay's API. Provide the payment_id and the same amount.
        await rzp.payments.capture(payment_id, 10000);  // 10000 is the same amount as used while creating the order.
                
        // Update the user's isPremium status in the database
        await User.update({ isPremium: true }, { where: { id: userId } });

        res.json({ message: "Payment successful, you are a Premium user now!", success: true });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error capturing payment", success: false });
    }
});




app.get('/addExpense', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'addExpense.html')); 
});

app.post('/submit-expense', authenticateToken, async (req, res) => {
    const { amount, description, category } = req.body;
    const userId = req.userId;
    try {
        const expense = await Expense.create({
            amount,
            description,
            category,
            userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        res.status(201).json(expense);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.get('/fetch-expenses', async (req, res) => {
    try {
        const expenses = await Expense.findAll();
        res.status(200).json(expenses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.delete('/delete-expense/:id', authenticateToken, async (req, res) => {
    const expenseId = req.params.id;
    const userId = req.userId; // Extracted from the token via the authenticateToken middleware

    try {
        // Fetch the expense based on the provided ID
        const expense = await Expense.findOne({ where: { id: expenseId } });

        // Check if the expense exists
        if (!expense) {
            return res.status(404).send({ message: 'Expense not found' });
        }

        // Check if the logged-in user is the creator of the expense
        if (expense.userId !== userId) {
            return res.status(403).send({ message: 'You do not have permission to delete this expense' });
        }

        // Delete the expense
        await expense.destroy();
        res.status(200).send({ message: 'Expense deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'An error occurred' });
    }
});



app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const user = await User.findOne({ where: { email } });
        
        if (!user) {
            return res.status(404).json({ message: 'Email does not exist' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Wrong password' });
        }
        const token = generateToken(user.id); 
        res.status(200).json({token, message: 'User logged in successfully' });



    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
