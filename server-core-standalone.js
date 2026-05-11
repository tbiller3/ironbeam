/**
 * IRONBEAM Standalone Server
 * Runs when Electron is not yet installed
 */
const os = require('os');
function getIp() {
  const nets = os.networkInterfaces();
  for (const n of Object.keys(nets)) for (const i of nets[n]) if (i.family==='IPv4'&&!i.internal) return i.address;
  return '127.0.0.1';
}
const server = require('./server-core');
server.start().then(() => {
  const ip = getIp();
  console.log('\n');
  console.log('  ╔══════════════════════════════════════════════════════╗');
  console.log('  ║        IRONBEAM Transfer Server  v1.0                ║');
  console.log('  ╠══════════════════════════════════════════════════════╣');
  console.log('  ║                                                      ║');
  console.log('  ║  Open on iPhone Safari:                              ║');
  console.log('  ║  https://' + (ip+':7443/phone').padEnd(44) + '║');
  console.log('  ║                                                      ║');
  console.log('  ║  Transfer folder: ' + (require('os').homedir()+'\\IronBeam').padEnd(34) + '║');
  console.log('  ║                                                      ║');
  console.log('  ╚══════════════════════════════════════════════════════╝\n');
  try { require('child_process').exec('explorer "' + require('path').join(require('os').homedir(),'IronBeam') + '"'); } catch{}
});
process.on('SIGINT', () => { server.stop(); process.exit(0); });
