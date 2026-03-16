/**
 * Install DICT Network Bridge Agent as Windows Service
 */

const Service = require('node-windows').Service;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   DICT Network Bridge Agent - Service Installer           ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Prompt for configuration
rl.question('Enter Railway URL (default: https://dict-logbook.up.railway.app): ', (railwayUrl) => {
  const url = railwayUrl.trim() || 'https://dict-logbook.up.railway.app';
  
  rl.question('Enter Agent Key (get this from your admin): ', (agentKey) => {
    if (!agentKey || agentKey.trim() === '') {
      console.error('\n❌ Agent Key is required!');
      rl.close();
      process.exit(1);
    }

    rl.close();

    console.log('\n📦 Installing service...');

    // Create a new service object
    const svc = new Service({
      name: 'DICT Network Bridge',
      description: 'Network scanning bridge for DICT Logbook system',
      script: path.join(__dirname, 'network-bridge-agent.js'),
      nodeOptions: [],
      env: [
        {
          name: 'RAILWAY_URL',
          value: url
        },
        {
          name: 'AGENT_KEY',
          value: agentKey.trim()
        }
      ]
    });

    // Listen for the "install" event
    svc.on('install', () => {
      console.log('✅ Service installed successfully!');
      console.log('🚀 Starting service...');
      svc.start();
    });

    // Listen for the "start" event
    svc.on('start', () => {
      console.log('✅ Service started successfully!\n');
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║  Bridge agent is now running in the background            ║');
      console.log('║  It will start automatically when Windows boots           ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');
      console.log('Configuration:');
      console.log(`  Railway URL: ${url}`);
      console.log(`  Agent Key: ${agentKey.substring(0, 8)}...`);
      console.log('\nYou can now close this window.');
      console.log('To uninstall: npm run uninstall-service\n');
    });

    // Listen for errors
    svc.on('error', (err) => {
      console.error('❌ Service installation failed:', err);
    });

    // Install the service
    svc.install();
  });
});
