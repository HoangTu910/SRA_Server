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
const TOPIC_INITIAL_SESSION = 'init/session';
const TOPIC_METRICS = 'metrics/data';

const MAX_SEQUENCE_NUMBER = 11;

const RESET_SEQUENCE_PACKET =  Buffer.from([0x11]);

let derivationIndex = 1;
const MAX_DERIVATION_INDEX = 65535;

const THRESHOLD_FOR_REJECTING_SEQUENCE = 10;

let expectedSequenceNumber = 0;  
let safeCounter = 0;
let failedSequenceNumber = 0;

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

async function deriveKey(masterKey, context, index) {
    return new Promise((resolve, reject) => {
        // Take only first 48 bytes of master key
        const truncatedKey = masterKey.slice(0, 96);

        // Validate inputs
        if (truncatedKey.length !== 96) {
            return reject(new Error(`Invalid master key length: ${truncatedKey.length}`));
        }

        const contextHex = Buffer.isBuffer(context) ? 
            context.toString('hex') : 
            (typeof context === 'string' && /^[0-9a-fA-F]+$/.test(context)) ?
                context :
                Buffer.from(context).toString('hex');

        // Log exact command being executed
        const executablePath = path.resolve(__dirname, '../cryptography/exec-derive-key.exe');
        const args = [truncatedKey, contextHex, index.toString()];
        
        // console.log('Executing command:', executablePath);
        // console.log('Arguments:', JSON.stringify(args, null, 2));

        const child = execFile(executablePath, args, { 
            timeout: 5000,
            windowsHide: true // Prevent window from showing
        }, (error, stdout, stderr) => {
            // Check if we have valid output regardless of error code
            const output = stdout?.trim();
            if (output && /^[0-9a-f]{96}$/i.test(output)) {
                console.log('Derived key successfully:', output.slice(0, 16) + '...');
                return resolve(output.toLowerCase());
            }

            // If no valid output, handle error normally
            if (error) {
                console.error('Key derivation failed:', {
                    error: error.message,
                    code: error.code,
                    signal: error.signal,
                    masterKey: truncatedKey.slice(0, 16) + '...',
                    contextHex: contextHex,
                    index: index,
                    stdout: stdout?.trim(),
                    stderr: stderr?.trim()
                });
                return reject(error);
            }

            return reject(new Error('No valid key output received'));
        });

        // Add error handler for the child process
        child.on('error', (error) => {
            console.error('Child process error:', error);
            reject(error);
        });
    });
}

function encryptData(plaintextHex, nonceHex, keyHex, associatedDataHex) {
    return new Promise((resolve, reject) => {
        const executablePath = path.resolve(__dirname, '../cryptography/exec-encrypt.exe');
      
        // Pass all arguments, including associatedDataHex
        execFile(executablePath, [plaintextHex, nonceHex, keyHex, associatedDataHex], (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(`Execution error: ${error.message}`));
            }
            if (stderr) {
                console.error('stderr:', stderr);
            }

            // Process the output from the C++ program
            const outputLines = stdout.trim().split("\n");

            if (outputLines.length < 2) {
                return reject(new Error("Unexpected output format from decryption executable."));
            }

            const encryptedText = outputLines[0].replace("Encrypted Text: ", "").trim();
            const authTagHex = outputLines[1].replace("Auth Tag: ", "").trim();

            resolve({ encryptedText, authTagHex });
        });
    });
}

async function decryptData(ciphertextHex, nonceHex, keyHex) {
    return new Promise((resolve, reject) => {
        const executablePath = path.resolve(__dirname, '../cryptography/exec-decrypt.exe');

        // Pass all arguments, including associatedDataHex
        execFile(executablePath, [ciphertextHex, nonceHex, keyHex], (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(`Execution error: ${error.message}`));
            }
            if (stderr) {
                console.error('stderr:', stderr);
            }

            // Process the output from the C++ program
            const outputLines = stdout.trim().split("\n");

            if (outputLines.length < 2) {
                return reject(new Error("Unexpected output format from decryption executable."));
            }

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
    ECDH_HANDSHAKE: 'handshake/ecdh',
    METRICS: 'metrics/data',       
  };
  
const MESSAGE_HANDLERS = {
    [TOPICS.SENSOR_DATA]: handleSensorData,
    [TOPICS.ECDH_HANDSHAKE]: parseFrame,
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
        const frame = await parseHandshakeFrame(message, identifierId, packetType);
        logHandshakeFrame(frame);

        // State 2: Store client public key - Fix hex conversion
        serverReceivePublic = frame.publicKey.toString('hex');
        console.log('-- Received client public key:', serverReceivePublic.slice(0, 16) + '...');

        // State 3: Generate server keys
        const keysInitialized = await initializeKeys();
        if (!keysInitialized) {
            throw new Error('Failed to generate server keys');
        }
        
        // State 4: Publish server public key
        const pubKeyBuffer = Buffer.from(serverPublicKey, 'hex');
        await new Promise((resolve, reject) => {
            client.publish(TOPIC_HANDSHAKE_ECDH_SEND, pubKeyBuffer, { qos: 1 }, (err) => {
                if (err) {
                    reject(new Error(`Publish failed: ${err.message}`));
                } else {
                    console.log('-- Successfully published server public key');
                    resolve();
                }
            });
        });

        // State 5: Generate secret key - Remove double hex conversion
        serverSecretKey = await generateSecretKey(serverPrivateKey, serverReceivePublic);
        if (!serverSecretKey) {
            throw new Error('Failed to generate secret key');
        }
        console.log("-- Generated secret key:", serverSecretKey.slice(0, 16) + "...");

        // Add verification
        if (!verifyKeyExchange()) {
            throw new Error('Key exchange verification failed');
        }

        return true;
    } catch (error) {
        console.error('Handshake Error:', error);
        throw error;
    }
}

function verifyKeyExchange() {
    if (!serverPrivateKey || !serverReceivePublic || !serverSecretKey) {
        console.error('Missing key components:', {
            hasPrivateKey: !!serverPrivateKey,
            hasPublicKey: !!serverReceivePublic,
            hasSecretKey: !!serverSecretKey
        });
        return false;
    }

    // Verify all keys are in hex format
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(serverSecretKey)) {
        console.error('Invalid secret key format');
        return false;
    }

    return true;
}

async function handleMetricsFrame(message, identifierId, packetType) {
    const frame = await parseMetricsFrame(message, identifierId, packetType);
    if (!frame) {
        throw new Error('[DAMN] Invalid metrics frame received -_-');
    }
    console.log('[SPECIAL PACKET PER MINUTE] Retrived metrics from device: ', frame.metrics);
    try {
        await uploadMetricsToFirestore(frame.metrics, identifierId.toString());
        console.log('[SUCCESS] Metrics uploaded to Firestore');
    } catch (error) {
        console.error('[ERROR] Failed to upload metrics to Firestore:', error);
    }
}

async function handleInitialSession(message, identifierId, packetType) {
    const PACKET = Buffer.alloc(3);
    PACKET[0] = safeCounter;
    PACKET.writeUInt16BE(derivationIndex, 1);
    const frame = await parseInitialSessionFrame(message, identifierId, packetType);
    if (!frame) {
        throw new Error('[DAMN] Invalid initial session frame received -_-');
    }
    console.log('[INITIAL SESSION] Retrived initial session data from device: ', frame.identifierId);
    await publishSafeCounter(TOPIC_HANDSHAKE_ECDH_SEND, PACKET);
}

async function uploadMetricsToFirestore(metrics, deviceId) {
    const uploadData = {
        pdr: metrics.pdr,
        avgLatency: metrics.avgLatency,
        avgPacket: metrics.avgPacket,
        deviceId: deviceId
    };
    await DeviceDataService.createMetricsData(uploadData, deviceId);
}

async function handleDataFrame(message, identifierId, packetType) {
    const ACK_PACKET = Buffer.from([0x02]);
    try {
        // State 1: Parse and validate the frame
        console.log("Start Parsing Data Frame");
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
        console.log('Safe counter current: ', safeCounter);
        console.log(data);

        //State ?: Send data to database (FIX ME)

        // State 4: Send ACK response
        await publishAck(TOPIC_HANDSHAKE_ECDH_SEND, ACK_PACKET);
        console.log('[NICE] Everything is done');

    } catch (error) {
        console.error(`-- Data frame has been rejected: ${error.message}`);
        if(failedSequenceNumber === THRESHOLD_FOR_REJECTING_SEQUENCE) {
            console.log(`-- Sequence number failed ${failedSequenceNumber} times. Resetting counter...`);
            
            // Check if serverSecretKey is a string and log its type
            console.log('Server Secret Key type:', typeof serverSecretKey);
            
            if (typeof serverSecretKey !== 'string') {
                throw new Error('Server secret key must be a hex string');
            }
            
            const secretKeyBytes = new Uint8Array(serverSecretKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            let secretKeyNum = 0;
            for (let i = 0; i < secretKeyBytes.length; i++) {
                secretKeyNum ^= secretKeyBytes[i] << ((i % 2) * 8); // Shift and XOR alternately
            }
            console.log(`-- Safe Counter: ${safeCounter}`);
            expectedSequenceNumber = (safeCounter ^ secretKeyNum) % MAX_SEQUENCE_NUMBER;
            console.log(`-- Resetting sequence number to ${expectedSequenceNumber}`);
            await publishSignalForResettingSequence(TOPIC_HANDSHAKE_ECDH_SEND, RESET_SEQUENCE_PACKET);
            failedSequenceNumber = 0;
        }
        else {
            failedSequenceNumber++;
        }
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
                derivationIndex = (derivationIndex + 1) % MAX_DERIVATION_INDEX;
                safeCounter = (safeCounter + ((safeCounter << 3) ^ (safeCounter >> 2) ^ 7)) % 256;
                console.log(`[3/3] Publish ACK to ${topic} completed`);
                resolve();
            }
        });
    });
}

function publishSafeCounter(topic, ackPacket) {
    return new Promise((resolve, reject) => {
        client.publish(topic, ackPacket, { qos: 1 }, (err) => {
            if (err) {
                reject(new Error(`Failed to publish safe counter to ${topic}: ${err.message}`));
            } else {
                // safeCounter = (safeCounter + ((safeCounter << 3) ^ (safeCounter >> 2) ^ 7)) % 65536;
                console.log(`Publish safe counter to ${topic} completed`);
                resolve();
            }
        });
    });
}

function publishSignalForResettingSequence(topic, signal) {
    return new Promise((resolve, reject) => {
        client.publish(topic, signal, { qos: 1 }, (err) => {
            if (err) {
                reject(new Error(`Failed to publish signal to ${topic}: ${err.message}`));
            } else {
                derivationIndex = (derivationIndex + 1) % MAX_DERIVATION_INDEX;
                console.log(`[*] Publish Signal to ${topic} completed`);
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

async function parseFrame(message) {
    if (message.length < 7) {
        throw new Error("Message too short to parse header");
    }

    const preamble = message.readUInt16LE(0);
    const identifierId = message.readUInt32LE(2);
    const packetType = message.readUInt8(6);

    if (preamble !== 0xAA55) {
        console.log(`Invalid preamble: expected 0xAA55, got 0x${preamble.toString(16)}`);
        return;
    }
    switch (packetType) {
        case 0x03: 
            return handleEcdhHandshake(message, identifierId, packetType);
        case 0x01:
            return handleDataFrame(message, identifierId, packetType);
        case 0x04:
            return handleMetricsFrame(message, identifierId, packetType);
        case 0x05:
            return handleInitialSession(message, identifierId, packetType);
        default:
            console.log(`Unexpected packet type: expected 0x01, 0x03, 0x04, 0x05, got 0x${packetType.toString(16)}`);
            return;
    }
}

async function parseInitialSessionFrame(message, identifierId, packetType) {
    const preambleSize = 2;           // uint16_t
    const identifierIdSize = 4;       // uint32_t
    const packetTypeSize = 1;         // uint8_t
    const endMarkerSize = 2;          // uint16_t

    // Calculate offsets
    const preambleOffset = 0;
    const identifierIdOffset = preambleOffset + preambleSize;              // 2
    const packetTypeOffset = identifierIdOffset + identifierIdSize;        // 6
    const endMarkerOffset = packetTypeOffset + packetTypeSize;              // 7

    // Validate message length
    const expectedLength = endMarkerOffset + endMarkerSize; // 9 bytes
    if (message.length < expectedLength) {
        throw new Error(`Invalid frame size: expected ${expectedLength} bytes, got ${message.length}`);
    }
    // Parse the fields from the message Buffer
    const preamble = message.readUInt16LE(preambleOffset);
    const parsedIdentifierId = message.readUInt32LE(identifierIdOffset);
    const parsedPacketType = message.readUInt8(packetTypeOffset);
    const endMarker = message.readUInt16LE(endMarkerOffset);

    // Validate frame components
    if (preamble !== 0xAA55) {
        throw new Error(`Invalid preamble: expected 0xAA55, got 0x${preamble.toString(16)}`);
    }
    if (parsedIdentifierId !== identifierId) {
        throw new Error(`Invalid identifier ID: expected ${identifierId}, got ${parsedIdentifierId}`);
    }
    if (parsedPacketType !== packetType) {
        throw new Error(`Invalid packet type: expected ${packetType}, got ${parsedPacketType}`);
    }
    if (endMarker !== 0xAABB) {
        throw new Error(`Invalid end marker: expected 0xAABB, got 0x${endMarker.toString(16)}`);
    }

    return {
        preamble,
        identifierId: parsedIdentifierId,
        packetType: parsedPacketType,
        endMarker
    };
}

async function parseMetricsFrame(message, identifierId, packetType) {
    const preambleSize = 2;           // uint16_t str_header
    const identifierIdSize = 4;       // uint32_t str_identifierId
    const packetTypeSize = 1;         // uint8_t str_packetType
    const METRICS_SIZE = 3;           // Three uint32_t values in str_metrics array
    const metricsSize = METRICS_SIZE * 4;  // Each uint32_t is 4 bytes
    const endMarkerSize = 2;          // uint16_t str_trailer

    // Calculate offsets
    const preambleOffset = 0;
    const identifierIdOffset = preambleOffset + preambleSize;              // 2
    const packetTypeOffset = identifierIdOffset + identifierIdSize;        // 6
    const metricsOffset = packetTypeOffset + packetTypeSize;              // 7
    const endMarkerOffset = metricsOffset + metricsSize;                  // 19

    // Validate message length
    const expectedLength = endMarkerOffset + endMarkerSize; // 21 bytes
    if (message.length < expectedLength) {
        throw new Error(`Invalid frame size: expected ${expectedLength} bytes, got ${message.length}`);
    }

    // Parse the fields from the message Buffer
    const preamble = message.readUInt16LE(preambleOffset);                
    const parsedIdentifierId = message.readUInt32LE(identifierIdOffset);  
    const parsedPacketType = message.readUInt8(packetTypeOffset);         

    // Read metrics values (converting from network byte order)
    const metrics = new Array(METRICS_SIZE);
    for (let i = 0; i < METRICS_SIZE; i++) {
        const networkValue = message.readUInt32BE(metricsOffset + (i * 4)); // Use BE for network byte order
        // Convert uint32 back to float using ArrayBuffer
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setUint32(0, networkValue, false); // false for big-endian
        metrics[i] = view.getFloat32(0, false);
    }

    const endMarker = message.readUInt16LE(endMarkerOffset);

    // Validate frame components
    if (preamble !== 0xAA55) {
        throw new Error(`Invalid preamble: expected 0xAA55, got 0x${preamble.toString(16)}`);
    }
    if (parsedIdentifierId !== identifierId) {
        throw new Error(`Invalid identifier ID: expected ${identifierId}, got ${parsedIdentifierId}`);
    }
    if (parsedPacketType !== packetType) {
        throw new Error(`Invalid packet type: expected ${packetType}, got ${parsedPacketType}`);
    }
    if (endMarker !== 0xAABB) {
        throw new Error(`Invalid end marker: expected 0xAABB, got 0x${endMarker.toString(16)}`);
    }

    return {
        preamble,
        identifierId: parsedIdentifierId,
        packetType: parsedPacketType,
        metrics: {
            pdr: Math.round(metrics[0] * 100) / 100,              // Packet Delivery Ratio (%)
            avgLatency: Math.round(metrics[1] * 100) / 100,       // Average Latency (ms) 
            avgPacket: Math.round(metrics[2] * 100) / 100         // Packets received this minute
        },
        endMarker
    };
}

async function parseHandshakeFrame(message, identifierId, packetType) {
    const preambleSize = 2;           // uint16_t
    const identifierIdSize = 4;       // uint32_t
    const packetTypeSize = 1;         // uint8_t
    const nonceSize = 16;             // NONCE_SIZE = 16
    const publicKeyLengthSize = 1;    // uint8_t
    const publicKeySize = 48;         // ECC_PUB_KEY_SIZE = 48
    const authTagSize = 16;           // AUTH_TAG_SIZE = 16
    const endMarkerSize = 2;          // uint16_t

    // Calculate offsets
    const preambleOffset = 0;
    const identifierIdOffset = preambleOffset + preambleSize;              // 2
    const packetTypeOffset = identifierIdOffset + identifierIdSize;        // 6
    const nonceOffset = packetTypeOffset + packetTypeSize;                // 7
    const publicKeyLengthOffset = nonceOffset + nonceSize;                // 23
    const publicKeyOffset = publicKeyLengthOffset + publicKeyLengthSize;  // 24
    const authTagOffset = publicKeyOffset + publicKeySize;                // 72
    const endMarkerOffset = authTagOffset + authTagSize;                  // 88

    // Validate message length
    const expectedLength = endMarkerOffset + endMarkerSize; // 90 bytes
    if (message.length < expectedLength) {
        throw new Error(`Invalid frame size: expected at least ${expectedLength} bytes, got ${message.length}`);
    }

    // Parse the fields from the message Buffer
    const preamble = message.readUInt16LE(preambleOffset);                // 2 bytes
    const parsedIdentifierId = message.readUInt32LE(identifierIdOffset);  // 4 bytes
    const parsedPacketType = message.readUInt8(packetTypeOffset);         // 1 byte
    const nonce = message.subarray(nonceOffset, nonceOffset + nonceSize); // 16 bytes
    const publicKeyLength = message.readUInt8(publicKeyLengthOffset);     // 1 byte
    const publicKey = message.subarray(publicKeyOffset, publicKeyOffset + publicKeySize); // 48 bytes
    const authTag = message.subarray(authTagOffset, authTagOffset + authTagSize);         // 16 bytes
    const endMarker = message.readUInt16LE(endMarkerOffset);              // 2 bytes

    // Convert nonce and authTag to hex for decryption
    const nonceHex = Buffer.isBuffer(nonce) ? nonce.toString('hex') : nonce;
    const associatedDataHex = "48454c4c4f"; 
    const serverPresharedKey = "000102030405060708090a0b0c0d0e0f";
    let plaintext = "";
    const { encryptedText, authTagHex } = await encryptData(plaintext, nonceHex, serverPresharedKey, associatedDataHex);
    if(authTagHex !== authTag.toString('hex')) {
        console.log(`MAC tag mismatch: expected ${authTag.toString('hex')}, got ${authTagHex}`);
    }
    
    // Return the parsed frame
    return {
        preamble: preamble,
        identifierId: identifierId || parsedIdentifierId, // Use passed value or parsed value
        packetType: packetType || parsedPacketType,       // Use passed value or parsed value
        nonce: nonce,                                     // Raw Buffer (16 bytes)
        publicKeyLength: publicKeyLength,                 // Should match publicKeySize (48)
        publicKey: publicKey,                             // Raw Buffer (48 bytes)
        authTag: authTag,                                 // Raw Buffer (16 bytes)
        endMarker: endMarker
    };
}

function MACCompute(inputNumber) {
    const T = (inputNumber >>> 0);
    const K = 0x24C8E560 >>> 0;
    const T_low_rotl = ((T << 7) | (T >>> (32 - 7))) >>> 0;
    const A = (T ^ T_low_rotl) >>> 0;
    const T_high_rotr = ((T >>> 11) | (T << (32 - 11))) >>> 0;
    const B = (T ^ T_high_rotr) >>> 0;
    const MAC_final = ((A ^ B) ^ K) >>> 0;

    return MAC_final;
}

async function parseDataFrame(message, expectedIdentifierId, expectedPacketType) {
    if (!verifyKeyExchange()) {
        throw new Error('Invalid key state for decryption');
    }
    const NONCE_SIZE = 16;
    const AUTH_TAG_SIZE = 16; 

    const s_preamble = message.readUInt16LE(0);          // offset 0, 2 bytes
    const s_identifierId = message.readUInt32LE(2);      // offset 2, 4 bytes
    if (s_identifierId !== expectedIdentifierId) {
        throw new Error(`Identifier ID mismatch: expected ${expectedIdentifierId}, got ${s_identifierId}`);
    }

    const s_packetType = message.readUInt8(6);            // offset 6, 1 byte
    if (expectedPacketType !== undefined && s_packetType !== expectedPacketType) {
        throw new Error(`Packet Type mismatch: expected ${expectedPacketType}, got ${s_packetType}`);
    }

    const s_sequenceNumber = message.readUInt32LE(7);    // offset 7, 4 bytes

    if (typeof expectedSequenceNumber !== 'undefined' && s_sequenceNumber !== expectedSequenceNumber) {
        throw new Error(`Invalid sequence number: got ${s_sequenceNumber}, expected ${expectedSequenceNumber}`);
    }
    if (typeof expectedSequenceNumber !== 'undefined') {
        expectedSequenceNumber = (expectedSequenceNumber + 1) % MAX_SEQUENCE_NUMBER; // Updated for 4-byte sequence number
    }


    const s_nonce = message.subarray(11, 11 + NONCE_SIZE); // offset 11, 16 bytes
    const s_payloadLength = message.readUInt16LE(11 + NONCE_SIZE); // offset 27, 2 bytes (Updated to 2 bytes)

    // Calculate offsets
    const encryptedPayloadStart = 11 + NONCE_SIZE + 2;    // offset 29 (Adjusted offset)
    const encryptedPayloadEnd = encryptedPayloadStart + s_payloadLength;
    const macTagStart = encryptedPayloadEnd;
    const macTagEnd = macTagStart + AUTH_TAG_SIZE;
    const s_endMarkerOffset = macTagEnd;

    const s_encryptedPayload = message.subarray(encryptedPayloadStart, encryptedPayloadEnd);
    const s_macTag = message.subarray(macTagStart, macTagEnd);
    const s_endMarker = message.readUInt16LE(s_endMarkerOffset);

    const encryptedHex = s_encryptedPayload.toString('hex');
    const nonceHex = s_nonce.toString('hex');

    let decryptedTextGet = null;

    // console.log(encryptedHex.toString(16));
    // console.log(serverSecretKey.toString(16));
    // console.log(nonceHex.toString(16));

    const associatedData = [0x98, 0x95, 0x9C, 0x9C, 0x9F];
    const associatedDataHex = Buffer.from(associatedData).toString('hex');

    // console.log('Associated Data (hex):', associatedDataHex);
    // console.log("Server Secret Key:", serverSecretKey);

    const sessionKey = await deriveKey(
        serverSecretKey,
        associatedDataHex,  
        derivationIndex
    );
    console.log('-- Session key generated:', sessionKey.slice(0, 16) + '...');
    console.log('-- Derivation index', derivationIndex);
    
    try {
        const decryptionResult = await decryptData(encryptedHex, nonceHex, sessionKey);
        if (!decryptionResult || !decryptionResult.decryptedText) {
            throw new Error('Decryption produced no result');
        }
        decryptedTextGet = decryptionResult.decryptedText;
    } catch (error) {
        console.error('Decryption failed:', error);
        console.log('Encryption parameters:', {
            encryptedHexLength: encryptedHex.length,
            nonceHexLength: nonceHex.length,
            secretKeyLength: serverSecretKey.length
        });
        throw error;
    }
    
    if (s_endMarker !== 0xAABB) { 
        throw new Error(`End marker mismatch: expected ${0xAABB.toString(16)}, got ${s_endMarker.toString(16)}`);
    }

    return {
        preamble: s_preamble,
        identifierId: s_identifierId,
        packetType: s_packetType,
        sequenceNumber: s_sequenceNumber,
        nonce: s_nonce,
        payloadLength: s_payloadLength,
        encryptedPayload: s_encryptedPayload,
        macTag: s_macTag,
        endMarker: s_endMarker,
        decryptedText: decryptedTextGet
    };
}


function logHandshakeFrame(frame) {
    let pubKeyHex = frame.publicKey.toString('hex');

    if (pubKeyHex.length > 32) {
        pubKeyHex = pubKeyHex.substring(0, 16) + '...';
    }

    console.log("-- Parsed Handshake Frame:");
    console.table([
        { "Field": "Preamble",       "Value": `0x${frame.preamble.toString(16)}` },
        { "Field": "Identifier ID",  "Value": `0x${frame.identifierId.toString(16)}` },
        { "Field": "Packet Type",    "Value": `0x${frame.packetType.toString(16)}` },
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
        { "Field": "Nonce", "Value": frame.nonce.toString('hex') },
        { "Field": "Payload Length", "Value": frame.payloadLength },
        { "Field": "Encrypted Payload", "Value": frame.encryptedPayload.toString('hex') },
        { "Field": "MAC Tag", "Value": frame.macTag.toString('hex') },
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
        client.subscribe(TOPIC_METRICS, { qos: 1 }, (err) => {
            if (err) {
                console.error(`Failed to subscribe to ${TOPIC_METRICS}:`, err);
            } else {
                console.log(`-- Subscribed to [${TOPIC_METRICS}]`);
            }
        });

        client.subscribe(TOPIC_INITIAL_SESSION, { qos: 1 }, (err) => {
            if (err) {
                console.error(`Failed to subscribe to ${TOPIC_INITIAL_SESSION}:`, err);
            } else {
                console.log(`-- Subscribed to [${TOPIC_INITIAL_SESSION}]`);
            }
        });
    });

    client.on('message', async (topic, message) => {
        try {
            const startTime = Date.now();
            if (topic === TOPICS.SENSOR_DATA) {
                await handleSensorData(message);
            } else if (topic === TOPICS.ECDH_HANDSHAKE) {
                console.log("-- Received ECDH Handshake message");
                await parseFrame(message);
            } else if (topic === TOPIC_METRICS) {
                await parseFrame(message); 
            } else if (topic === TOPIC_INITIAL_SESSION) {
                await parseFrame(message);
            } else {
                console.warn(`No handler for topic: ${topic}`);
                return;
            }
    
            const endTime = Date.now();
            console.log(`-> Processed ${topic} in ${endTime - startTime}ms`);
        } catch (error) {
            console.error(`Error handling ${topic}:`, error);
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



