// src/components/VoiceAssistant.tsx
'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isVoice?: boolean
}

type VoiceAssistantProps = {
  onTranscript?: (text: string) => void
  onCommand?: (command: { action: string; field?: string; value?: string; message?: string; section?: string; filter?: string }) => void
  context?: string
}

const isAdmin = (ctx?: string) => ctx === 'admin'

const WELCOME: Record<string, string> = {
  admin: "Hello! I'm your Admin Assistant. Ask me anything — visitor stats, PC status, logs, or say **\"go to PCs\"** to navigate sections.",
  'logbook-form': "Hi! I'm here to help you fill the logbook. Say your **name**, **agency**, or **purpose**. You can also ask about available computers.",
}

export function VoiceAssistant({ onTranscript, onCommand, context }: VoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialise with welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: WELCOME[context || 'logbook-form'] || WELCOME['logbook-form'],
        timestamp: new Date(),
      }])
    }
  }, [isOpen, context, messages.length])

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (role: 'user' | 'assistant', content: string, isVoice = false) => {
    const msg: Message = { id: Date.now().toString(), role, content, timestamp: new Date(), isVoice }
    setMessages(prev => [...prev, msg])
    return msg
  }

  const showToast = (message: string, type: 'success' | 'info' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const sendMessage = async (text: string, isVoice = false) => {
    if (!text.trim()) return
    setInputText('')
    addMessage('user', text, isVoice)
    setIsProcessing(true)

    try {
      const historyForApi = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context, history: historyForApi }),
      })

      if (!res.ok) throw new Error('API error')

      const data = await res.json()
      const cmd = data.response

      // Fire command callback for form-filling / navigation actions
      if (cmd.action !== 'respond' && cmd.action !== 'text_response') {
        onCommand?.(cmd)
      }

      // Build assistant reply text
      let replyText = cmd.message || 'Done!'
      if (cmd.action === 'fill_field' && cmd.field && cmd.value) {
        const labels: Record<string, string> = { fullName: 'Name', agency: 'Agency', purpose: 'Purpose' }
        replyText = `✓ ${labels[cmd.field] || cmd.field} filled: **${cmd.value}**`
        showToast(replyText, 'success')
      } else if (cmd.action === 'show_pc_count') {
        showToast('Showing PC availability', 'info')
      } else if (cmd.action === 'navigate') {
        showToast(cmd.message || 'Navigating...', 'info')
      } else if (cmd.action === 'show_stats') {
        showToast('Opening dashboard stats', 'info')
      } else if (cmd.action === 'show_logs') {
        showToast(cmd.message || 'Showing logs', 'info')
      }

      addMessage('assistant', replyText)
      onTranscript?.(text)
    } catch {
      addMessage('assistant', '⚠️ Sorry, I couldn\'t process that. Please check your connection and try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      // Voice Activity Detection - auto-stop after 4s of silence
      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      let silenceStart = 0
      let hasDetectedSpeech = false
      
      const checkAudioLevel = () => {
        if (!isListening) return
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / bufferLength
        
        if (average > 10) { // Speech detected
          hasDetectedSpeech = true
          silenceStart = 0
        } else if (hasDetectedSpeech && average <= 10) { // Silence after speech
          if (silenceStart === 0) silenceStart = Date.now()
          else if (Date.now() - silenceStart > 4000) { // 4 seconds of silence
            stopListening()
            return
          }
        }
        requestAnimationFrame(checkAudioLevel)
      }

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        audioContext.close()
        await transcribeAndSend(blob)
      }
      mediaRecorder.start()
      setIsListening(true)
      checkAudioLevel()
    } catch {
      addMessage('assistant', '⚠️ Microphone access denied. Please allow microphone permission.')
    }
  }

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop()
      setIsListening(false)
    }
  }

  const transcribeAndSend = async (blob: Blob) => {
    setIsProcessing(true)
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Transcription failed')
      const { text } = await res.json()
      if (text?.trim()) await sendMessage(text, true)
      else addMessage('assistant', "I didn't catch that. Please try speaking again.")
    } catch {
      addMessage('assistant', '⚠️ Transcription failed. Please try typing instead.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText) }
  }

  const formatContent = (text: string) =>
    text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[70] animate-fade-in">
          <div className={`rounded-xl shadow-2xl px-4 py-3 flex items-center gap-2 text-white text-sm font-semibold ${
            toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-[var(--dict-blue)]'
          }`}>
            <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}</span>
            {toast.message}
          </div>
        </div>
      )}

      {/* Floating toggle button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

        {/* Chat tooltip when closed */}
        {!isOpen && (
          <div className="bg-white rounded-xl shadow-lg px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-100 animate-bounce-once">
            {isAdmin(context) ? 'Admin Assistant' : 'Need help?'}
          </div>
        )}

        {/* Main toggle button */}
        <button
          onClick={() => setIsOpen(o => !o)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 ${
            isOpen ? 'bg-gray-700 rotate-45' : 'bg-[var(--dict-blue)] hover:bg-blue-700'
          }`}
          aria-label="Toggle AI Assistant"
        >
          {isOpen ? (
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          ) : (
            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
            </svg>
          )}
        </button>
      </div>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[340px] sm:w-[380px] flex flex-col rounded-2xl shadow-2xl border border-gray-100 overflow-hidden bg-white"
          style={{ maxHeight: '520px' }}>

          {/* Header */}
          <div className="bg-[var(--dict-blue)] px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">
                {isAdmin(context) ? 'Admin AI Assistant' : 'DTC Logbook Assistant'}
              </p>
              <p className="text-blue-200 text-xs">
                {isListening ? '🔴 Listening...' : isProcessing ? '⏳ Thinking...' : '● Online · Powered by Groq'}
              </p>
            </div>
            <button onClick={() => setMessages([])} className="text-white/50 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors">
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50" style={{ minHeight: 0 }}>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-[var(--dict-blue)] flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                    </svg>
                  </div>
                )}
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--dict-blue)] text-white rounded-br-sm'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                }`}>
                  {msg.isVoice && msg.role === 'user' && (
                    <span className="text-blue-200 text-xs mr-1">🎤</span>
                  )}
                  <span dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}/>
                  <div className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-full bg-[var(--dict-blue)] flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                  </svg>
                </div>
                <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100 flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}/>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}/>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}/>
                </div>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {/* Quick suggestions */}
          {messages.length <= 1 && (
            <div className="px-3 py-2 flex gap-2 overflow-x-auto flex-shrink-0 bg-gray-50 border-t border-gray-100">
              {(isAdmin(context)
                ? ['Show PCs', 'Today\'s visitors', 'Active sessions', 'Go to logs']
                : ['My name is...', 'I\'m from...', 'Available PCs?', 'Here for...']
              ).map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="flex-shrink-0 text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-3 py-1.5 hover:border-blue-300 hover:text-blue-600 transition-colors whitespace-nowrap">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="px-3 py-3 bg-white border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
            {/* Voice button */}
            <button
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onTouchStart={startListening}
              onTouchEnd={stopListening}
              disabled={isProcessing}
              className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                isListening ? 'bg-red-500 scale-110 animate-pulse' : 'bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600'
              }`}
              title="Hold to speak"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing || isListening}
              placeholder={isListening ? 'Listening...' : 'Type a message or hold mic...'}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 transition-colors disabled:opacity-50"
            />

            {/* Send button */}
            <button
              onClick={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isProcessing}
              className="w-9 h-9 rounded-full bg-[var(--dict-blue)] flex items-center justify-center flex-shrink-0 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-105"
            >
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
