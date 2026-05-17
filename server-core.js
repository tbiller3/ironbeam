/**
 * IRONBEAM Server Core - runs inside Electron
 * Same logic as server.js but exported as a module
 * © 2025 IRONBEAM Technologies
 */
const express  = require('express');
const { WebSocketServer } = require('ws');
const multer   = require('multer');
const forge    = require('node-forge');
const https    = require('https');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const crypto   = require('crypto');

const PORT         = 7443;
const TRANSFER_DIR = path.join(os.homedir(), 'IronBeam');
const CERT_DIR     = path.join(TRANSFER_DIR, '.certs');
const CERT_FILE    = path.join(CERT_DIR, 'ironbeam-cert.pem');
const KEY_FILE     = path.join(CERT_DIR, 'ironbeam-key.pem');
const PROFILE_FILE = path.join(TRANSFER_DIR, 'IRONBEAM-Trust.mobileconfig');

let _server = null;
let _wss    = null;
let _phoneConnected = false;

const _fileReceivedCbs   = [];
const _phoneConnectedCbs = [];
const _phoneDisconnCbs   = [];

function getIp() {
  const nets = os.networkInterfaces();
  for (const n of Object.keys(nets))
    for (const i of nets[n])
      if (i.family === 'IPv4' && !i.internal) return i.address;
  return '127.0.0.1';
}

function generateCert(ip) {
  console.log('[IRONBEAM] Generating certificate for', ip);
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter  = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
  const attrs = [{ name:'commonName', value:'IRONBEAM' }, { name:'organizationName', value:'IRONBEAM Technologies' }, { name:'countryName', value:'CA' }];
  cert.setSubject(attrs); cert.setIssuer(attrs);
  cert.setExtensions([
    { name:'basicConstraints', cA:true },
    { name:'keyUsage', keyCertSign:true, digitalSignature:true, keyEncipherment:true },
    { name:'extKeyUsage', serverAuth:true },
    { name:'subjectAltName', altNames:[{ type:7, ip }, { type:7, ip:'127.0.0.1' }, { type:2, value:'localhost' }]},
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  fs.writeFileSync(CERT_FILE, forge.pki.certificateToPem(cert));
  fs.writeFileSync(KEY_FILE,  forge.pki.privateKeyToPem(keys.privateKey));
  console.log('[IRONBEAM] Certificate ready');
}

function generateProfile(ip) {
  const certPem = fs.readFileSync(CERT_FILE, 'utf8');
  const certB64 = certPem.replace(/-----BEGIN CERTIFICATE-----/g,'').replace(/-----END CERTIFICATE-----/g,'').replace(/\s/g,'');
  const u1 = crypto.randomUUID().toUpperCase(), u2 = crypto.randomUUID().toUpperCase();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>PayloadContent</key><array><dict>
    <key>PayloadCertificateFileName</key><string>ironbeam-ca.crt</string>
    <key>PayloadContent</key><data>${certB64}</data>
    <key>PayloadDisplayName</key><string>IRONBEAM Technologies</string>
    <key>PayloadIdentifier</key><string>ca.ironbeam.cert.${u1}</string>
    <key>PayloadOrganization</key><string>IRONBEAM Technologies</string>
    <key>PayloadType</key><string>com.apple.security.root</string>
    <key>PayloadUUID</key><string>${u1}</string>
    <key>PayloadVersion</key><integer>1</integer>
  </dict></array>
  <key>PayloadDisplayName</key><string>IRONBEAM Technologies</string>
  <key>PayloadIdentifier</key><string>ca.ironbeam.profile.${u2}</string>
  <key>PayloadOrganization</key><string>IRONBEAM Technologies</string>
  <key>PayloadRemovalDisallowed</key><false/>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadUUID</key><string>${u2}</string>
  <key>PayloadVersion</key><integer>1</integer>
</dict></plist>`;
  fs.writeFileSync(PROFILE_FILE, xml);
}

async function start() {
  [TRANSFER_DIR, CERT_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive:true }); });
  const ip = getIp();
  if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) generateCert(ip);
  generateProfile(ip);

  const expressApp = express();
  expressApp.use((req,res,next) => {
    res.header('Access-Control-Allow-Origin','*');
    res.header('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers','Content-Type');
    if (req.method==='OPTIONS') return res.sendStatus(200); next();
  });

  const phoneAppPath = path.join(__dirname, 'phone-app', 'index.html');
  expressApp.get('/', (req,res) => res.redirect('/phone'));
  expressApp.get('/phone', (req,res) => fs.existsSync(phoneAppPath) ? res.sendFile(phoneAppPath) : res.status(404).send('Phone app missing'));
  expressApp.get('/install', (req,res) => {
    if (fs.existsSync(PROFILE_FILE)) {
      res.setHeader('Content-Type','application/x-apple-aspen-config');
      res.setHeader('Content-Disposition','attachment; filename="IRONBEAM.mobileconfig"');
      res.sendFile(PROFILE_FILE);
    } else res.status(404).send('Profile not found');
  });
  expressApp.get('/ping', (req,res) => res.json({ status:'ok', name:os.hostname(), platform:process.platform, version:'1.0.0' }));
  expressApp.get('/files', (req,res) => {
    try {
      const files = fs.readdirSync(TRANSFER_DIR).filter(f => !f.startsWith('.') && !f.endsWith('.mobileconfig'))
        .map(n => { const s = fs.statSync(path.join(TRANSFER_DIR,n)); return { name:n, size:s.size, modified:s.mtimeMs }; })
        .sort((a,b) => b.modified - a.modified);
      res.json(files);
    } catch { res.json([]); }
  });
  expressApp.get('/files/:name', (req,res) => {
    const fp = path.join(TRANSFER_DIR, path.basename(req.params.name));
    if (fs.existsSync(fp)) res.download(fp); else res.status(404).json({ error:'Not found' });
  });

  const storage = multer.diskStorage({
    destination: (req,file,cb) => cb(null,TRANSFER_DIR),
    filename: (req,file,cb) => {
      const base = path.basename(file.originalname, path.extname(file.originalname));
      const ext  = path.extname(file.originalname);
      const dest = path.join(TRANSFER_DIR, file.originalname);
      cb(null, fs.existsSync(dest) ? `${base}_${Date.now()}${ext}` : file.originalname);
    },
  });
  const upload = multer({ storage });
  expressApp.post('/upload', upload.single('file'), (req,res) => {
    if (!req.file) return res.status(400).json({ error:'No file' });
    const info = { name:req.file.filename, size:req.file.size, path:req.file.path };
    console.log('[IRONBEAM] Received:', info.name, fmt(info.size));
    _fileReceivedCbs.forEach(cb => cb(info));
    _wss?.clients.forEach(c => c.readyState===1 && c.send(JSON.stringify({ event:'file-received', ...info })));
    res.json({ ok:true, file:info });
  });

  expressApp.delete('/files/:name', (req,res) => {
    const fp = path.join(TRANSFER_DIR, path.basename(req.params.name));
    try { fs.unlinkSync(fp); res.json({ ok:true }); } catch { res.status(404).json({ error:'Not found' }); }
  });

  const sslOpts = { key: fs.readFileSync(KEY_FILE), cert: fs.readFileSync(CERT_FILE) };
  _server = https.createServer(sslOpts, expressApp);
  _wss    = new WebSocketServer({ noServer:true });

  _server.on('upgrade', (req,sock,head) => _wss.handleUpgrade(req,sock,head, ws => _wss.emit('connection', ws, req)));
  _wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log('[IRONBEAM] Phone connected from', clientIp);
    _phoneConnected = true;
    _phoneConnectedCbs.forEach(cb => cb(clientIp));
    ws.send(JSON.stringify({ event:'connected', host:os.hostname() }));
    ws.on('close', () => {
      _phoneConnected = false;
      _phoneDisconnCbs.forEach(cb => cb());
      console.log('[IRONBEAM] Phone disconnected');
    });
    ws.on('error', () => {});
  });

  return new Promise((resolve, reject) => {
    _server.listen(PORT, '0.0.0.0', () => {
      console.log(`[IRONBEAM] Server ready on https://${ip}:${PORT}`);
      resolve();
    });
    _server.on('error', e => {
      if (e.code === 'EADDRINUSE') {
        console.log('[IRONBEAM] Port already in use — server may already be running');
        resolve(); // Don't crash the app
      } else reject(e);
    });
  });
}

function stop() { _server?.close(); }
function isConnected() { return _phoneConnected; }
function onFileReceived(cb)    { _fileReceivedCbs.push(cb); }
function onPhoneConnected(cb)  { _phoneConnectedCbs.push(cb); }
function onPhoneDisconnected(cb) { _phoneDisconnCbs.push(cb); }
function fmt(b) { if(b<1024)return b+' B'; if(b<1048576)return Math.round(b/1024)+' KB'; return(b/1048576).toFixed(1)+' MB'; }

module.exports = { start, stop, isConnected, onFileReceived, onPhoneConnected, onPhoneDisconnected };
