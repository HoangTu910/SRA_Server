const deviceDataRoute = require('./DeviceData')
const authRoute = require('./Authentication')
const bodyParser = require('body-parser');
const cors = require('cors');

function route(app){
    app.use('/api/user', authRoute)
    app.use('/api/devices', deviceDataRoute)
}

module.exports = route