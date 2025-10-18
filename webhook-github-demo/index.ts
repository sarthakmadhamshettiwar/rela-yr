const express = require('express');

const app = express();

app.use(express.json()); // if we don't use this, we won't be able to parse the body of the request and our JSON request will be undefined
// TODO: why so

app.post('/webhook', (req: any, res: any) => {
    console.log(req.body);
    res.sendStatus(200);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});