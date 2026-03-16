#!/usr/bin/env node
/**
 * DICT Network Bridge Agent
 * Lightweight service that runs on one office PC to enable network scanning from Railway
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const https = require('https');
const http = require('http');

const execAsync = promisify(exec);

// Configuration
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dict-logbook.up.railway.app';
const AGENT_KEY = process.env.AGENT_KEY || 'change-this-key';
const POLL_INTERVAL = 5000; // Poll every 5 seconds

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        DICT Network Bridge Agent v1.0                      ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log(`Railway URL: ${RAILWAY_URL}`);
console.log(`Poll Interval: ${POLL_INTERVAL}ms`);
console.log('Starting bridge agent...\n');

/**
 * Ping a single host
 */
async function pingHost(ip) {
  const start = Date.now();
  try {
    const isWindows = process.platform === 'win32';
    const cmd = isWindows
      ? `ping -n 1 -w 1000 ${ip}`
      : `ping -c 1 -W 1 ${ip}`;
    
    await execAsync(cmd, { timeout: 3000 });
    const responseTime = Date.now() - start;
    return { ip, alive: true, responseTime };
  } catch {
    return { ip, alive: false, responseTime: null };
  }
}

/**
 * Make HTTP request to Railway
 */
function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, RAILWAY_URL);
    const protocol = url.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${AGENT_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = protocol.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: JSON.parse(data), status: res.statusCode });
        } catch {
          resolve({ ok: false, data: null, status: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

/**
 * Poll Railway for pending scan requests
 */
async function pollForRequests() {
  try {
    const response = await makeRequest('/api/network/bridge/poll');
    
    if (!response.ok) {
      if (response.status === 401) {
        console.error('❌ Authentication failed. Check your AGENT_KEY.');
      }
      return;
    }

    const { scanRequest } = response.data;
    
    if (scanRequest) {
      console.log(`\n📡 Scan request received: ${scanRequest.id}`);
      console.log(`   IPs to scan: ${scanRequest.ips.length}`);
      console.log(`   Scanning...`);
      
      const startTime = Date.now();
      
      // Scan all IPs in parallel (batches of 10 for performance)
      const results = [];
      const batchSize = 10;
      
      for (let i = 0; i < scanRequest.ips.length; i += batchSize) {
        const batch = scanRequest.ips.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(ip => pingHost(ip)));
        results.push(...batchResults);
        
        const progress = Math.min(i + batchSize, scanRequest.ips.length);
        process.stdout.write(`\r   Progress: ${progress}/${scanRequest.ips.length} IPs scanned`);
      }
      
      const aliveCount = results.filter(r => r.alive).length;
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`\n   ✅ Scan complete: ${aliveCount} alive, ${results.length - aliveCount} offline (${duration}s)`);
      
      // Send results back to Railway
      console.log(`   📤 Sending results to Railway...`);
      const submitResponse = await makeRequest('/api/network/bridge/results', {
        method: 'POST',
        body: { requestId: scanRequest.id, results }
      });
      
      if (submitResponse.ok) {
        console.log(`   ✅ Results submitted successfully\n`);
      } else {
        console.error(`   ❌ Failed to submit results\n`);
      }
    }
  } catch (error) {
    console.error('❌ Poll error:', error.message);
  }
}

/**
 * Health check
 */
async function healthCheck() {
  try {
    const response = await makeRequest('/api/network/bridge/poll');
    if (response.ok) {
      console.log('✅ Connected to Railway successfully\n');
      return true;
    } else if (response.status === 401) {
      console.error('❌ Authentication failed. Please check your AGENT_KEY.\n');
      return false;
    }
  } catch (error) {
    console.error('❌ Cannot connect to Railway:', error.message);
    console.error('   Please check your internet connection and RAILWAY_URL.\n');
    return false;
  }
}

/**
 * Main loop
 */
async function main() {
  // Initial health check
  const healthy = await healthCheck();
  if (!healthy) {
    console.log('Retrying in 30 seconds...\n');
    setTimeout(main, 30000);
    return;
  }

  console.log(`🔄 Polling Railway every ${POLL_INTERVAL / 1000} seconds...`);
  console.log('   Waiting for scan requests...\n');

  // Start polling loop
  setInterval(pollForRequests, POLL_INTERVAL);
  
  // Also poll immediately
  pollForRequests();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Bridge agent shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Bridge agent shutting down...');
  process.exit(0);
});

// Start the agent
main();
