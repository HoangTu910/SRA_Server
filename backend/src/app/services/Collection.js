const { db } = require('../../config/firebase');

const DeviceDataCollection = db.collection('devices');
const UserCollection = db.collection('users');
const Spo2Collection = db.collection('spo2');

module.exports = { DeviceDataCollection, UserCollection };