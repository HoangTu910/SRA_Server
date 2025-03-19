const { getAuth, signInWithEmailAndPassword } = require('@firebase/auth');
const { admin, auth } = require('../../config/firebase'); 

const sendEmail = async (email, subject, content) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        html: content
    };

    return transporter.sendMail(mailOptions);
};

const signUpUser = async (email, password) => {
    return await auth.createUser({
      email,
      password,
    });
  };

// const signUpUser = async(email, password) => {
//     try{
//         const user = await createUserWithEmailAndPassword(admin.auth(), email, password);
//         return {user}
//     }
//     catch (error){
//         throw new Error(error.message)
//     }
// }

const loginUser = async (idToken) => {
    try {
        // Verify the ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const userRecord = await admin.auth().getUser(decodedToken.uid);
        const uid = decodedToken.uid;

        // Log UID for debugging
        console.log('User authenticated, UID:', uid);
        return {
            uid: userRecord.uid,
            email: userRecord.email,
            displayName: userRecord.displayName,
        };
    } catch (error) {
        console.error('Error verifying ID token:', error.message);
        throw new Error('Error verifying ID token: ' + error.message);
    }
};


const logout = async (uid) => {
    try {
        // await auth.revokeRefreshTokens(uid);
    console.log('User logged out successfully.');
    } catch (error) {
        console.error('Error logout ID token:', error.message);
        throw new Error('Error logout ID token: ' + error.message);
    }
    
};

module.exports = {signUpUser, loginUser};