require('dotenv').config();
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
const Sequelize = require('sequelize');
const nodemailer = require('nodemailer');
const sendinBlueTransport = require('nodemailer-sendinblue-transport');
const crypto = require('crypto');
const uuid = require('uuid');
const ForgotPasswordRequest = require('./ForgotPasswordRequest');
const { Op, DataTypes } = require('sequelize');
const AWS = require('aws-sdk');
const fs = require('fs');


// Initialize the transporter
const transporter = nodemailer.createTransport({
    service: 'SendinBlue',
    auth: {
        user: process.env.SENDINBLUE_USER, // replace with your SendinBlue email
        pass: process.env.SENDINBLUE_APIKEY // replace with your SendinBlue API Key
    },
  });
  
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'ap-south-1'
});

// Create an S3 instance
const s3 = new AWS.S3(); // Use 's3' as the variable name, not 'S3'


AWS.config.update({
    logging: true
});

const downloadDirectory = path.join(__dirname, 'downloads'); // Replace __dirname with the appropriate directory path

if (!fs.existsSync(downloadDirectory)) {
    fs.mkdirSync(downloadDirectory);
}

// Now you can proceed to write the file to the "downloads" directory


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

app.get('/check-premium-status', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId;  // Extracted from the token via the authenticateToken middleware
        const user = await User.findOne({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isPremium) {
            res.status(200).json({ isPremium: true, message: 'User has a premium membership.' });
        } else {
            res.status(401).json({ isPremium: false, message: 'User does not have a premium membership.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while checking premium status' });
    }
});

app.get('/leaderboard', async (req, res) => {
    try {
        const leaderboard = await User.findAll({
            attributes: ['name', 'totalExpenses'],
            order: [['totalExpenses', 'DESC']] // Order by total expenses descending
        });
        
        res.status(200).json(leaderboard);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
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

        // Increment the user's total expenses
        const user = await User.findByPk(userId);
        user.totalExpenses += parseFloat(amount); // make sure amount is a float
        await user.save();

        res.status(201).json(expense);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});


app.get('/fetch-expenses', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId; // User ID from the token
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 10;
        let offset = (page - 1) * limit;

        const expenses = await Expense.findAll({
            where: {
                userId: userId // Filter by authenticated user's ID
            },
            limit: limit,
            offset: offset
        });

        // Count only the authenticated user's expenses
        const totalExpenses = await Expense.count({
            where: {
                userId: userId
            }
        });
        const totalPages = Math.ceil(totalExpenses / limit);

        res.status(200).json({
            expenses,
            totalPages
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred' });
    }
});


app.delete('/delete-expense/:id', authenticateToken, async (req, res) => {
    const expenseId = req.params.id;
    const userId = req.userId; 

    try {
        const expense = await Expense.findOne({ where: { id: expenseId } });
        
        if (!expense) {
            return res.status(404).send({ message: 'Expense not found' });
        }

        if (expense.userId !== userId) {
            return res.status(403).send({ message: 'You do not have permission to delete this expense' });
        }

        // Decrement the user's total expenses before deleting the expense
        const user = await User.findByPk(userId);
        user.totalExpenses -= parseFloat(expense.amount); // ensure expense.amount is a float
        await user.save();

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

app.get('/fetch-filtered-expenses', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const expenses = await Expense.findAll({
            where: {
                createdAt: {
                    [Op.between]: [startDate, endDate],
                },
            },
        });
        res.status(200).json(expenses);
    } catch (error) {
        console.error('Error fetching filtered expenses:', error);
        res.status(500).json({ message: 'An error occurred while fetching expenses.' });
    }
});

app.get('/download-expenses', authenticateToken, async (req, res) => {
    try {
        const userId = req.userId; // Get user ID from the token
        const expenses = await Expense.findAll({ where: { userId } });

        // Generate a text file with the user's expenses
        let text = 'Expense Report\n\n';


        expenses.forEach((expense, index) => {

            text += `Expense ${index + 1}\n`;
            text += `Amount: ${expense.amount}\n`;
            text += `Description: ${expense.description}\n`;
            text += `Category: ${expense.category}\n`;
            text += '----------------\n';
        });


        // Generate a unique file name (you can use the user's ID or a timestamp)
        const fileName = `expenses_${userId}_${Date.now()}.txt`;

        // Create and write the text to a local file
        const filePath = path.join(__dirname, 'downloads', fileName);
        fs.writeFileSync(filePath, text);


        // Configure AWS S3 parameters for uploading the file (without ACL)
        const params = {
            Bucket: 'expense-tracker-downloads',
            Key: fileName,
            Body: fs.createReadStream(filePath),
        };


        // Upload the file to AWS S3
        const uploadResponse = await s3.upload(params).promise();


        // Generate a public download URL
        const downloadUrl = uploadResponse.Location;

        // Delete the local file
        fs.unlinkSync(filePath);

        // Send the download URL as a response to the client
        res.json({ downloadUrl, message: 'Expenses downloaded successfully' });
    } catch (error) {
        console.error('Error downloading expenses:', error);
        res.status(500).json({ message: 'An error occurred while downloading expenses.' });
    }
});




app.post('/forgotpassword', async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: 'User with this email does not exist' });
        }

        const passwordRequest = await ForgotPasswordRequest.create({
            userId: user.id,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Email the reset link to the user
        const mailOptions = {
            from: 'admin@expensetracker.com', 
            to: email,
            subject: 'Password Reset Link',
            text: `You requested for a password reset. Click on this link to reset your password: http://localhost:3000/resetpassword?id=${passwordRequest.id}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ message: 'Error sending reset email' });
            }
            res.status(200).json({ message: 'Password reset link sent to email' });
        });
    } catch (error) {
        console.error('Error in forgot password:', error);
        res.status(500).json({ message: 'An error occurred' });
    }
});

app.get('/resetpassword', async (req, res) => {
    const requestId = req.query.id; // Assuming the UUID is passed as a query parameter

    if (!requestId) {
        return res.status(400).send('Invalid reset link');
    }

    try {
        const request = await ForgotPasswordRequest.findOne({ where: { id: requestId } });

        if (!request || !request.isActive) {
            return res.status(400).send('Invalid or expired reset link');
        }

        // Render the reset password form with requestId as a hidden input
        res.sendFile(__dirname + '/public/resetPassword.html');
    } catch (error) {
        console.error('Error in resetpassword route:', error);
        res.status(500).send('An error occurred');
    }
});

app.post('/updatepassword', async (req, res) => {
    const { requestId, newPassword } = req.body;

    if (!requestId || !newPassword) {
        return res.status(400).send('Missing required parameters');
    }

    try {
        const request = await ForgotPasswordRequest.findOne({ where: { id: requestId } });

        if (!request || !request.isActive) {
            return res.status(400).send('Invalid or expired reset link');
        }

        // Hash the new password and update the user's password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.update({ password: hashedPassword }, { where: { id: request.userId } });

        // Deactivate the reset password request
        request.isActive = false;
        await request.save();

        res.send('Password updated successfully');
    } catch (error) {
        console.error('Error in updatepassword route:', error);
        res.status(500).send('An error occurred');
    }
});


app.listen(3000, () => {
    console.log('Server is running on port 3000');
});
