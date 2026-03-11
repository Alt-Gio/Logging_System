// src/components/PCCountModal.tsx
'use client'

import { useEffect, useState } from 'react'

type PC = {
  id: string
  name: string
  status: 'ONLINE' | 'OFFLINE' | 'IN_USE' | 'MAINTENANCE'
  location: string | null
  icon?: string | null
  gridCol?: number | null
  gridRow?: number | null
}

type PCCountModalProps = {
  isOpen: boolean
  onClose: () => void
  pcs?: PC[]
}

export function PCCountModal({ isOpen, onClose, pcs = [] }: PCCountModalProps) {
  const [pcData, setPcData] = useState<PC[]>(pcs)
  const [loading, setLoading] = useState(!pcs.length)
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    if (isOpen && !pcs.length) {
      fetchPCData()
    } else if (pcs.length) {
      setPcData(pcs)
      setLoading(false)
    }
  }, [isOpen, pcs])

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    if (!isOpen) {
      setCountdown(10)
      return
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onClose()
          return 10
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, onClose])

  const fetchPCData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/pcs')
      if (response.ok) {
        const data = await response.json()
        setPcData(data.pcs || [])
      }
    } catch (error) {
      console.error('Failed to fetch PC data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const totalPCs = pcData.length
  const availablePCs = pcData.filter(pc => pc.status === 'ONLINE').length
  const inUsePCs = pcData.filter(pc => pc.status === 'IN_USE').length
  const offlinePCs = pcData.filter(pc => pc.status === 'OFFLINE').length
  const maintenancePCs = pcData.filter(pc => pc.status === 'MAINTENANCE').length

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(16px)', backgroundColor: 'rgba(0,20,80,0.65)' }}
      onClick={onClose}
    >
      <div 
        className="glass rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--dict-blue)] text-white rounded-t-2xl px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="font-display font-bold text-lg">PC Status Overview</h3>
            <p className="text-blue-200 text-xs">Real-time workstation availability • Auto-close in {countdown}s</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg className="animate-spin w-8 h-8 text-[var(--dict-blue)] mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-sm text-gray-500">Loading PC data...</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-[var(--dict-blue)]">{totalPCs}</div>
                  <div className="text-xs text-gray-600 mt-1">Total PCs</div>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-green-600">{availablePCs}</div>
                  <div className="text-xs text-gray-600 mt-1">Available</div>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-orange-600">{inUsePCs}</div>
                  <div className="text-xs text-gray-600 mt-1">In Use</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-gray-600">{offlinePCs + maintenancePCs}</div>
                  <div className="text-xs text-gray-600 mt-1">Offline</div>
                </div>
              </div>

              {/* Grid Layout View */}
              {pcData.some(pc => pc.gridCol && pc.gridRow) && (
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-3">Floor Plan Layout</h4>
                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <div className="grid gap-2" style={{
                      gridTemplateColumns: `repeat(${Math.max(...pcData.map(p => p.gridCol || 0))}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${Math.max(...pcData.map(p => p.gridRow || 0))}, minmax(0, 1fr))`
                    }}>
                      {Array.from({ length: Math.max(...pcData.map(p => p.gridRow || 0)) }).map((_, r) =>
                        Array.from({ length: Math.max(...pcData.map(p => p.gridCol || 0)) }).map((_, c) => {
                          const pc = pcData.find(p => p.gridRow === r + 1 && p.gridCol === c + 1)
                          if (!pc) return <div key={`${r}-${c}`} className="aspect-square bg-white/50 rounded-lg border border-dashed border-gray-200"/>
                          return (
                            <div key={pc.id} className={`aspect-square rounded-lg border-2 p-2 flex flex-col items-center justify-center text-center ${
                              pc.status === 'ONLINE' ? 'bg-green-100 border-green-400' :
                              pc.status === 'IN_USE' ? 'bg-orange-100 border-orange-400' :
                              pc.status === 'MAINTENANCE' ? 'bg-yellow-100 border-yellow-400' :
                              'bg-gray-100 border-gray-300'
                            }`}>
                              <span className="text-xl mb-1">{pc.icon || '🖥️'}</span>
                              <span className="text-[10px] font-semibold text-gray-700 leading-tight">{pc.name}</span>
                              <div className={`w-2 h-2 rounded-full mt-1 ${
                                pc.status === 'ONLINE' ? 'bg-green-500 animate-pulse' :
                                pc.status === 'IN_USE' ? 'bg-orange-500' :
                                pc.status === 'MAINTENANCE' ? 'bg-yellow-400' : 'bg-gray-400'
                              }`}/>
                            </div>
                          )
                        })
                      ).flat()}
                    </div>
                  </div>
                </div>
              )}

              {/* PC List */}
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Workstation Details</h4>
                <div className="space-y-2">
                  {pcData.map(pc => (
                    <div
                      key={pc.id}
                      className={`rounded-xl border-2 p-3 flex items-center justify-between transition-all ${
                        pc.status === 'ONLINE'
                          ? 'border-green-300 bg-green-50'
                          : pc.status === 'IN_USE'
                          ? 'border-orange-300 bg-orange-50'
                          : pc.status === 'MAINTENANCE'
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{pc.icon || '🖥️'}</span>
                        <div>
                          <div className="font-semibold text-sm text-gray-800">{pc.name}</div>
                          {pc.location && (
                            <div className="text-xs text-gray-500">{pc.location}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          pc.status === 'ONLINE'
                            ? 'bg-green-100 text-green-700'
                            : pc.status === 'IN_USE'
                            ? 'bg-orange-100 text-orange-700'
                            : pc.status === 'MAINTENANCE'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {pc.status === 'ONLINE' ? 'Available' :
                           pc.status === 'IN_USE' ? 'In Use' :
                           pc.status === 'MAINTENANCE' ? 'Maintenance' : 'Offline'}
                        </span>
                        <div className={`w-3 h-3 rounded-full ${
                          pc.status === 'ONLINE' ? 'bg-green-500 animate-pulse' :
                          pc.status === 'IN_USE' ? 'bg-orange-500' :
                          pc.status === 'MAINTENANCE' ? 'bg-yellow-400' : 'bg-gray-300'
                        }`}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Availability Message */}
              <div className={`rounded-xl p-4 ${
                availablePCs > 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
              }`}>
                <p className={`text-sm font-semibold ${availablePCs > 0 ? 'text-green-700' : 'text-amber-700'}`}>
                  {availablePCs > 0 
                    ? `✓ ${availablePCs} workstation${availablePCs !== 1 ? 's' : ''} available for use`
                    : '⚠ All workstations are currently occupied. Please wait for availability.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[var(--dict-blue)] text-white rounded-xl font-semibold text-sm hover:bg-blue-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
