# DICT Network Bridge Agent

Lightweight Windows service that enables local network scanning from Railway cloud deployment.

## Quick Setup (5 Minutes)

### Prerequisites
- Windows PC that stays on (any spec, minimal resources needed)
- Node.js installed (download from https://nodejs.org)
- Admin access to install Windows service

### Installation Steps

1. **Download the bridge agent folder** to your office PC

2. **Open PowerShell as Administrator** (Right-click PowerShell → Run as Administrator)

3. **Navigate to bridge-agent folder:**
   ```powershell
   cd path\to\Logging_System\bridge-agent
   ```

4. **Install dependencies:**
   ```powershell
   npm install
   ```

5. **Install as Windows service:**
   ```powershell
   npm run install-service
   ```

6. **Enter configuration when prompted:**
   - Railway URL: `https://dict-logbook.up.railway.app` (or press Enter for default)
   - Agent Key: `[Your admin will provide this]`

7. **Done!** The service is now running in the background.

---

## How It Works

```
Railway (Cloud) ←→ Bridge Agent (Office PC) ←→ Local Network (192.168.x.x)
```

1. Admin clicks "Scan Network" on Railway website
2. Railway creates scan request in database
3. Bridge agent polls Railway every 5 seconds
4. Bridge agent finds request and scans local network
5. Bridge agent sends results back to Railway
6. Admin sees results on website

---

## Features

✅ **Auto-starts** - Runs as Windows service, starts with Windows  
✅ **Lightweight** - Uses < 10MB RAM  
✅ **Secure** - Authenticated with secret key  
✅ **Reliable** - Automatic reconnection if connection drops  
✅ **Fast** - Scans in parallel (10 IPs at a time)  
✅ **Silent** - Runs in background, no UI  

---

## Configuration

### Environment Variables

Set in Railway dashboard → Environment Variables:

```
NETWORK_BRIDGE_KEY=your-secret-key-here
```

**Generate a secure key:**
```powershell
# PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

---

## Testing

### Test the agent manually (before installing as service):

```powershell
# Set environment variables
$env:RAILWAY_URL = "https://dict-logbook.up.railway.app"
$env:AGENT_KEY = "your-key-here"

# Run agent
node network-bridge-agent.js
```

You should see:
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

---

## Uninstall

```powershell
npm run uninstall-service
```

---

## Troubleshooting

### "Authentication failed"
- Check that `AGENT_KEY` matches the key set in Railway environment variables
- Verify the key has no extra spaces

### "Cannot connect to Railway"
- Check internet connection
- Verify `RAILWAY_URL` is correct
- Check if firewall is blocking outbound HTTPS connections

### Service won't start
- Make sure Node.js is installed
- Run PowerShell as Administrator
- Check Windows Event Viewer for error details

### Scan not working
- Verify agent is running: `Get-Service "DICT Network Bridge"`
- Check agent logs in Windows Event Viewer
- Test manually with `node network-bridge-agent.js`

---

## System Requirements

- **OS:** Windows 7 or later
- **RAM:** 50MB minimum
- **CPU:** Any (uses < 1% CPU)
- **Network:** Internet connection required
- **Node.js:** v14 or later

---

## Security

- All communication encrypted via HTTPS
- Agent key authentication required
- No inbound ports opened (agent polls Railway)
- Minimal attack surface
- Runs with standard user privileges (after install)

---

## Maintenance

**Zero maintenance required!**

The service:
- Starts automatically with Windows
- Reconnects automatically if connection drops
- Logs errors to Windows Event Viewer
- Updates automatically when you update the code

---

## Advanced Configuration

### Change poll interval:

Edit `network-bridge-agent.js`:
```javascript
const POLL_INTERVAL = 10000; // Poll every 10 seconds instead of 5
```

### Enable debug logging:

Set environment variable:
```powershell
$env:DEBUG = "true"
```

---

## Support

If you encounter issues:

1. Check Windows Event Viewer (Windows Logs → Application)
2. Look for entries from "DICT Network Bridge"
3. Test manually: `node network-bridge-agent.js`
4. Verify Railway environment variables are set

---

## License

MIT
