# 🚀 Railway Environment Setup — Groq API Key

## ⚠️ CRITICAL: Voice Assistant Won't Work Without This

The voice chatbot requires a **GROQ_API_KEY** environment variable set in Railway.

---

## 📋 Step-by-Step Setup

### **1. Get Your Groq API Key**

1. Go to **https://console.groq.com**
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **Create API Key**
5. Copy the key (starts with `gsk_...`)

### **2. Add to Railway**

1. Open your Railway project dashboard
2. Click on your **Logging_System** service
3. Go to **Variables** tab
4. Click **+ New Variable**
5. Add:
   - **Variable name:** `GROQ_API_KEY`
   - **Value:** `gsk_your_actual_key_here`
6. Click **Add**

### **3. Redeploy**

Railway will automatically redeploy when you add the variable. Wait ~3-5 minutes.

---

## ✅ Verify It's Working

1. Go to `https://dict-logbook.up.railway.app`
2. Click the **chat bubble** icon (bottom-right)
3. Type "Hello" or hold the mic button and speak
4. You should get a response from the AI assistant

---

## 🌐 Multilingual Support

The voice assistant now understands:
- **English** — "My name is Juan"
- **Tagalog** — "Ako si Maria"
- **Bicolano** — "Pedro an ngaran ko"

---

## 🎯 Admin Voice Navigation

On the admin page, you can now say:
- "Go to logs" / "Pumunta sa logs"
- "Show dashboard" / "Ipakita ang dashboard"
- "Open settings" / "Buksan ang settings"
- "Go to stations" → navigates to PCs tab
- "Show networks" → navigates to Network tab
- "Open notices" → navigates to Announcements tab
- "Go to analytics" → navigates to Analytics tab

All tabs are voice-navigable!

---

## 🔧 Models Used

| Purpose | Model | Speed |
|---------|-------|-------|
| Voice transcription | `whisper-large-v3-turbo` | Fast |
| Chat responses | `llama-3.1-8b-instant` | Very fast |

Both are on Groq's free tier and support multilingual input.

---

## 🐛 Troubleshooting

**"Sorry, I couldn't process that"**
- Check Railway Variables tab — is `GROQ_API_KEY` set?
- Check Railway logs for API errors
- Verify your Groq API key is valid at console.groq.com

**Voice not transcribing**
- Allow microphone permission in browser
- Use Chrome/Edge (best support for WebM audio)
- Check Railway logs for transcription errors

**Navigation not working**
- Say exact tab names: "logs", "dashboard", "settings", etc.
- Try typing instead of voice to test
- Check admin toast notification for errors
