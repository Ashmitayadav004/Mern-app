const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/cases',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer mock'
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', data));
});
req.write(JSON.stringify({device_brand: 'WD'}));
req.end();
