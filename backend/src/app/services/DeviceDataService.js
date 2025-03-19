const { firestore, database } = require('firebase-admin');
const { DeviceDataCollection } = require('./Collection');
const { UserCollection } = require('./Collection');
const { db, FieldValue } = require('../../config/firebase');
const { setDoc, doc } = require('firebase/firestore');


class DeviceDataService {
  async createDeviceData(data, deviceID) {
      try {
        console.log('Attempting to create heartrate data:', data);
        const docRef = DeviceDataCollection.doc(deviceID);
        await docRef.set({
          ...data,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
        console.log('Data created with ID:', docRef.id);
        return docRef.id;
      } catch (error) {
        console.log('Error creating data:', error);
        throw error;
      }
    };

  async deleteDeviceDataById(docId) {
    try {
      await firestore.collection('Heartrate').doc(docId).delete();
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  };

  async deleteHeartrateByCondition(condition){
    try {
      const batch = db.batch();
      const querySnapshot = await HeartrateCollection.where('someField', '==', condition).get();
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error('Error deleting documents:', error);
      throw error;
    }
  };

  async deleteAllDataDeviceDocuments() {
    try {
      const batchSize = 10;
      let querySnapshot = await DeviceDataCollection.limit(batchSize).get();
      
      while (!querySnapshot.empty) {
        const batch = db.batch();
        querySnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        querySnapshot = await DeviceDataCollection.limit(batchSize).get();
      }
    } catch (error) {
      console.error('Error deleting all documents:', error);
      throw error;
    }
  };

  async getDataFromDatabase(userId) {
    try {
      // Reference to the specific user document in the UserCollection
      const userDocRef = UserCollection.doc(userId); 
  
      // Fetch the user document
      const doc = await userDocRef.get();
  
      if (!doc.exists) {
        console.log('No such document!');
        return []; // or handle the case when no document is found
      } else {
        const data = doc.data();
        console.log('Data user retrieved successfully:', data);
        return [data]; // Wrap data in an array if expected format is an array
      }
    } catch (error) {
      console.error('Error retrieving data from Firestore:', error);
      throw error; // Rethrow error to be handled by the caller
    }
  }

  async createDeviceInFirestore(deviceId, deviceData) {
    try {
      console.log('Attempting to create data:', deviceData);
      const docRef = DeviceDataCollection.doc(deviceId); // Use deviceId as the document ID
      await docRef.set({
        ...deviceData, // Spread the deviceData object into the document
        createdAt: firestore.FieldValue.serverTimestamp(), // Add the createdAt field with a server timestamp
      });
      console.log('Data created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.log('Error creating data:', error);
      throw error;
    }
  };

  async uploadDeviceInUser(userId, deviceId) {
    try {
      console.log('Attempting to create data for user:', userId);
      const docRef = UserCollection.doc(userId); // Use deviceId as the document ID
      await docRef.set({
        deviceId: deviceId.toString(), // Add deviceId as a field in the document
        createdAt: firestore.FieldValue.serverTimestamp(), // Add createdAt field with a server timestamp
      }, { merge: true });
      console.log('Device data added to user document');
      return { userId, deviceId };
    } catch (error) {
      console.log('Error adding device data to user document:', error);
      throw error;
    }
  };

  async getDataSensorFromDatabase(deviceId) {
    try {
      // Reference to the specific device document
      const deviceDocRef = DeviceDataCollection.doc(deviceId);
  
      // Get the document data
      const doc = await deviceDocRef.get();
  
      if (!doc.exists) {
        throw new Error('No such document!');
      }
  
      // Extract the data from the document
      const data = doc.data();
  
      // Return specific field values if they exist
      const heart_rate = data.heart_rate;
      const spO2 = data.spO2;
      const temperature = data.temperature;
  
      console.log('Data Sensor retrieved successfully.');
      console.log('heart_rate: ', heart_rate);
      console.log('spO2: ', spO2);
      console.log('temperature: ', temperature);
      // Return an object with specific field values
      return {
        id: doc.id,
        heart_rate,
        spO2,
        temperature
      };
    } catch (error) {
      console.error('Error retrieving data from Firestore:', error);
      throw error; // Rethrow error to be handled by the caller
    }
  }

  async getRealTimeData(deviceId, callback) {
    try {
      const deviceDocRef = DeviceDataCollection.doc(deviceId);

      deviceDocRef.onSnapshot((doc) => {
        if (doc.exists) {
          callback(null, { id: doc.id, ...doc.data() });
        } else {
          callback('No such document!', null);
        }
      }, (error) => {
        callback(error, null);
      });
    } catch (error) {
      callback(error, null);
    }
  }
}
module.exports = new DeviceDataService()
