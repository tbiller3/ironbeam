/**
 * IRONBEAM Transfer Server v1.3
 * Pure HTTPS — no openssl required
 * Certificate generated in pure JavaScript via node-forge
 * © 2025 IRONBEAM Technologies — ironbeam.ca
 */

const express  = require('express');
const { WebSocketServer } = require('ws');
const multer   = require('multer');
const forge    = require('node-forge');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const https    = require('https');
const crypto   = require('crypto');

const PORT         = 7443;
const TRANSFER_DIR = path.join(os.homedir(), 'IronBeam');
const CERT_DIR     = path.join(TRANSFER_DIR, '.certs');
const CERT_FILE    = path.join(CERT_DIR, 'ironbeam-cert.pem');
const KEY_FILE     = path.join(CERT_DIR, 'ironbeam-key.pem');
const PROFILE_FILE = path.join(TRANSFER_DIR, 'IRONBEAM-Trust.mobileconfig');

// ── Directories ────────────────────────────────────────────────────────────
[TRANSFER_DIR, CERT_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Get local IP ───────────────────────────────────────────────────────────
function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets))
    for (const n of nets[name])
      if (n.family === 'IPv4' && !n.internal) return n.address;
  return '127.0.0.1';
}

// ── Generate self-signed cert using node-forge (pure JS, no openssl) ───────
function generateCert(ip) {
  console.log('  Generating HTTPS certificate for', ip, '(one-time)...');
  try {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = Date.now().toString(16);
    cert.validity.notBefore = new Date();
    cert.validity.notAfter  = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

    const attrs = [
      { name: 'commonName',        value: 'IRONBEAM'              },
      { name: 'organizationName',  value: 'IRONBEAM Technologies' },
      { name: 'countryName',       value: 'CA'                    },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage',
        keyCertSign: true, digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: [
        { type: 7, ip: ip        },
        { type: 7, ip: '127.0.0.1' },
        { type: 2, value: 'localhost' },
      ]},
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    fs.writeFileSync(CERT_FILE, forge.pki.certificateToPem(cert));
    fs.writeFileSync(KEY_FILE,  forge.pki.privateKeyToPem(keys.privateKey));
    console.log('  Certificate ready.\n');
    return true;
  } catch (e) {
    console.error('  Certificate generation failed:', e.message);
    return false;
  }
}

// ── Generate Apple .mobileconfig so iPhone can install cert via AirDrop ───
function generateMobileConfig(ip) {
  try {
    const certPem = fs.readFileSync(CERT_FILE, 'utf8');
    const certB64 = certPem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');

    const uuid1 = crypto.randomUUID().toUpperCase();
    const uuid2 = crypto.randomUUID().toUpperCase();

    const config = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadCertificateFileName</key>
      <string>ironbeam-ca.crt</string>
      <key>PayloadContent</key>
      <data>${certB64}</data>
      <key>PayloadDescription</key>
      <string>IRONBEAM Technologies Local Certificate</string>
      <key>PayloadDisplayName</key>
      <string>IRONBEAM Technologies</string>
      <key>PayloadIdentifier</key>
      <string>ca.ironbeam.cert.${uuid1}</string>
      <key>PayloadOrganization</key>
      <string>IRONBEAM Technologies</string>
      <key>PayloadType</key>
      <string>com.apple.security.root</string>
      <key>PayloadUUID</key>
      <string>${uuid1}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Trusts IRONBEAM local transfer server at ${ip}</string>
  <key>PayloadDisplayName</key>
  <string>IRONBEAM Technologies</string>
  <key>PayloadIdentifier</key>
  <string>ca.ironbeam.profile.${uuid2}</string>
  <key>PayloadOrganization</key>
  <string>IRONBEAM Technologies</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${uuid2}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

    fs.writeFileSync(PROFILE_FILE, config);
    console.log('  Apple profile saved to IronBeam folder.\n');
  } catch(e) {
    console.log('  Could not generate mobileconfig:', e.message);
  }
}

// ── Setup cert ─────────────────────────────────────────────────────────────
const LOCAL_IP = getLocalIp();
if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
  const ok = generateCert(LOCAL_IP);
  if (!ok) { console.error('\n  Cannot start without a certificate.\n'); process.exit(1); }
}
generateMobileConfig(LOCAL_IP);

// ── Express app ────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Phone app
const phoneAppPath = path.join(__dirname, 'phone-app', 'index.html');
app.get('/',      (req, res) => res.redirect('/phone'));
app.get('/phone', (req, res) => {
  if (fs.existsSync(phoneAppPath)) res.sendFile(phoneAppPath);
  else res.status(404).send('Phone app not found');
});

// Serve mobileconfig for AirDrop install
app.get('/install', (req, res) => {
  if (fs.existsSync(PROFILE_FILE)) {
    res.setHeader('Content-Type', 'application/x-apple-aspen-config');
    res.setHeader('Content-Disposition', 'attachment; filename="IRONBEAM.mobileconfig"');
    res.sendFile(PROFILE_FILE);
  } else res.status(404).send('Profile not found');
});

// API
app.get('/ping', (req, res) => res.json({
  status: 'ok', name: os.hostname(), platform: process.platform, version: '1.3.0',
}));

app.get('/files', (req, res) => {
  try {
    const files = fs.readdirSync(TRANSFER_DIR)
      .filter(f => !f.startsWith('.') && !f.endsWith('.mobileconfig'))
      .map(name => {
        const st = fs.statSync(path.join(TRANSFER_DIR, name));
        return { name, size: st.size, modified: st.mtimeMs };
      })
      .sort((a, b) => b.modified - a.modified);
    res.json(files);
  } catch { res.json([]); }
});

app.get('/files/:name', (req, res) => {
  const fp = path.join(TRANSFER_DIR, path.basename(req.params.name));
  if (fs.existsSync(fp)) res.download(fp);
  else res.status(404).json({ error: 'Not found' });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TRANSFER_DIR),
  filename: (req, file, cb) => {
    const base = path.basename(file.originalname, path.extname(file.originalname));
    const ext  = path.extname(file.originalname);
    const dest = path.join(TRANSFER_DIR, file.originalname);
    cb(null, fs.existsSync(dest) ? `${base}_${Date.now()}${ext}` : file.originalname);
  },
});
const upload = multer({ storage });

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const info = { name: req.file.filename, size: req.file.size };
  console.log('\n  ✓ Received:', info.name, '(' + fmt(info.size) + ')');
  wss.clients.forEach(c => c.readyState === 1 &&
    c.send(JSON.stringify({ event: 'file-received', ...info })));
  res.json({ ok: true, file: info });
});

app.delete('/files/:name', (req, res) => {
  const fp = path.join(TRANSFER_DIR, path.basename(req.params.name));
  try { fs.unlinkSync(fp); res.json({ ok: true }); }
  catch { res.status(404).json({ error: 'Not found' }); }
});

// ── HTTPS server ───────────────────────────────────────────────────────────
const sslOpts = {
  key:  fs.readFileSync(KEY_FILE),
  cert: fs.readFileSync(CERT_FILE),
};

const server = https.createServer(sslOpts, app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, sock, head) => {
  wss.handleUpgrade(req, sock, head, ws => wss.emit('connection', ws, req));
});
wss.on('connection', (ws, req) => {
  console.log('  📱 Phone connected from', req.socket.remoteAddress);
  ws.send(JSON.stringify({ event: 'connected', host: os.hostname() }));
  ws.on('close', () => console.log('  📵 Phone disconnected'));
  ws.on('error', () => {});
});

// ── Start ──────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const appUrl = `https://${LOCAL_IP}:${PORT}/phone`;
  console.log('\n');
  console.log('  ╔═══════════════════════════════════════════════════════════╗');
  console.log('  ║        IRONBEAM Transfer Server  v1.3  — READY           ║');
  console.log('  ╠═══════════════════════════════════════════════════════════╣');
  console.log('  ║                                                           ║');
  console.log('  ║  STEP 1 — Install cert on iPhone (one-time only):        ║');
  console.log('  ║  Open IronBeam folder → AirDrop IRONBEAM-Trust.          ║');
  console.log('  ║  mobileconfig to your iPhone → Install in Settings       ║');
  console.log('  ║                                                           ║');
  console.log('  ║  Transfer folder (auto-opened):                          ║');
  console.log('  ║  ' + TRANSFER_DIR.padEnd(57) + '║');
  console.log('  ║                                                           ║');
  console.log('  ╠═══════════════════════════════════════════════════════════╣');
  console.log('  ║                                                           ║');
  console.log('  ║  STEP 2 — Open on iPhone Safari:                        ║');
  console.log('  ║  ' + appUrl.padEnd(57) + '║');
  console.log('  ║                                                           ║');
  console.log('  ║  Enter IP: ' + LOCAL_IP.padEnd(46) + '║');
  console.log('  ║                                                           ║');
  console.log('  ╠═══════════════════════════════════════════════════════════╣');
  console.log('  ║  Waiting for connections...         Ctrl+C to stop       ║');
  console.log('  ╚═══════════════════════════════════════════════════════════╝\n');

  // Auto-open IronBeam folder
  try {
    require('child_process').exec(
      process.platform === 'win32' ? `explorer "${TRANSFER_DIR}"` : `open "${TRANSFER_DIR}"`
    );
  } catch {}
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE')
    console.error(`\n  Port ${PORT} in use — close the other IRONBEAM window\n`);
  else
    console.error('  Server error:', e.message);
  process.exit(1);
});

function fmt(b) {
  if (!b) return '–';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return Math.round(b/1024) + ' KB';
  if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB';
  return (b/1073741824).toFixed(2) + ' GB';
}

process.on('SIGINT', () => { console.log('\n  IRONBEAM stopped.\n'); process.exit(0); });
