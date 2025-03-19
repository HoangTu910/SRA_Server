const DeviceDataService = require('../services/DeviceDataService');

const {
  deleteHeartrateById,
  deleteHeartrateByCondition,
  deleteAllDataDeviceDocuments,
  getDataFromDatabase,
  createDeviceInFirestore,
} = require('../services/DeviceDataService');

exports.createDeviceDataController = async (req, res) => {
  try {
    const deviceData = req.body;
    const docId = await DeviceDataService.createDeviceData(deviceData);
    res.status(200).send({ id: docId });
  } catch (error) {
    res.status(500).send({ message: 'Failed to create record', error: error.message });
  }
};

exports.deleteHeartrateByIdController = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteHeartrateById(id);
    res.status(200).send({ message: `Document with ID ${id} deleted successfully.` });
  } catch (error) {
    res.status(500).send({ error: 'Failed to delete document' });
  }
};

exports.deleteHeartrateByConditionController = async (req, res) => {
  try {
    const { condition } = req.body;
    await deleteHeartrateByCondition(condition);
    res.status(200).send({ message: 'Documents deleted successfully.' });
  } catch (error) {
    res.status(500).send({ error: 'Failed to delete documents' });
  }
};

exports.deleteAllDataDeviceDocumentsController = async (req, res) => {
  try {
    await deleteAllDataDeviceDocuments();
    res.status(200).send({ message: 'All documents deleted successfully.' });
  } catch (error) {
    res.status(500).send({ error: 'Failed to delete all documents' });
  }
};

exports.getDataFromDatabaseController = async (req, res) => {
  try {
    const { userId } = req.body;
    console.log('Received userId:', userId); // Log the userId to verify it is being received correctly

    const deviceData = await getDataFromDatabase(userId);
    console.log('Fetched device data:', deviceData); // Log the entire fetched data to verify its structure

    // if (!deviceData || !deviceData.deviceId) {
    //   return res.status(404).json({ message: 'Device not found' });
    // }

    res.json({ deviceData });
  } catch (error) {
    console.error('Error fetching data from database:', error);
    res.status(500).send('Server error');
  }
};

exports.uploadIDDeviceController = async(req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID is required' });
  }

  try {
    await createDeviceInFirestore(deviceId);
    res.status(200).json({ message: 'Device created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error creating document' });
  }
}

exports.uploadIDDeviceForUserController = async(req, res) => {
  const { deviceId, userId } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID is required' });
  }

  try {
    await DeviceDataService.uploadDeviceInUser(userId, deviceId);
    res.status(200).json({ message: 'Device created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error creating document' });
  }
} 

exports.getDataSensorFromDatabaseController = async(req, res) => {
  try {
    const { deviceId } = req.body;
    
    const deviceData = await DeviceDataService.getDataSensorFromDatabase(deviceId);
    res.json({ total: deviceData });
  } catch (error) {
    
    res.status(500).send('Server error');
  }
}

  exports.getRealTimeDataController = async (req, res) => {
    try {
      const { deviceId } = req.body;
  
      DeviceDataService.getRealTimeData(deviceId, (error, data) => {
        if (error) {
          return res.status(500).json({ error });
        }
        return res.json(data);
      });
    } catch (err) {
      console.error('Error in getRealTimeData controller:', err);
      res.status(500).send('Server error');
    }
  };