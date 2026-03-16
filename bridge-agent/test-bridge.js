/**
 * Test script to verify bridge agent can connect to Railway
 * Run this before installing as service to diagnose issues
 */

const https = require('https');

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dict-logbook.up.railway.app';
const AGENT_KEY = process.env.AGENT_KEY || 'Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        Bridge Agent Connection Test                       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log(`Railway URL: ${RAILWAY_URL}`);
console.log(`Agent Key: ${AGENT_KEY.substring(0, 8)}...${AGENT_KEY.substring(AGENT_KEY.length - 4)}\n`);

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, RAILWAY_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AGENT_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    console.log(`\n📡 Testing connection to: ${url.href}`);
    console.log(`   Method: GET`);
    console.log(`   Headers: Authorization: Bearer ${AGENT_KEY.substring(0, 8)}...`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`\n✅ Response received:`);
        console.log(`   Status: ${res.statusCode}`);
        console.log(`   Headers:`, res.headers);
        console.log(`   Body:`, data);
        
        try {
          const parsed = JSON.parse(data);
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: parsed, status: res.statusCode });
        } catch {
          resolve({ ok: false, data: null, status: res.statusCode, rawData: data });
        }
      });
    });

    req.on('error', (error) => {
      console.error(`\n❌ Request failed:`, error.message);
      reject(error);
    });

    req.end();
  });
}

async function test() {
  try {
    console.log('\n🔍 Step 1: Testing connection to Railway...');
    const response = await makeRequest('/api/network/bridge/poll');
    
    if (response.ok) {
      console.log('\n✅ SUCCESS! Bridge agent can connect to Railway.');
      console.log('   The API is working correctly.');
      if (response.data && response.data.scanRequest) {
        console.log('   📋 Found pending scan request:', response.data.scanRequest);
      } else {
        console.log('   📋 No pending scan requests (this is normal).');
      }
      console.log('\n✅ You can now install the bridge agent as a service.');
      console.log('   Run: npm run install-service\n');
    } else if (response.status === 401) {
      console.error('\n❌ AUTHENTICATION FAILED!');
      console.error('   The agent key does not match the key set in Railway.');
      console.error('\n   Solutions:');
      console.error('   1. Check Railway dashboard → Variables → NETWORK_BRIDGE_KEY');
      console.error('   2. Make sure it matches: ' + AGENT_KEY);
      console.error('   3. If you just added it, wait 1-2 minutes for Railway to redeploy\n');
    } else {
      console.error('\n❌ UNEXPECTED RESPONSE!');
      console.error(`   Status: ${response.status}`);
      console.error(`   Data:`, response.data || response.rawData);
      console.error('\n   This might be a deployment issue. Check Railway logs.\n');
    }
  } catch (error) {
    console.error('\n❌ CONNECTION FAILED!');
    console.error('   Error:', error.message);
    console.error('\n   Possible causes:');
    console.error('   1. No internet connection');
    console.error('   2. Firewall blocking HTTPS (port 443)');
    console.error('   3. Wrong Railway URL');
    console.error('   4. Railway is down\n');
  }
}

test();
