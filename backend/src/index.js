const express = require('express');
const app = express();
const port = 7979;
const cors = require('cors');
const bodyParser = require('body-parser');
const route = require("./routes");
const mqttService = require('./app/services/MqttService');

app.use(bodyParser.json());
app.use(cors());
app.use(express.json());

mqttService.initMQTT();

route(app);

// Test route
// app.use("/test", (req, res) => {
//     console.log("Hello world");
//     res.send("Hello world");
// });

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});
