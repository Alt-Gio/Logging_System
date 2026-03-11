// src/components/VoiceAssistant.tsx
'use client'

import { useState, useRef, useEffect } from 'react'

type VoiceAssistantProps = {
  onTranscript?: (text: string) => void
  onCommand?: (command: { action: string; field?: string; value?: string; message?: string }) => void
  context?: string
}

export function VoiceAssistant({ onTranscript, onCommand, context }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const startListening = async () => {
    try {
      setError('')
      setTranscript('')
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await processAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsListening(true)
    } catch (err) {
      console.error('Microphone access error:', err)
      setError('Could not access microphone. Please grant permission.')
    }
  }

  const stopListening = () => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop()
      setIsListening(false)
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true)
    try {
      // Step 1: Transcribe audio using Groq Whisper
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const transcribeRes = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!transcribeRes.ok) {
        throw new Error('Transcription failed')
      }

      const { text } = await transcribeRes.json()
      setTranscript(text)
      onTranscript?.(text)

      // Step 2: Process command using Groq LLM
      const processRes = await fetch('/api/voice/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, context }),
      })

      if (!processRes.ok) {
        throw new Error('Command processing failed')
      }

      const { response } = await processRes.json()
      onCommand?.(response)

      // Show modal for certain actions
      if (response.action === 'show_pc_count' || response.action === 'text_response') {
        setShowModal(true)
      }
    } catch (err) {
      console.error('Processing error:', err)
      setError('Failed to process voice command. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing}
          className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all transform hover:scale-110 ${
            isListening
              ? 'bg-red-500 animate-pulse'
              : isProcessing
              ? 'bg-gray-400 cursor-wait'
              : 'bg-[var(--dict-blue)] hover:bg-blue-700'
          }`}
          aria-label={isListening ? 'Stop listening' : 'Start voice command'}
        >
          {isProcessing ? (
            <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : isListening ? (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="2"/>
              <rect x="14" y="4" width="4" height="16" rx="2"/>
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          )}
        </button>

        {/* Status indicator */}
        {(isListening || isProcessing || transcript || error) && (
          <div className="absolute bottom-20 right-0 bg-white rounded-2xl shadow-xl p-4 min-w-[280px] max-w-[320px]">
            {isListening && (
              <div className="flex items-center gap-2 text-red-600">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"/>
                <span className="text-sm font-semibold">Listening...</span>
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"/>
                <span className="text-sm font-semibold">Processing...</span>
              </div>
            )}
            {transcript && !isProcessing && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-semibold">You said:</p>
                <p className="text-sm text-gray-800">&ldquo;{transcript}&rdquo;</p>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 text-red-600">
                <span className="text-lg">⚠️</span>
                <p className="text-xs">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal for responses */}
      {showModal && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(0,20,80,0.65)' }}
          onClick={() => setShowModal(false)}
        >
          <div 
            className="glass rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-lg text-[var(--dict-blue)]">
                Voice Assistant
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">You asked:</p>
                <p className="text-sm font-semibold text-gray-800">&ldquo;{transcript}&rdquo;</p>
              </div>
              
              <div className="bg-green-50 rounded-xl p-4">
                <p className="text-sm text-gray-700">
                  I&apos;ve processed your request. Check the form or display for updates.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-4 py-3 bg-[var(--dict-blue)] text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
