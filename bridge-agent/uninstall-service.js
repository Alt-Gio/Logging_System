/**
 * Uninstall DICT Network Bridge Agent Windows Service
 */

const Service = require('node-windows').Service;
const path = require('path');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   DICT Network Bridge Agent - Service Uninstaller         ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Create a new service object
const svc = new Service({
  name: 'DICT Network Bridge',
  script: path.join(__dirname, 'network-bridge-agent.js')
});

// Listen for the "uninstall" event
svc.on('uninstall', () => {
  console.log('✅ Service uninstalled successfully!\n');
  console.log('The bridge agent has been removed from your system.');
});

// Listen for errors
svc.on('error', (err) => {
  console.error('❌ Uninstall failed:', err);
});

// Uninstall the service
console.log('🗑️  Uninstalling service...');
svc.uninstall();
