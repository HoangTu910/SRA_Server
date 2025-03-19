const express = require('express');
const DeviceDataController = require('../app/controllers/DeviceDataController');

const {
    deleteHeartrateByIdController,
    deleteHeartrateByConditionController,
    deleteAllDataDeviceDocumentsController,
  } = require('../app/controllers/DeviceDataController');

const router = express.Router();

router.post('/upload', DeviceDataController.uploadIDDeviceController);
router.post('/userupload', DeviceDataController.uploadIDDeviceForUserController);
router.post('/create', DeviceDataController.createDeviceDataController);
router.post('/data', DeviceDataController.getDataFromDatabaseController);
router.post('/datasensor', DeviceDataController.getDataSensorFromDatabaseController);
router.post('/realtime', DeviceDataController.getRealTimeDataController);
router.delete('/delete', deleteAllDataDeviceDocumentsController);
router.delete('/:id', deleteHeartrateByIdController);
router.delete('/condition', deleteHeartrateByConditionController);

module.exports = router;