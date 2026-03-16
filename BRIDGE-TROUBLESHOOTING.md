# Bridge Agent Not Scanning - Troubleshooting Guide

## Quick Diagnosis Steps

### Step 1: Check if Railway has the Agent Key

**Most common issue:** NETWORK_BRIDGE_KEY not set in Railway

1. Go to **Railway Dashboard**
2. Select your **dict-logbook** project
3. Click **Variables** tab
4. Look for `NETWORK_BRIDGE_KEY`

**If missing:**
- Click **+ New Variable**
- Name: `NETWORK_BRIDGE_KEY`
- Value: `Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK`
- Click **Add**
- Wait 2-3 minutes for Railway to redeploy

---

### Step 2: Test Bridge Agent Connection

**Before installing as service, test manually:**

```powershell
# Open PowerShell (not as admin)
cd C:\Users\[YourName]\Documents\Logging_System\bridge-agent

# Set environment variables
$env:RAILWAY_URL = "https://dict-logbook.up.railway.app"
$env:AGENT_KEY = "Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK"

# Run test script
node test-bridge.js
```

**Expected output:**
```
✅ SUCCESS! Bridge agent can connect to Railway.
   The API is working correctly.
   📋 No pending scan requests (this is normal).
```

**If you see "AUTHENTICATION FAILED":**
- NETWORK_BRIDGE_KEY not set in Railway
- Or Railway hasn't redeployed yet (wait 2 minutes)

**If you see "CONNECTION FAILED":**
- Check internet connection
- Check firewall isn't blocking HTTPS

---

### Step 3: Check Service Status

**If service is installed:**

```powershell
# Check if service exists and is running
Get-Service "DICT Network Bridge"
```

**Expected output:**
```
Status   Name               DisplayName
------   ----               -----------
Running  DICT Network Br... DICT Network Bridge
```

**If status is "Stopped":**
```powershell
Start-Service "DICT Network Bridge"
```

**If service doesn't exist:**
```powershell
# Reinstall
cd C:\Users\[YourName]\Documents\Logging_System\bridge-agent
npm run install-service
```

---

### Step 4: Check Service Logs

**View recent logs:**

```powershell
# Get recent application logs
Get-EventLog -LogName Application -Source "DICT Network Bridge" -Newest 10
```

**Look for:**
- ✅ "Connected to Railway successfully"
- ❌ "Authentication failed" → Wrong agent key
- ❌ "Cannot connect" → Network/firewall issue

---

### Step 5: Test Manually (Without Service)

**Run bridge agent in PowerShell to see live output:**

```powershell
# Stop service first
Stop-Service "DICT Network Bridge"

# Navigate to bridge-agent folder
cd C:\Users\[YourName]\Documents\Logging_System\bridge-agent

# Set environment variables
$env:RAILWAY_URL = "https://dict-logbook.up.railway.app"
$env:AGENT_KEY = "Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK"

# Run agent manually
node network-bridge-agent.js
```

**You should see:**
```
╔════════════════════════════════════════════════════════════╗
║        DICT Network Bridge Agent v1.0                      ║
╚════════════════════════════════════════════════════════════╝
Railway URL: https://dict-logbook.up.railway.app
Poll Interval: 5000ms
Starting bridge agent...

✅ Connected to Railway successfully

🔄 Polling Railway every 5 seconds...
   Waiting for scan requests...
```

**Now test scan from admin panel:**
1. Go to https://dict-logbook.up.railway.app/admin
2. Network tab → Network Scanner
3. Click "Scan Network"
4. Watch PowerShell window for activity

**You should see:**
```
📡 Scan request received: scan_1234567890_abc123
   IPs to scan: 30
   Scanning...
   Progress: 30/30 IPs scanned
   ✅ Scan complete: 5 alive, 25 offline (3.2s)
   📤 Sending results to Railway...
   ✅ Results submitted successfully
```

**If you see this, the bridge works!** Stop it (Ctrl+C) and restart the service:
```powershell
Start-Service "DICT Network Bridge"
```

---

## Common Issues & Solutions

### Issue 1: "Authentication failed"

**Cause:** Agent key doesn't match Railway environment variable

**Solution:**
1. Check Railway Variables → NETWORK_BRIDGE_KEY
2. Should be: `Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK`
3. If just added, wait 2-3 minutes for redeploy
4. Restart service: `Restart-Service "DICT Network Bridge"`

---

### Issue 2: "Cannot connect to Railway"

**Cause:** Network/firewall blocking HTTPS

**Solution:**
1. Check internet connection: `ping google.com`
2. Test HTTPS: `curl https://dict-logbook.up.railway.app`
3. Check Windows Firewall allows outbound HTTPS (port 443)
4. Try from different network to rule out firewall

---

### Issue 3: Scan times out / no results

**Possible causes:**
1. Bridge agent not running
2. Bridge agent can't connect to Railway
3. Wrong agent key

**Solution:**
```powershell
# Check service status
Get-Service "DICT Network Bridge"

# If stopped, start it
Start-Service "DICT Network Bridge"

# Check logs for errors
Get-EventLog -LogName Application -Source "DICT Network Bridge" -Newest 5

# Test manually (see Step 5 above)
```

---

### Issue 4: Service won't install

**Error: "Access denied"**

**Solution:**
- Run PowerShell as Administrator
- Right-click PowerShell → "Run as Administrator"

**Error: "node-windows not found"**

**Solution:**
```powershell
cd C:\Users\[YourName]\Documents\Logging_System\bridge-agent
npm install
npm run install-service
```

---

### Issue 5: Service installed but not working

**Check service configuration:**

```powershell
# View service details
Get-Service "DICT Network Bridge" | Format-List *

# Check if it's set to auto-start
Get-WmiObject -Class Win32_Service -Filter "Name='DICT Network Bridge'" | Select-Object StartMode
```

**Should be:** StartMode = "Auto"

**If not:**
```powershell
# Uninstall and reinstall
npm run uninstall-service
npm run install-service
```

---

## Complete Reinstall (Clean Slate)

**If nothing works, start fresh:**

```powershell
# 1. Uninstall service
cd C:\Users\[YourName]\Documents\Logging_System\bridge-agent
npm run uninstall-service

# 2. Delete node_modules
Remove-Item -Recurse -Force node_modules

# 3. Reinstall dependencies
npm install

# 4. Test connection first
$env:RAILWAY_URL = "https://dict-logbook.up.railway.app"
$env:AGENT_KEY = "Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK"
node test-bridge.js

# 5. If test passes, install service
npm run install-service
```

---

## Verify Railway Deployment

**Check if bridge API endpoints are deployed:**

1. Go to **Railway Dashboard**
2. Click **Deployments** → Latest deployment
3. Click **View Logs**
4. Look for successful deployment

**Test API directly:**

Open browser console (F12) on admin page:

```javascript
// Test if bridge API is accessible
fetch('/api/network/bridge/poll', {
  headers: { 'Authorization': 'Bearer Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK' }
}).then(r => r.json()).then(console.log)
```

**Expected response:**
```json
{ "scanRequest": null }
```

**If you get 404:** Railway hasn't deployed the bridge API yet. Wait a few minutes.

**If you get 401:** Agent key mismatch.

---

## Quick Checklist

Before asking for help, verify:

- [ ] Railway has `NETWORK_BRIDGE_KEY` environment variable set
- [ ] Railway has redeployed (check deployment logs)
- [ ] Bridge agent service is running: `Get-Service "DICT Network Bridge"`
- [ ] Test script passes: `node test-bridge.js`
- [ ] No firewall blocking HTTPS
- [ ] Internet connection working
- [ ] Agent key matches in both Railway and service

---

## Still Not Working?

**Run this diagnostic and share the output:**

```powershell
# Diagnostic script
Write-Host "=== Bridge Agent Diagnostic ===" -ForegroundColor Cyan

Write-Host "`n1. Service Status:" -ForegroundColor Yellow
Get-Service "DICT Network Bridge" -ErrorAction SilentlyContinue

Write-Host "`n2. Recent Logs:" -ForegroundColor Yellow
Get-EventLog -LogName Application -Source "DICT Network Bridge" -Newest 5 -ErrorAction SilentlyContinue

Write-Host "`n3. Connection Test:" -ForegroundColor Yellow
$env:RAILWAY_URL = "https://dict-logbook.up.railway.app"
$env:AGENT_KEY = "Fftk7eLJYA0Rj6c4nbOpSrV3z5qsDBZK"
node C:\Users\[YourName]\Documents\Logging_System\bridge-agent\test-bridge.js

Write-Host "`n=== End Diagnostic ===" -ForegroundColor Cyan
```

Share the output for further troubleshooting.
