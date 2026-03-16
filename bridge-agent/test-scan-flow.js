/**
 * Test the complete scan flow to diagnose where it's failing
 */

const https = require('https');

const RAILWAY_URL = process.env.RAILWAY_URL || 'https://dict-logbook.up.railway.app';
const AGENT_KEY = process.env.AGENT_KEY || 'Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK';

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        Bridge Agent Scan Flow Test                        ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, RAILWAY_URL);
    const protocol = https;
    
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 443,
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
          resolve({ 
            ok: res.statusCode >= 200 && res.statusCode < 300, 
            data: JSON.parse(data), 
            status: res.statusCode 
          });
        } catch {
          resolve({ ok: false, data: null, status: res.statusCode, rawData: data });
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

async function test() {
  try {
    console.log('Step 1: Testing bridge connection...');
    const pollRes = await makeRequest('/api/network/bridge/poll');
    
    if (!pollRes.ok) {
      console.error('❌ Bridge connection failed!');
      console.error(`   Status: ${pollRes.status}`);
      console.error(`   Response:`, pollRes.data || pollRes.rawData);
      return;
    }
    
    console.log('✅ Bridge connection successful');
    console.log(`   Current scan request:`, pollRes.data.scanRequest || 'None');
    
    console.log('\nStep 2: Creating a test scan request...');
    const scanRes = await makeRequest('/api/network/bridge/scan', {
      method: 'POST',
      body: {
        baseIp: '192.168.1',
        start: 1,
        end: 5
      }
    });
    
    if (!scanRes.ok) {
      console.error('❌ Failed to create scan request!');
      console.error(`   Status: ${scanRes.status}`);
      console.error(`   Response:`, scanRes.data);
      return;
    }
    
    console.log('✅ Scan request created');
    console.log(`   Request ID: ${scanRes.data.requestId}`);
    console.log(`   IPs to scan: ${scanRes.data.ipsToScan}`);
    
    const requestId = scanRes.data.requestId;
    
    console.log('\nStep 3: Checking if bridge can see the request...');
    const pollRes2 = await makeRequest('/api/network/bridge/poll');
    
    if (pollRes2.data.scanRequest) {
      console.log('✅ Bridge can see the scan request!');
      console.log(`   Request ID: ${pollRes2.data.scanRequest.id}`);
      console.log(`   IPs: ${pollRes2.data.scanRequest.ips.length} addresses`);
    } else {
      console.error('❌ Bridge cannot see the scan request!');
      console.error('   This means the request was not stored properly in the database.');
      return;
    }
    
    console.log('\nStep 4: Simulating bridge agent processing...');
    console.log('   (In real scenario, bridge agent would ping these IPs)');
    
    // Simulate results
    const mockResults = [
      { ip: '192.168.1.1', alive: true, responseTime: 10 },
      { ip: '192.168.1.2', alive: false, responseTime: null },
      { ip: '192.168.1.3', alive: true, responseTime: 15 },
      { ip: '192.168.1.4', alive: false, responseTime: null },
      { ip: '192.168.1.5', alive: true, responseTime: 8 },
    ];
    
    console.log('\nStep 5: Submitting results...');
    const submitRes = await makeRequest('/api/network/bridge/results', {
      method: 'POST',
      body: {
        requestId: requestId,
        results: mockResults
      }
    });
    
    if (!submitRes.ok) {
      console.error('❌ Failed to submit results!');
      console.error(`   Status: ${submitRes.status}`);
      console.error(`   Response:`, submitRes.data);
      return;
    }
    
    console.log('✅ Results submitted successfully');
    
    console.log('\nStep 6: Checking if admin panel can retrieve results...');
    const resultsRes = await makeRequest(`/api/network/bridge/scan?requestId=${requestId}`);
    
    if (!resultsRes.ok) {
      console.error('❌ Failed to retrieve results!');
      console.error(`   Status: ${resultsRes.status}`);
      console.error(`   Response:`, resultsRes.data);
      return;
    }
    
    if (resultsRes.data.completed) {
      console.log('✅ Results retrieved successfully!');
      console.log(`   Found ${resultsRes.data.results.filter(r => r.alive).length} alive devices`);
      console.log(`   Results:`, resultsRes.data.results);
    } else {
      console.error('❌ Results not marked as completed!');
      console.error(`   Response:`, resultsRes.data);
      return;
    }
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ ALL TESTS PASSED - Scan flow is working correctly!   ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('The bridge agent should now work when you scan from admin panel.');
    console.log('Make sure the bridge service is running: Get-Service "DICT Network Bridge"\n');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

test();
