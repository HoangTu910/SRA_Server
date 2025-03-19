var admin = require("firebase-admin");

const {getFirestore} = require('firebase-admin/firestore')

var serviceAccount = require("./cloud-aiot-firebase-adminsdk-ajjtt-47f48918f2.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
  
});

const db = getFirestore();
const auth = admin.auth();

module.exports = {db, auth, admin};
