# Bridge Agent Connected But Scan Not Working - Debug Guide

## Situation
- ✅ Bridge agent test passes (`node test-bridge.js` shows success)
- ❌ Network scan from admin panel doesn't work
- ❌ No computers are detected

## Diagnosis Steps

### Step 1: Verify Bridge Service is Running

```powershell
# Check service status
Get-Service "DICT Network Bridge"
```

**Expected:** Status = Running

**If stopped:**
```powershell
Start-Service "DICT Network Bridge"
```

---

### Step 2: Test Complete Scan Flow

**Run this to test the entire process:**

```powershell
cd C:\Users\actal\Documents\Logging_System\bridge-agent
$env:RAILWAY_URL = "https://dict-logbook.up.railway.app"
$env:AGENT_KEY = "Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK"
node test-scan-flow.js
```

This will:
1. Test bridge connection
2. Create a scan request
3. Verify bridge can see it
4. Submit mock results
5. Verify admin panel can retrieve results

**If this passes:** The API works, issue is with the bridge agent service.

**If this fails:** Shows exactly where the flow breaks.

---

### Step 3: Run Bridge Agent Manually to See Live Activity

**Stop the service and run manually:**

```powershell
# Stop service
Stop-Service "DICT Network Bridge"

# Run manually to see output
cd C:\Users\actal\Documents\Logging_System\bridge-agent
$env:RAILWAY_URL = "https://dict-logbook.up.railway.app"
$env:AGENT_KEY = "Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK"
node network-bridge-agent.js
```

**Keep this window open.**

**Now test scan from admin panel:**
1. Go to https://dict-logbook.up.railway.app/admin
2. Network tab → Network Scanner
3. Base IP: `192.168.1`
4. Start: `1`, End: `5`
5. Click "Scan Network"

**Watch PowerShell window - you should see:**
```
📡 Scan request received: scan_1234567890_abc
   IPs to scan: 5
   Scanning...
   Progress: 5/5 IPs scanned
   ✅ Scan complete: X alive, Y offline
   📤 Sending results to Railway...
   ✅ Results submitted successfully
```

**If you see this:** Bridge works! Restart service and it should work.

**If you see nothing:** Bridge is not picking up the scan request.

---

### Step 4: Check Admin Panel Network Tab

**Open browser console (F12) on admin panel and run:**

```javascript
// Test creating scan request
fetch('/api/network/bridge/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ baseIp: '192.168.1', start: 1, end: 5 })
}).then(r => r.json()).then(console.log)
```

**Expected response:**
```json
{
  "success": true,
  "requestId": "scan_1234567890_abc",
  "message": "Scan request queued...",
  "ipsToScan": 5
}
```

**If you get error:** Admin panel can't create scan requests.

---

## Common Issues

### Issue 1: Bridge service running but not polling

**Cause:** Service installed with wrong environment variables

**Fix:**
```powershell
# Uninstall service
cd C:\Users\actal\Documents\Logging_System\bridge-agent
npm run uninstall-service

# Reinstall with correct config
npm run install-service

# When prompted:
# Railway URL: Press Enter
# Agent Key: Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK
```

---

### Issue 2: Scan request created but bridge doesn't see it

**Cause:** Database connection issue or polling not working

**Test:**
```powershell
# Run bridge manually and watch for polling activity
node network-bridge-agent.js
```

You should see it polling every 5 seconds.

---

### Issue 3: Bridge scans but results don't appear

**Possible causes:**
1. Results not being submitted properly
2. Admin panel not polling for results
3. Request ID mismatch

**Check browser console for errors** when scanning.

---

### Issue 4: "Scan timeout" message

**Cause:** Bridge agent not running or not processing requests

**Fix:**
1. Verify service is running: `Get-Service "DICT Network Bridge"`
2. Run manually to see what's happening
3. Check Windows Event Logs for errors

---

## Network Configuration Issues

### Your network might be different

**Check your actual network:**

```powershell
ipconfig
```

Look for "IPv4 Address" - example: `192.168.100.50`

**If your network is NOT 192.168.1.x:**
- Use the first 3 numbers from your IP
- Example: If your IP is `192.168.100.50`, use base IP `192.168.100`

---

### Firewall might be blocking ping

**On computers you want to detect:**

1. Open **Windows Defender Firewall**
2. Click **Advanced settings**
3. **Inbound Rules**
4. Find "File and Printer Sharing (Echo Request - ICMPv4-In)"
5. **Enable** the rule
6. Try scanning again

---

## Quick Diagnostic

**Run all these commands and share the output:**

```powershell
# 1. Service status
Get-Service "DICT Network Bridge"

# 2. Test connection
cd C:\Users\actal\Documents\Logging_System\bridge-agent
$env:RAILWAY_URL = "https://dict-logbook.up.railway.app"
$env:AGENT_KEY = "Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK"
node test-bridge.js

# 3. Test scan flow
node test-scan-flow.js

# 4. Check your network
ipconfig | Select-String "IPv4"
```

---

## Most Likely Issues

1. **Bridge service not actually running**
   - Check: `Get-Service "DICT Network Bridge"`
   - Fix: `Start-Service "DICT Network Bridge"`

2. **Wrong network range**
   - Check: `ipconfig` to see your actual network
   - Fix: Use correct base IP in scanner

3. **Firewall blocking ping**
   - Fix: Enable ICMP on target computers

4. **Service installed with wrong config**
   - Fix: Uninstall and reinstall service

---

## Next Steps

**Please run these and tell me the results:**

```powershell
# Test 1: Service status
Get-Service "DICT Network Bridge"

# Test 2: Scan flow test
cd C:\Users\actal\Documents\Logging_System\bridge-agent
$env:RAILWAY_URL = "https://dict-logbook.up.railway.app"
$env:AGENT_KEY = "Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK"
node test-scan-flow.js

# Test 3: Your network
ipconfig | Select-String "IPv4"
```

This will help me identify exactly where the issue is.
