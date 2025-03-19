const mqtt = require('mqtt');
const { execFile } = require('child_process');
const path = require('path');
const DeviceDataService = require('./DeviceDataService');

const brokerUrl = 'mqtt://localhost:1885';
const topic = 'sensors/data';

const DATA_TOPIC = 'sensors/data';
const TOPIC_TO_RECEIVE_PUBLIC_FROM_CLIENT = 'encrypt/dhexchange';
const TOPIC_HANDSHAKE_ECDH = 'handshake/ecdh';
const TOPIC_HANDSHAKE_ECDH_SEND = 'handshake-send/ecdh';

let serverPublicKey = null;
let serverPrivateKey = null;
let serverSecretKey = null;
let serverReceivePublic = null;


const publicExecutablePath = path.resolve(__dirname, '../diffie-hellman/exec-ecdh-public.exe');

let client;

async function generatePublicPrivateKeys() {
    return new Promise((resolve, reject) => {
        execFile(publicExecutablePath, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing public/private key file: ${error.message}`);
                return reject(error);
            }

            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return reject(new Error(stderr));
            }

            const publicKeyMatch = stdout.match(/Public Key:\s([0-9a-f]+)/);
            const privateKeyMatch = stdout.match(/Private Key:\s([0-9a-f]+)/);

            if (publicKeyMatch && privateKeyMatch) {
                const publicKey = publicKeyMatch[1];
                const privateKey = privateKeyMatch[1];

                resolve({ publicKey, privateKey });
            } else {
                reject(new Error("Could not find public/private keys in the output."));
            }
        });
    });
}

async function generateSecretKey(myPrivateHex, anotherPublicHex) {
    return new Promise((resolve, reject) => {
    const secretExecutablePath = path.resolve(__dirname, '../diffie-hellman/exec-ecdh-secret.exe');
  
      const child = execFile(secretExecutablePath, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`Process error: ${error.message}`));
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }

        const output = stdout.trim();
        const secretKeyMatch = output.match(/[0-9a-fA-F]+/);
        if (secretKeyMatch) {
          const secretKey = secretKeyMatch[0];
          resolve(secretKey);
        } else {
          reject(new Error("Could not find the secret key in the output."));
        }
      });
  
      child.stdin.write(`${myPrivateHex} ${anotherPublicHex}\n`);
      child.stdin.end();
  
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error("Process timed out"));
      }, 10000);
  
      child.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }


async function initializeKeys() {
    try {
        const { publicKey, privateKey } = await generatePublicPrivateKeys();
        serverPublicKey = publicKey;
        serverPrivateKey = privateKey;
        // console.log("-- Generated [Public] Key:", serverPublicKey.toString('hex').slice(0, 16) + "...");
        // console.log("-- Generated [Private] Key:", privateKey.toString('hex').slice(0, 16) + "..."); // Never log full private keys
        return true;
    } catch (error) {
        console.error('Key initialization failed:', error);
        return false;
    }
}

function parseSensorData(hexString) {
    let bytes = [];
    for (let i = 0; i < hexString.length; i += 2) {
        bytes.push(parseInt(hexString.substr(i, 2), 16));
    }

    let data = {
        heartRate: bytes[0],     
        spo2: bytes[1],         
        temperature: bytes[2],   
        acceleration: bytes[3]   
    };

    return data;
}


function reconstructDecryptedData(decryptedtext) {
    if (!decryptedtext) {
        console.log("Error: Input is null or undefined.");
        return { error: true }; // Return an error object if the input is null or undefined
    }

    //console.log("Decrypted text received: ", decryptedtext);

    let deviceId = "";
    for (let i = 0; i < 32; i++) {
        if (decryptedtext[i] === 0) break;
        deviceId += String.fromCharCode(decryptedtext[i]);
    }
    //console.log("Extracted Device ID: ", deviceId);

    let deviceLen = decryptedtext[32];
    //console.log("Extracted Device Length: ", deviceLen);

    let dataLen = decryptedtext[33];
    //console.log("Extracted Data Length: ", dataLen);

    let result = {
        deviceId: deviceId,
        deviceLen: deviceLen,
        dataLen: dataLen
    };

    if (dataLen >= 5) {
        let heartRate = decryptedtext[35];
        let spO2 = decryptedtext[36];
        let temperature = decryptedtext[37];
        let acceleration = decryptedtext[38];
        let isanomaly = decryptedtext[39];
        result.heartRate = heartRate;
        result.spO2 = spO2;
        result.temperature = temperature;
        result.acceleration = acceleration;
        result.isanomaly = isanomaly
        // console.log("Extracted Heart Rate: ", heartRate);
        // console.log("Extracted SpO2: ", spO2);
        // console.log("Extracted Temperature: ", temperature);
    } else {
        result.error = "Insufficient data length to extract health metrics.";
        console.log("Error: Insufficient data length to extract health metrics.");
    }

    console.log("Final result: ", result);
    return result;
}

function decryptData(ciphertextHex, nonceHex, keyHex) {
    return new Promise((resolve, reject) => {
        const executablePath = path.resolve(__dirname, '../cryptography/exec-decrypt.exe');

        execFile(executablePath, [ciphertextHex, nonceHex, keyHex], (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(`Execution error: ${error.message}`));
            }
            if (stderr) {
                console.error('stderr:', stderr);
            }

            // Xử lý đầu ra của chương trình C++
            const outputLines = stdout.trim().split("\n");

            if (outputLines.length < 2) {
                return reject(new Error("Unexpected output format from decryption executable."));
            }

            // Lấy đúng dòng output mong muốn
            const decryptedText = outputLines[0].replace("Decrypted Text: ", "").trim();
            const authTagHex = outputLines[1].replace("Auth Tag: ", "").trim();

            resolve({ decryptedText, authTagHex });
        });
    });
}


const encodedPassword = Buffer.from('123').toString('base64');
console.log(`Encoded Password: ${encodedPassword}`);

const options = {
    username: 'admin', // Correct username
    password: '123', // Correct password, base64 encoded
};

const TOPICS = {
    HANDSHAKE_SYN: 'handshake/syn',
    HANDSHAKE_SYN_ACK: 'handshake/syn-ack',
    HANDSHAKE_ACK: 'handshake/ack',
    SENSOR_DATA: 'sensors/data',
    CLIENT_PUBLIC_KEY: 'topic/client-public-key', 
    ECDH_HANDSHAKE: 'handshake/ecdh'       
  };
  
const MESSAGE_HANDLERS = {
    [TOPICS.SENSOR_DATA]: handleSensorData,
    [TOPICS.CLIENT_PUBLIC_KEY]: handleClientPublicKey,
    [TOPICS.ECDH_HANDSHAKE]: parseFrame
};

async function handleSensorData(message) {
    // const data = JSON.parse(message.toString());
    // const { dataEncrypted, nonce } = data;

    // const serverSecret = await generateSecretKey(serverPrivateKey, serverReceivePublic);
    // console.log('Server Secret:', serverSecret);

    // const decryptedData = await decryptData(
    //     Buffer.from(dataEncrypted),
    //     Buffer.from(nonce),
    //     serverSecret
    // );

    // console.log('Decrypted Data (Hex):', decryptedData.toString('hex'));
    // const result = reconstructDecryptedData(decryptedData);

    // await uploadToFirestore(result);
}

async function handleClientPublicKey(message) {
    const messageBuffer = parseMessageToBuffer(message);
    serverReceivePublic = messageBuffer.toString();
    console.log('[PUBLIC RECEIVED]:', serverReceivePublic);

    if (serverReceivePublic) {
        await publishWithCallback(
        TOPICS.SERVER_PUBLIC_KEY,
        serverPublicKey.toString('hex'),
        'SERVER PUBLIC'
        );
    }
}

async function handleEcdhHandshake(message, identifierId, packetType) {
    try {
        // State 1: Parse and validate frame
        const frame = parseHandshakeFrame(message, identifierId, packetType);
        // logHandshakeFrame(frame);

        // State 2: Store client public key
        serverReceivePublic = frame.publicKey;
        // console.log('Received client public key:', serverReceivePublic.toString('hex'));

        // State 3: Generate server keys
        const keysInitialized = await initializeKeys();
        if (!keysInitialized) {
            throw new Error('Failed to generate server keys');
        }
        
        // State 4: Publish server public key
        const pubKeyBuffer = Buffer.isBuffer(serverPublicKey) ? serverPublicKey : Buffer.from(serverPublicKey, 'hex');
        client.publish(TOPIC_HANDSHAKE_ECDH_SEND, pubKeyBuffer, { qos: 1 }, (err) => {
            if (err) {
                reject(new Error(`Publish failed: ${err.message}`));
            } else {
                // console.log('-- Successfully published public key to', TOPIC_HANDSHAKE_ECDH_SEND);
            }
        });

        //State 5: Server compute secret key
        serverReceivePublic = serverReceivePublic.toString('hex');
        serverSecretKey = await generateSecretKey(serverPrivateKey, serverReceivePublic);
        // console.log("-- Generated secret key:", serverSecretKey.toString('hex').slice(0, 16) + "...");

    } catch (error) {
        console.error('Handshake error:', error.message);
        // Implement retry logic or error recovery here
    }
}

async function handleDataFrame(message, identifierId, packetType) {
    const ACK_PACKET = Buffer.from([0x02]);
    try {
        // State 1: Parse and validate the frame
        const frame = await parseDataFrame(message, identifierId, packetType);
        
        if (!frame) {
            throw new Error('[DAMN] Invalid data frame received -_-');
        }
        console.log('[1/3] Parse data frame completed')
        logServerDataFrame(frame);

        // State 3: Extract sensor data
        const data = parseSensorData(frame.decryptedText);
        if (!data) {
            throw new Error('[DAMN] Failed to parse sensor data from decrypted payload -_-');
        }
        console.log(`[2/3] Parsed sensor data completed`);
        console.log(data);

        //State ?: Send data to database (FIX ME)

        // State 4: Send ACK response
        await publishAck(TOPIC_HANDSHAKE_ECDH_SEND, ACK_PACKET);
        console.log('[NICE] Everything is done');

    } catch (error) {
        console.error(`-- Data frame error: ${error.message}`);
        // Optional: Implement retry logic or recovery mechanism
    }
}

/**
 * Helper function to publish ACK response.
 * Returns a Promise to ensure proper handling with async/await.
 */
function publishAck(topic, ackPacket) {
    return new Promise((resolve, reject) => {
        client.publish(topic, ackPacket, { qos: 1 }, (err) => {
            if (err) {
                reject(new Error(`Failed to publish ACK to ${topic}: ${err.message}`));
            } else {
                console.log(`[3/3] Publish ACK to ${topic} completed`);
                resolve();
            }
        });
    });
}

// Helper functions
function parseMessageToBuffer(message) {
    return Buffer.from(message.toString('hex'), 'hex');
}

async function publishWithCallback(topic, message, description) {
    return new Promise((resolve, reject) => {
        client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) {
            console.error(`Failed to publish ${description}:`, err);
            reject(err);
        } else {
            console.log(`Published ${description}`);
            resolve();
        }
        });
    });
}

async function uploadToFirestore(data) {
    const uploadData = {
        heart_rate: data.heartRate,
        temperature: data.temperature,
        spO2: data.spO2,
        acceleration: data.acceleration,
        isanomaly: data.isanomaly
    };
    await DeviceDataService.createDeviceData(uploadData, data.deviceId);
}

function parseFrame(message) {
    if (message.length < 7) {
        throw new Error("Message too short to parse header");
    }

    const preamble = message.readUInt16LE(0);
    const identifierId = message.readUInt32LE(2);
    const packetType = message.readUInt8(6);

    // Validate preamble 
    if (preamble !== 0xAA55) {
        throw new Error("Invalid preamble");
    }

    // Dispatch based on packet type
    switch (packetType) {
        case 0x03: // Handshake Frame
            return handleEcdhHandshake(message, identifierId, packetType);
        case 0x01: // Data Frame
            return handleDataFrame(message, identifierId, packetType);
        default:
            throw new Error(`Unknown packet type: 0x${packetType.toString(16).padStart(2, '0')}`);
    }
}

function parseHandshakeFrame(message, identifierId, packetType) {
    const publicKeyStart = 9;         // Public key starts at offset 9
    const publicKeyLength = 48;       // Public key is 48 bytes
    const sequenceNumberOffset = 7;   // Sequence number offset
    const endMarkerOffset = publicKeyStart + publicKeyLength;  // End marker offset (calculated based on previous data)

    return {
        preamble: message.readUInt16LE(0),                               // 2 bytes for preamble
        identifierId: identifierId,                                       // Unique identifier passed in the argument
        packetType: packetType,                                           // Packet type passed in the argument
        sequenceNumber: message.readUInt16LE(sequenceNumberOffset),      // 2 bytes for sequence number
        publicKey: message.subarray(publicKeyStart, publicKeyStart + publicKeyLength), // 32 bytes for public key
        endMarker: message.readUInt16LE(endMarkerOffset)                  // 2 bytes for end marker
    };
}

const epoch = new Date(0);
function MACCompute() {
    // Start from Unix epoch (January 1, 1970 00:00:00 UTC)
    // const minute = epoch.getUTCMinutes();
    // const hour = epoch.getUTCHours(); 
    // const day = epoch.getUTCDate();
    // const month = epoch.getUTCMonth() + 1;  // getUTCMonth() returns 0-11
    // const year = epoch.getUTCFullYear();
    
    const minute = 30;
    const hour = 12;
    const day = 15;
    const month = 6;    
    const year = 2023;

    let T = 0;
    T |= (minute & 0x3F) >>> 0;
    T |= ((hour & 0x1F) << 6) >>> 0;
    T |= ((day & 0x1F) << 11) >>> 0;
    T |= ((month & 0x0F) << 16) >>> 0;
    T |= ((year & 0xFFF) << 20) >>> 0;

    const K = 0x24C8E560 >>> 0;
    const T_low_rotl = (((T << 7) | (T >>> (32 - 7))) >>> 0);
    const A = (T ^ T_low_rotl) >>> 0;
    const T_high_rotr = (((T >>> 11) | (T << (32 - 11))) >>> 0);
    const B = (T ^ T_high_rotr) >>> 0;
    const MAC_final = ((A ^ B) ^ K) >>> 0;

    // console.log("T =", T >>> 0);
    // console.log("T_low_rotl =", T_low_rotl >>> 0);
    // console.log("A =", A >>> 0);
    // console.log("T_high_rotr =", T_high_rotr >>> 0);
    // console.log("B =", B >>> 0);
    // console.log("MAC_final =", MAC_final >>> 0);

    return MAC_final >>> 0; 
}

async function parseDataFrame(message, expectedIdentifierId, expectedPacketType) {      
    const NONCE_SIZE = 16;  
    const AUTH_TAG_SIZE = 4;

    // Parse fixed header fields according to structure order
    const s_preamble = message.readUInt16LE(0);           // offset 0, 2 bytes
    const s_identifierId = message.readUInt32LE(2);       // offset 2, 4 bytes
    const s_packetType = message.readUInt8(6);            // offset 6, 1 byte
    const s_sequenceNumber = message.readUInt16LE(7);     // offset 7, 2 bytes
    const s_timestamp = message.readBigUInt64LE(9);       // offset 9, 8 bytes
    const s_nonce = message.subarray(17, 17 + NONCE_SIZE); // offset 17, 16 bytes
    const s_payloadLength = message.readUInt16LE(17 + NONCE_SIZE); // offset 33, 2 bytes

    // Calculate offsets
    const encryptedPayloadStart = 17 + NONCE_SIZE + 2;    // offset 35
    const encryptedPayloadEnd = encryptedPayloadStart + s_payloadLength;
    const macTagStart = encryptedPayloadEnd;
    const macTagEnd = macTagStart + AUTH_TAG_SIZE;        // uint64_t is 8 bytes
    const s_endMarkerOffset = macTagEnd;

    const s_encryptedPayload = message.subarray(encryptedPayloadStart, encryptedPayloadEnd);
    const s_macTag = message.subarray(macTagStart, macTagEnd);
    const s_endMarker = message.readUInt16LE(s_endMarkerOffset);

    const encryptedHex = s_encryptedPayload.toString('hex');
    const nonceHex = s_nonce.toString('hex');

    // console.log("Encrypted Payload: ", encryptedHex);
    // console.log("Nonce: ", nonceHex);
    // console.log("Server Secret Key: ", serverSecretKey);

    const { decryptedText, authTagHex } = await decryptData(encryptedHex, nonceHex, serverSecretKey);
    const macTag = MACCompute();
    const buffer = Buffer.from(s_macTag);
    const receivedMac = buffer.readUInt32LE(0);
    // console.log("Received MAC Tag: ", macTag);
    // console.log("Computed MAC Tag: ", receivedMac);

    if (!decryptedText) {
        throw new Error('[DAMN] Decryption failed or returned empty data -_-');
    }

    // Compare mac tag (8 bytes)
    if (macTag !== receivedMac)
    {    
        throw new Error(`MAC tag mismatch: expected ${s_macTag.toString('hex')}, got ${authTag.toString(16)}`);
    }

    if (s_identifierId !== expectedIdentifierId) {
        throw new Error(`Identifier ID mismatch: expected ${expectedIdentifierId}, got ${s_identifierId}`);
    }
    if (s_packetType !== expectedPacketType) {
        throw new Error(`Packet type mismatch: expected ${expectedPacketType}, got ${s_packetType}`);
    }
    if (s_endMarker.toString(16) !== (0xAABB).toString(16)) {  // Assuming 0xAABB as expected end marker
        throw new Error(`End marker mismatch: expected ${0xAABB.toString(16)}, got ${s_endMarker.toString(16)}`);
    }

    const endTime = Date.now();

    return {
        preamble: s_preamble,
        identifierId: s_identifierId,
        packetType: s_packetType,
        sequenceNumber: s_sequenceNumber,
        timestamp: s_timestamp,
        nonce: s_nonce,
        payloadLength: s_payloadLength,
        encryptedPayload: s_encryptedPayload,
        macTag: s_macTag,  // Changed from authTag to match structure
        endMarker: s_endMarker,
        decryptedText
    };
}


function logHandshakeFrame(frame) {
    let pubKeyHex = frame.publicKey.toString('hex');

    if (pubKeyHex.length > 32) {
        pubKeyHex = pubKeyHex.substring(0, 32) + '...';
    }

    console.log("-- Parsed Handshake Frame:");
    console.table([
        { "Field": "Preamble",       "Value": `0x${frame.preamble.toString(16)}` },
        { "Field": "Identifier ID",  "Value": `0x${frame.identifierId.toString(16)}` },
        { "Field": "Packet Type",    "Value": `0x${frame.packetType.toString(16)}` },
        { "Field": "Sequence Number", "Value": frame.sequenceNumber },
        { "Field": "Public Key",     "Value": pubKeyHex },
        { "Field": "End Marker",     "Value": `0x${frame.endMarker.toString(16)}` }
    ]);
}

function logServerDataFrame(frame) {
    console.log("-- Parsed Server Data Frame:");
    console.table([
        { "Field": "Preamble", "Value": `0x${frame.preamble.toString(16)}` },
        { "Field": "Identifier ID", "Value": `0x${frame.identifierId.toString(16)}` },
        { "Field": "Packet Type", "Value": `0x${frame.packetType.toString(16)}` },
        { "Field": "Sequence Number", "Value": frame.sequenceNumber },
        { "Field": "Timestamp", "Value": frame.timestamp.toString() },
        { "Field": "Nonce", "Value": frame.nonce.toString('hex') },
        { "Field": "Payload Length", "Value": frame.payloadLength },
        { "Field": "Encrypted Payload", "Value": frame.encryptedPayload.toString('hex') },
        { "Field": "Auth Tag", "Value": frame.macTag.toString('hex') },
        { "Field": "End Marker", "Value": `0x${frame.endMarker.toString(16)}`}
    ]);
}


function initMQTT() {
    client = mqtt.connect(brokerUrl, options);

    client.on('connect', () => {
        console.log('Connected to MQTT broker');
        client.subscribe(DATA_TOPIC, { qos: 1 }, (err) => {
            if (err) {
                console.error(`Failed to subscribe to ${DATA_TOPIC}:`, err);
            } else {
                console.log(`-- Subscribed to [${DATA_TOPIC}]`);
            }
        });
        client.subscribe(TOPIC_TO_RECEIVE_PUBLIC_FROM_CLIENT, { qos: 1 }, (err) => {
            if (err) {
                console.error(`Failed to subscribe to ${TOPIC_TO_RECEIVE_PUBLIC_FROM_CLIENT}:`, err);
            } else {
                console.log(`-- Subscribed to [${TOPIC_TO_RECEIVE_PUBLIC_FROM_CLIENT}]`);
            }
        });
        client.subscribe(TOPIC_HANDSHAKE_ECDH, { qos: 1 }, (err) => {
            if (err) {
                console.error(`Failed to subscribe to ${TOPIC_HANDSHAKE_ECDH}:`, err);
            } else {
                console.log(`-- Subscribed to [${TOPIC_HANDSHAKE_ECDH}]`);
            }
        });
    });

    client.on('message', async (topic, message) => {
        const handler = MESSAGE_HANDLERS[topic];
        if (handler) {
          try {
            const startTime = Date.now();
            await handler(message);
            const endTime = Date.now();
            // console.log(`-> Processed in ${endTime - startTime}ms`);
          } catch (error) {
            console.error(`Error handling ${topic}:`, error);
          }
        } else {
          console.warn(`No handler for topic: ${topic}`);
        }
    });

    client.on('error', (err) => {
        console.error('Connection error:', err);
    });

    client.on('reconnect', () => {
        console.log('Reconnecting to MQTT broker...');
    });

    client.on('offline', () => {
        console.log('MQTT client is offline');
    });

    client.on('close', () => {
        console.log('MQTT connection closed');
    });
}

module.exports = {
    initMQTT
};



