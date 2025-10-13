const https = require('http');
const data = JSON.stringify({ phoneNumber: '+15551234567', userId: 'test-user-1' });
const opts = { hostname: 'localhost', port: 5050, path: '/api/whatsapp/verify', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } };
const req = https.request(opts, (res) => { let buf=''; res.on('data', (c)=>buf+=c); res.on('end', () => { console.log('status', res.statusCode); console.log(buf); process.exit(0); }); });
req.on('error', (e)=>{ console.error('req error', e); process.exit(2); }); req.write(data); req.end();
