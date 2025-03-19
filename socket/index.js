// const { db } = require('./firebase');
// const http = require('http');
// const WebSocket = require('ws');
// // Define the function to get data from Firestore
// async function getDataSensorFromDatabase(deviceId) {
//   try {
//     const deviceDocRef = db.collection('devices').doc(deviceId);
//     const doc = await deviceDocRef.get();

//     if (!doc.exists) {
//       throw new Error('No such document!');
//     }

//     const data = doc.data();
//     const heart_rate = data.heart_rate;
//     const spO2 = data.spO2;
//     const temperature = data.temperature;

//     console.log('Data Sensor retrieved successfully.');
//     console.log('heart_rate: ', heart_rate);
//     console.log('spO2: ', spO2);
//     console.log('temperature: ', temperature);

//     return {
//       id: doc.id,
//       heart_rate,
//       spO2,
//       temperature
//     };
//   } catch (error) {
//     console.error('Error retrieving data from Firestore:', error);
//     throw error;
//   }
// }

// const server = http.createServer();
// const wss = new WebSocket.Server({ server });

// wss.on('connection', (ws) => {
//   console.log('Client connected');

//   let deviceId = null;

//   ws.on('message', async (message) => {
//     try {
//       const parsedMessage = JSON.parse(message);

//       if (parsedMessage.type === 'register') {
//         deviceId = parsedMessage.deviceId;
//         console.log('Device ID registered:', deviceId);

//         // Optionally send initial data
//         const data = await getDataSensorFromDatabase(deviceId);
//         ws.send(JSON.stringify(data));

//         // Real-time listener for Firestore updates
//         const deviceDocRef = db.collection('devices').doc(deviceId);

//         const unsubscribe = deviceDocRef.onSnapshot((doc) => {
//           if (doc.exists) {
//             const data = doc.data();
//             const { heart_rate, spO2, temperature } = data;
//             const payload = { heart_rate, spO2, temperature };
//             ws.send(JSON.stringify(payload));
//           } else {
//             console.log('No such document!');
//           }
//         });

//         ws.on('close', () => {
//           console.log('Client disconnected');
//           clearInterval(intervalId);
//         });

//       } else {
//         console.error('Unknown message type:', parsedMessage.type);
//       }
//     } catch (error) {
//       console.error('Error handling WebSocket message:', error);
//     }
//   });
// });

// server.listen(8989, () => {
//   console.log('WebSocket server is listening on ws://localhost:8989');
// });
const { db } = require('./firebase');
const http = require('http');
const WebSocket = require('ws');

// Define the function to get data from Firestore
async function getDataSensorFromDatabase(deviceId) {
  try {
    const deviceDocRef = db.collection('devices').doc(deviceId);
    const doc = await deviceDocRef.get();

    if (!doc.exists) {
      throw new Error('No such document!');
    }

    const data = doc.data();
    const heart_rate = data.heart_rate;
    const spO2 = data.spO2;
    const temperature = data.temperature;
    const isanomaly = data.isanomaly;

    console.log('Data Sensor retrieved successfully.');
    console.log('heart_rate: ', heart_rate);
    console.log('spO2: ', spO2);
    console.log('temperature: ', temperature);
    console.log('isanomaly: ', isanomaly);
    return {
      id: doc.id,
      heart_rate,
      spO2,
      temperature,
      isanomaly
    };
  } catch (error) {
    console.error('Error retrieving data from Firestore:', error);
    throw error;
  }
}

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');

  let deviceId = null;
  let unsubscribe = null;

  ws.on('message', async (message) => {
    try {
      const parsedMessage = JSON.parse(message);

      if (parsedMessage.type === 'register') {
        deviceId = parsedMessage.deviceId;
        console.log('Device ID registered:', deviceId);

        // Optionally send initial data
        const data = await getDataSensorFromDatabase(deviceId);
        ws.send(JSON.stringify(data));

        // Real-time listener for Firestore updates
        const deviceDocRef = db.collection('devices').doc(deviceId);

        unsubscribe = deviceDocRef.onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();
            const { heart_rate, spO2, temperature, acceleration, isanomaly } = data;
            const payload = { heart_rate, spO2, temperature, acceleration, isanomaly };
            ws.send(JSON.stringify(payload));
          } else {
            console.log('No such document!');
          }
        });

        ws.on('close', () => {
          console.log('Client disconnected');
          if (unsubscribe) {
            unsubscribe();
          }
        });

      } else {
        console.error('Unknown message type:', parsedMessage.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  });
});

server.listen(8989, () => {
  console.log('WebSocket server is listening on ws://localhost:8989');
});
