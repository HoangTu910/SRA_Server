const aedes = require('aedes')();
const server = require('net').createServer(aedes.handle);
const port = process.env.PORT || 1885;

const startEvents = () => {
  try {
    server.listen(port, '0.0.0.0', function () {
      console.log(`MQTT Broker running on port: ${port}`);
    });

    // authenticate the connecting client
    aedes.authenticate = (client, username, password, callback) => {
      //password = undefined
      if (!password) {
        return callback(null, false);
      }
      const decodedPassword = Buffer.from(password, 'base64').toString('utf8');
      // console.log(`Decoded Password: ${decodedPassword}`);
      if (username === 'admin' && decodedPassword === '123') {
        return callback(null, true);
      }
      const error = new Error(
        'Authentication Failed!! Invalid user credentials.'
      );
      console.log('Error ! Authentication failed.');
      return callback(error, false);
    };

    const topics = ['sensors/data', 'handshake/syn', 'handshake/syn-ack', 'handshake/ack', 'encrypt/dhexchange', 'handshake/ecdh', 'handshake-send/ecdh'];
    // authorizing client to publish on a message topic
    aedes.authorizePublish = (client, packet, callback) => {
      // check topics
      if (topics.find((topic) => packet.topic.includes(topic))) {
        return callback(null);
      }
      console.log('Error! Unauthorized publish to topic:', packet.topic);
      return callback(
        new Error('You are not authorized to publish on this message topic.')
      );
    };  
    
    // emitted when a client connects to the broker
    aedes.on('client', function (client) {
      console.log(
        `[CLIENT_CONNECTED] Client ${
          client ? client.id : client
        } connected to broker ${aedes.id}`
      );
    });

    // emitted when a client disconnects from the broker
    // aedes.on("clientDisconnect", function (client) {
    //   console.log(
    //     `[CLIENT_DISCONNECTED] Client ${
    //       client ? client.id : client
    //     } disconnected from the broker ${aedes.id}`
    //   );
    // });

    // emitted when a client subscribes to a message topic
    aedes.on('subscribe', function (subscriptions, client) {
      // console.log(
      //   `[TOPIC_SUBSCRIBED] Client ${
      //     client ? client.id : client
      //   } subscribed to topics: ${subscriptions
      //     .map((s) => s.topic)
      //     .join(",")} on broker ${aedes.id}`
      // );
    });

    // emitted when a client unsubscribes from a message topic
    // aedes.on("unsubscribe", function (subscriptions, client) {
    //   console.log(
    //     `[TOPIC_UNSUBSCRIBED] Client ${
    //       client ? client.id : client
    //     } unsubscribed to topics: ${subscriptions.join(",")} from broker ${
    //       aedes.id
    //     }`
    //   );
    // });

    // emitted when a client publishes a message packet on the topic
    // aedes.on("publish", async function (packet, client) {
    //   if (client) {
    //     console.log(
    //       `[MESSAGE_PUBLISHED] Client ${
    //         client ? client.id : "BROKER_" + aedes.id
    //       } has published message on ${packet.topic} to broker ${aedes.id}`
    //     );
    //   }
    // });
  } catch (error) {
    console.log(error);
    startEvents();
  }
};
startEvents();