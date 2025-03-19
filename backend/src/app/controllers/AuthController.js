const { db, FieldValue } = require('../../config/firebase');
const { setDoc, doc } = require('firebase/firestore');
const { admin, auth } = require('../../config/firebase'); 

const { loginUser,
    logout,
    signUpUser
} = require('../services/AuthService');

class AuthController {
    loginController = async (req, res) => {
        const { token } = req.body;
    
        try {
            if (!token) {
                return res.status(400).json({ message: 'Token not provided' });
            }
    
            // Call the loginUser function to verify token and get user info
            const user = await loginUser(token);
    
            // Store the user UID in Firestore
            const userRef = db.collection('users').doc(user.uid);
            await userRef.set({
                email: user.email,
                //displayName: user.displayName,
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
    
            res.status(200).json(user);
        } catch (error) {
            console.error('Error during login:', error); // Detailed logging
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    };
    

    logOut = async (req, res) => {
        const { token } = req.body;
        try {
            
            // await logout(token);
            res.status(200).json("Logged out");
        } catch (error) {
            console.error("Logout failed: ", error.message);
            res.status(500).json({ message: error.message });
        }
    }

    signUp = async(req, res) => {
        try{
            const {email, password} = req.body
            const response = await signUpUser(email, password)
            return res.status(201).json({message: `Create user successfully: ${response.user}`})
        }
        catch (error){
            console.error("Sign up failed: ", error.message);
            res.status(500).json({ message: error.message });
        }
    }
}

module.exports = new AuthController();