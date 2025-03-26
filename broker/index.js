const aedes = require('aedes')();
const net = require('net');

const port = process.env.PORT || 1885;

// Create TCP Server for Aedes MQTT
const server = net.createServer(aedes.handle);
server.maxConnections = 1000; // Increase max simultaneous connections

server.listen(port, '0.0.0.0', () => {
  console.log(`🚀 MQTT Broker running on port: ${port}`);
});

// ✅ Improved Asynchronous Authentication
aedes.authenticate = (client, username, password, callback) => {
  if (!password) return callback(null, false);

  setImmediate(() => {
    const decodedPassword = Buffer.from(password, 'base64').toString('utf8');
    callback(null, username === 'admin' && decodedPassword === '123');
  });
};

// ✅ Optimized Authorization for Publishing
const allowedTopics = new Set([
  'sensors/data',
  'handshake/syn',
  'handshake/syn-ack',
  'handshake/ack',
  'encrypt/dhexchange',
  'handshake/ecdh',
  'handshake-send/ecdh'
]);

aedes.authorizePublish = (client, packet, callback) => {
  setImmediate(() => {
    if (allowedTopics.has(packet.topic)) {
      return callback(null);
    }
    console.log(`❌ Unauthorized publish attempt to topic: ${packet.topic}`);
    callback(new Error('Unauthorized topic'));
  });
};

// ✅ Asynchronous Event Handling to Prevent Blocking
aedes.on('client', (client) => {
  setImmediate(() => {
    console.log(`✅ [CLIENT_CONNECTED] ${client.id}`);
  });
});

aedes.on('clientDisconnect', (client) => {
  setImmediate(() => {
    console.log(`❌ [CLIENT_DISCONNECTED] ${client.id}`);
  });
});

aedes.on('subscribe', (subscriptions, client) => {
  setImmediate(() => {
    console.log(`📩 [TOPIC_SUBSCRIBED] ${client.id} → ${subscriptions.map(s => s.topic).join(', ')}`);
  });
});

aedes.on('publish', (packet, client) => {
  setImmediate(() => {
    // console.log(`📡 [MESSAGE_PUBLISHED] ${client ? client.id : 'BROKER'} → ${packet.topic}`);
  });
});
