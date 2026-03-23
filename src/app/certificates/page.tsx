'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { GovSeal, GovHeaderLogos } from '@/components/GovernmentHeader'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

type CertificateLayer = {
  id: string
  type: 'text' | 'image'
  name: string
  visible: boolean
  locked: boolean
  zIndex: number
  text?: string
  key?: string
  fontSize?: number
  fontFamily?: string
  color?: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  italic?: boolean
  imageUrl?: string
  imageWidth?: number
  imageHeight?: number
  x: number
  y: number
}

type Template = {
  id: string
  name: string
  description?: string
  backgroundUrl?: string
  width: number
  height: number
  fields: CertificateLayer[]
  createdAt: string
  _count?: { certificates: number }
}

type GeneratedCert = {
  id: string
  data: Record<string, any>
  preview: string
}

const CERT_WIDTH = 1122  // A4 landscape width in pixels at 96 DPI
const CERT_HEIGHT = 794  // A4 landscape height in pixels at 96 DPI

export default function CertificatesPage() {
  const { status } = useSession()
  const clerkLoaded = status !== 'loading'
  const isSignedIn  = status === 'authenticated'
  const [view, setView] = useState<'templates' | 'designer' | 'generate'>('templates')
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Designer state
  const [designerTemplate, setDesignerTemplate] = useState<Partial<Template>>({
    name: '',
    description: '',
    backgroundUrl: '',
    width: CERT_WIDTH,
    height: CERT_HEIGHT,
    fields: []
  })
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null)
  const [draggingLayer, setDraggingLayer] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Generation state
  const [csvData, setCsvData] = useState<Record<string, any>[]>([])
  const [generatedCerts, setGeneratedCerts] = useState<GeneratedCert[]>([])
  const [generating, setGenerating] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const certRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  useEffect(() => {
    if (clerkLoaded && isSignedIn) {
      fetchTemplates()
    }
  }, [clerkLoaded, isSignedIn])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/certificates/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
    setLoading(false)
  }

  const handleDeleteTemplate = async (templateId: string, templateName: string) => {
    if (!confirm(`Are you sure you want to delete "${templateName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const res = await fetch(`/api/certificates/templates/${templateId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchTemplates()
        if (selectedTemplate?.id === templateId) {
          setSelectedTemplate(null)
        }
        alert('Template deleted successfully')
      } else {
        alert('Failed to delete template')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Error deleting template')
    }
  }

  const handleImageUpload = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return null
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB')
      return null
    }

    setUploadingImage(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = (e) => reject(e)
        reader.readAsDataURL(file)
      })
      setUploadingImage(false)
      return base64
    } catch (error) {
      console.error('Upload error:', error)
      setUploadingImage(false)
      alert('Failed to upload image. Please try again.')
      return null
    }
  }

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await handleImageUpload(file)
    if (url) {
      setDesignerTemplate(prev => ({ ...prev, backgroundUrl: url }))
    }
  }

  const handleLayerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, layerId: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await handleImageUpload(file)
    if (url) {
      handleUpdateLayer(layerId, { imageUrl: url })
    }
  }

  const handleSaveTemplate = async () => {
    if (!designerTemplate.name || !designerTemplate.fields || designerTemplate.fields.length === 0) {
      alert('Please provide a template name and at least one layer')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/certificates/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(designerTemplate)
      })

      if (res.ok) {
        await fetchTemplates()
        setView('templates')
        setDesignerTemplate({
          name: '',
          description: '',
          backgroundUrl: '',
          width: CERT_WIDTH,
          height: CERT_HEIGHT,
          fields: []
        })
        alert('Template saved successfully!')
      }
    } catch (error) {
      console.error('Error saving template:', error)
    }
    setSaving(false)
  }

  const handleAddTextLayer = () => {
    const newLayer: CertificateLayer = {
      id: `layer-${Date.now()}`,
      type: 'text',
      name: 'Text Layer',
      visible: true,
      locked: false,
      zIndex: (designerTemplate.fields?.length || 0) + 1,
      text: 'Sample Text',
      key: 'fieldKey',
      x: 100,
      y: 100,
      fontSize: 48,
      fontFamily: 'Georgia',
      color: '#000000',
      align: 'center',
      bold: true,
      italic: false
    }
    setDesignerTemplate(prev => ({
      ...prev,
      fields: [...(prev.fields || []), newLayer]
    }))
    setSelectedLayer(newLayer.id)
  }

  const handleAddImageLayer = () => {
    const newLayer: CertificateLayer = {
      id: `layer-${Date.now()}`,
      type: 'image',
      name: 'Image Layer',
      visible: true,
      locked: false,
      zIndex: (designerTemplate.fields?.length || 0) + 1,
      imageUrl: '',
      x: 100,
      y: 100,
      imageWidth: 150,
      imageHeight: 150
    }
    setDesignerTemplate(prev => ({
      ...prev,
      fields: [...(prev.fields || []), newLayer]
    }))
    setSelectedLayer(newLayer.id)
  }

  const handleUpdateLayer = (layerId: string, updates: Partial<CertificateLayer>) => {
    setDesignerTemplate(prev => ({
      ...prev,
      fields: (prev.fields || []).map(f => f.id === layerId ? { ...f, ...updates } : f)
    }))
  }

  const handleDeleteLayer = (layerId: string) => {
    setDesignerTemplate(prev => ({
      ...prev,
      fields: (prev.fields || []).filter(f => f.id !== layerId)
    }))
    if (selectedLayer === layerId) setSelectedLayer(null)
  }

  const handleLayerDrag = (layerId: string, e: React.MouseEvent) => {
    if (!canvasRef.current) return
    const layer = designerTemplate.fields?.find(f => f.id === layerId)
    if (!layer || layer.locked) return

    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scale = canvas.offsetWidth / (designerTemplate.width || CERT_WIDTH)
    
    const startX = e.clientX
    const startY = e.clientY
    const startLayerX = layer.x
    const startLayerY = layer.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale
      handleUpdateLayer(layerId, {
        x: Math.max(0, Math.min((designerTemplate.width || CERT_WIDTH) - 50, startLayerX + deltaX)),
        y: Math.max(0, Math.min((designerTemplate.height || CERT_HEIGHT) - 50, startLayerY + deltaY))
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setDraggingLayer(null)
    }

    setDraggingLayer(layerId)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[]
      setCsvData(jsonData)
    }
    reader.readAsArrayBuffer(file)
  }

  const generatePreview = async (data: Record<string, any>, index: number): Promise<string> => {
    const certElement = certRefs.current[`cert-${index}`]
    if (!certElement) return ''

    try {
      const canvas = await html2canvas(certElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })
      return canvas.toDataURL('image/png')
    } catch (error) {
      console.error('Error generating preview:', error)
      return ''
    }
  }

  const handleGeneratePreviews = async () => {
    if (!selectedTemplate || csvData.length === 0) return

    setGenerating(true)
    const certs: GeneratedCert[] = []

    for (let i = 0; i < csvData.length; i++) {
      const preview = await generatePreview(csvData[i], i)
      certs.push({
        id: `cert-${i}`,
        data: csvData[i],
        preview
      })
    }

    setGeneratedCerts(certs)
    setGenerating(false)
  }

  const downloadCertificate = async (cert: GeneratedCert) => {
    if (!selectedTemplate) return

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [CERT_WIDTH, CERT_HEIGHT]
    })

    pdf.addImage(cert.preview, 'PNG', 0, 0, CERT_WIDTH, CERT_HEIGHT)
    pdf.save(`certificate-${cert.data.fullName || cert.id}.pdf`)
  }

  const downloadAllCertificates = async () => {
    for (const cert of generatedCerts) {
      await downloadCertificate(cert)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  const moveLayerUp = (layerId: string) => {
    const layer = designerTemplate.fields?.find(f => f.id === layerId)
    if (!layer) return
    handleUpdateLayer(layerId, { zIndex: layer.zIndex + 1 })
  }

  const moveLayerDown = (layerId: string) => {
    const layer = designerTemplate.fields?.find(f => f.id === layerId)
    if (!layer || layer.zIndex <= 1) return
    handleUpdateLayer(layerId, { zIndex: layer.zIndex - 1 })
  }

  if (!clerkLoaded || !isSignedIn) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const scale = 0.7
  const sortedLayers = [...(designerTemplate.fields || [])].sort((a, b) => a.zIndex - b.zIndex)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="glass sticky top-0 z-40 border-b border-white/20">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <GovSeal size="md"/>
              <div>
                <h1 className="font-display font-bold text-lg text-[var(--dict-blue)]">Certificate Generator</h1>
                <p className="text-xs text-gray-500">DICT Region V - Intern Certificates</p>
              </div>
            </div>
            <GovHeaderLogos/>
          </div>
          <div className="border-t border-white/15 flex items-center justify-between py-1 px-6">
            <nav className="flex gap-2">
              <button onClick={() => setView('templates')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'templates' ? 'bg-[var(--dict-blue)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                📋 Templates
              </button>
              <button onClick={() => { setView('designer'); setDesignerTemplate({ name: '', description: '', backgroundUrl: '', width: CERT_WIDTH, height: CERT_HEIGHT, fields: [] }) }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'designer' ? 'bg-[var(--dict-blue)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                🎨 Designer
              </button>
              {selectedTemplate && (
                <button onClick={() => setView('generate')}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'generate' ? 'bg-[var(--dict-blue)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                  ⚡ Generate
                </button>
              )}
            </nav>
            <button onClick={() => signOut({ callbackUrl: '/sign-in' })} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all">🔒 Sign Out</button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        {view === 'templates' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-2xl text-gray-800">Certificate Templates</h2>
                <p className="text-sm text-gray-500 mt-1">{templates.length} templates • Standard A4 Landscape (1122×794px)</p>
              </div>
              <button onClick={() => setView('designer')}
                className="px-6 py-3 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all">
                + Create Template
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"/>
              </div>
            ) : templates.length === 0 ? (
              <div className="glass rounded-2xl py-20 text-center">
                <p className="text-6xl mb-4">📜</p>
                <p className="text-gray-500 font-medium text-lg">No templates yet</p>
                <button onClick={() => setView('designer')}
                  className="mt-4 px-6 py-2.5 bg-gradient-to-r from-[var(--dict-blue)] to-blue-700 text-white rounded-xl text-sm font-bold">
                  Create First Template
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map(template => (
                  <div key={template.id} className="glass rounded-2xl p-6 hover:shadow-xl transition-all border-2 border-transparent hover:border-blue-200">
                    <div className="aspect-[1122/794] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl mb-4 overflow-hidden relative">
                      {template.backgroundUrl ? (
                        <img src={template.backgroundUrl} alt={template.name} className="w-full h-full object-cover"/>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl">📜</div>
                      )}
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-gray-700">
                        {template.fields.length} layers
                      </div>
                    </div>
                    <h3 className="font-bold text-lg text-gray-800 mb-1">{template.name}</h3>
                    {template.description && <p className="text-sm text-gray-500 mb-3">{template.description}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedTemplate(template); setView('generate') }}
                        className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 transition-all">
                        Use Template
                      </button>
                      <button onClick={() => { setDesignerTemplate(template); setView('designer') }}
                        className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-all">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteTemplate(template.id, template.name)}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-bold hover:bg-red-600 transition-all">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'designer' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-2xl text-gray-800">Certificate Designer</h2>
              <div className="flex gap-3">
                <button onClick={() => setView('templates')}
                  className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleSaveTemplate} disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-4 gap-6">
              <div className="glass rounded-2xl p-6 space-y-4 max-h-[800px] overflow-y-auto">
                <h3 className="font-bold text-lg text-gray-800 mb-4">Settings</h3>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Template Name *</label>
                  <input value={designerTemplate.name} onChange={e => setDesignerTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Internship Certificate"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Description</label>
                  <textarea value={designerTemplate.description} onChange={e => setDesignerTemplate(prev => ({ ...prev, description: e.target.value }))}
                    rows={2} placeholder="Optional"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 resize-none"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Background Image</label>
                  <input type="file" accept="image/*" onChange={handleBackgroundUpload}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
                  {uploadingImage && <p className="text-xs text-blue-500 mt-1">Uploading...</p>}
                  {designerTemplate.backgroundUrl && (
                    <div className="mt-2 relative">
                      <img src={designerTemplate.backgroundUrl} alt="Background" className="w-full h-20 object-cover rounded-lg"/>
                      <button onClick={() => setDesignerTemplate(prev => ({ ...prev, backgroundUrl: '' }))}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm text-gray-700">Layers ({designerTemplate.fields?.length || 0})</h4>
                    <div className="flex gap-2">
                      <button onClick={handleAddTextLayer}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600">
                        + Text
                      </button>
                      <button onClick={handleAddImageLayer}
                        className="px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-bold hover:bg-purple-600">
                        + Image
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {sortedLayers.map(layer => (
                      <div key={layer.id}
                        onClick={() => setSelectedLayer(layer.id)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedLayer === layer.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg">{layer.type === 'text' ? '📝' : '🖼️'}</span>
                            <input value={layer.name} onChange={e => handleUpdateLayer(layer.id, { name: e.target.value })}
                              onClick={e => e.stopPropagation()}
                              className="font-semibold text-sm text-gray-800 bg-transparent border-none outline-none flex-1 min-w-0"
                            />
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); moveLayerUp(layer.id) }}
                              className="text-gray-400 hover:text-gray-700 text-xs px-1">▲</button>
                            <button onClick={(e) => { e.stopPropagation(); moveLayerDown(layer.id) }}
                              className="text-gray-400 hover:text-gray-700 text-xs px-1">▼</button>
                            <button onClick={(e) => { e.stopPropagation(); handleUpdateLayer(layer.id, { visible: !layer.visible }) }}
                              className="text-gray-400 hover:text-gray-700 text-xs px-1">{layer.visible ? '👁️' : '🚫'}</button>
                            <button onClick={(e) => { e.stopPropagation(); handleUpdateLayer(layer.id, { locked: !layer.locked }) }}
                              className="text-gray-400 hover:text-gray-700 text-xs px-1">{layer.locked ? '🔒' : '🔓'}</button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteLayer(layer.id) }}
                              className="text-red-500 hover:text-red-700 text-xs px-1">✕</button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">Z: {layer.zIndex} | ({Math.round(layer.x)}, {Math.round(layer.y)})</p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedLayer && designerTemplate.fields?.find(f => f.id === selectedLayer) && (
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-sm text-gray-800 mb-3">Layer Properties</h4>
                    {(() => {
                      const layer = designerTemplate.fields.find(f => f.id === selectedLayer)!
                      return layer.type === 'text' ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Text</label>
                            <input value={layer.text} onChange={e => handleUpdateLayer(layer.id, { text: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Data Key (for CSV)</label>
                            <input value={layer.key} onChange={e => handleUpdateLayer(layer.id, { key: e.target.value })}
                              placeholder="e.g. fullName"
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Font Size</label>
                              <input type="number" value={layer.fontSize} onChange={e => handleUpdateLayer(layer.id, { fontSize: parseInt(e.target.value) || 24 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Color</label>
                              <input type="color" value={layer.color} onChange={e => handleUpdateLayer(layer.id, { color: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm h-9"/>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Font</label>
                            <select value={layer.fontFamily} onChange={e => handleUpdateLayer(layer.id, { fontFamily: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                              <option value="Arial">Arial</option>
                              <option value="Times New Roman">Times New Roman</option>
                              <option value="Georgia">Georgia</option>
                              <option value="Courier New">Courier New</option>
                              <option value="Verdana">Verdana</option>
                            </select>
                          </div>
                          <div className="flex gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={layer.bold} onChange={e => handleUpdateLayer(layer.id, { bold: e.target.checked })}
                                className="w-4 h-4"/>
                              <span className="text-sm font-semibold text-gray-700">Bold</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={layer.italic} onChange={e => handleUpdateLayer(layer.id, { italic: e.target.checked })}
                                className="w-4 h-4"/>
                              <span className="text-sm font-semibold text-gray-700">Italic</span>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Upload Image</label>
                            <input type="file" accept="image/*" onChange={e => handleLayerImageUpload(e, layer.id)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                          </div>
                          {layer.imageUrl && (
                            <div className="relative">
                              <img src={layer.imageUrl} alt="Layer" className="w-full h-32 object-contain rounded-lg border-2 border-gray-200"/>
                              <button onClick={() => handleUpdateLayer(layer.id, { imageUrl: '' })}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                                ✕
                              </button>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Width</label>
                              <input type="number" value={layer.imageWidth} onChange={e => handleUpdateLayer(layer.id, { imageWidth: parseInt(e.target.value) || 200 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Height</label>
                              <input type="number" value={layer.imageHeight} onChange={e => handleUpdateLayer(layer.id, { imageHeight: parseInt(e.target.value) || 200 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              <div className="lg:col-span-3 glass rounded-2xl p-6">
                <h3 className="font-bold text-lg text-gray-800 mb-4">Canvas Preview (A4 Landscape)</h3>
                <div className="bg-gray-100 rounded-xl p-4 overflow-auto flex justify-center">
                  <div ref={canvasRef}
                    className="bg-white shadow-2xl relative"
                    style={{
                      width: `${(designerTemplate.width || CERT_WIDTH) * scale}px`,
                      height: `${(designerTemplate.height || CERT_HEIGHT) * scale}px`,
                      backgroundImage: designerTemplate.backgroundUrl ? `url(${designerTemplate.backgroundUrl})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}>
                    {sortedLayers.filter(l => l.visible).map(layer => (
                      <div key={layer.id}
                        onMouseDown={(e) => handleLayerDrag(layer.id, e)}
                        className={`absolute select-none ${layer.locked ? 'cursor-not-allowed' : 'cursor-move'} ${selectedLayer === layer.id ? 'ring-2 ring-blue-500' : ''} ${draggingLayer === layer.id ? 'opacity-50' : ''}`}
                        style={{
                          left: `${layer.x * scale}px`,
                          top: `${layer.y * scale}px`,
                          zIndex: layer.zIndex
                        }}>
                        {layer.type === 'text' ? (
                          <div style={{
                            fontSize: `${(layer.fontSize || 24) * scale}px`,
                            fontFamily: layer.fontFamily,
                            color: layer.color,
                            textAlign: layer.align,
                            fontWeight: layer.bold ? 'bold' : 'normal',
                            fontStyle: layer.italic ? 'italic' : 'normal',
                            whiteSpace: 'nowrap'
                          }}>
                            {layer.text || layer.name}
                          </div>
                        ) : layer.imageUrl ? (
                          <img src={layer.imageUrl} alt={layer.name}
                            style={{
                              width: `${(layer.imageWidth || 200) * scale}px`,
                              height: `${(layer.imageHeight || 200) * scale}px`,
                              objectFit: 'contain'
                            }}
                          />
                        ) : (
                          <div className="border-2 border-dashed border-gray-400 bg-gray-100 flex items-center justify-center"
                            style={{
                              width: `${(layer.imageWidth || 200) * scale}px`,
                              height: `${(layer.imageHeight || 200) * scale}px`
                            }}>
                            <span className="text-gray-400 text-xs">No Image</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'generate' && selectedTemplate && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-2xl text-gray-800">Generate Certificates</h2>
                <p className="text-sm text-gray-500 mt-1">Using template: {selectedTemplate.name}</p>
              </div>
              <button onClick={() => setView('templates')}
                className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Change Template
              </button>
            </div>

            {generatedCerts.length === 0 ? (
              <div className="glass rounded-2xl p-6">
                <h3 className="font-bold text-lg text-gray-800 mb-4">Upload Data (CSV/Excel)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Upload File</label>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
                    <p className="text-xs text-gray-400 mt-1">Column names should match field keys: {selectedTemplate.fields.filter(f => f.key).map(f => f.key).join(', ')}</p>
                  </div>

                  {csvData.length > 0 && (
                    <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                      <p className="text-sm font-semibold text-green-800">✓ {csvData.length} rows loaded</p>
                      <p className="text-xs text-green-600 mt-1">Columns: {Object.keys(csvData[0]).join(', ')}</p>
                      <button onClick={handleGeneratePreviews} disabled={generating}
                        className="mt-3 w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">
                        {generating ? 'Generating Previews...' : `Generate ${csvData.length} Certificate Previews`}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="glass rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-gray-800">{generatedCerts.length} Certificates Generated</h3>
                    <div className="flex gap-3">
                      <button onClick={() => { setGeneratedCerts([]); setCsvData([]) }}
                        className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                        Start Over
                      </button>
                      <button onClick={downloadAllCertificates}
                        className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold">
                        Download All PDFs
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {generatedCerts.map((cert, idx) => (
                      <div key={cert.id} className="border-2 border-gray-200 rounded-xl p-4 hover:border-blue-300 transition-all">
                        {cert.preview ? (
                          <img src={cert.preview} alt={`Certificate ${idx + 1}`} className="w-full rounded-lg mb-3"/>
                        ) : (
                          <div className="w-full aspect-[1122/794] bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                            <span className="text-gray-400">Generating...</span>
                          </div>
                        )}
                        <p className="text-sm font-semibold text-gray-800 mb-1">{cert.data.fullName || `Certificate ${idx + 1}`}</p>
                        <p className="text-xs text-gray-500 mb-3">{Object.entries(cert.data).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' • ')}</p>
                        <button onClick={() => downloadCertificate(cert)}
                          className="w-full py-2 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-all">
                          Download PDF
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Hidden certificate render elements */}
            <div className="hidden">
              {csvData.map((data, idx) => (
                <div key={`cert-${idx}`} ref={el => { certRefs.current[`cert-${idx}`] = el }}
                  className="bg-white"
                  style={{
                    width: `${CERT_WIDTH}px`,
                    height: `${CERT_HEIGHT}px`,
                    backgroundImage: selectedTemplate.backgroundUrl ? `url(${selectedTemplate.backgroundUrl})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative'
                  }}>
                  {selectedTemplate.fields.sort((a, b) => a.zIndex - b.zIndex).filter(l => l.visible).map(layer => (
                    <div key={layer.id}
                      style={{
                        position: 'absolute',
                        left: `${layer.x}px`,
                        top: `${layer.y}px`,
                        zIndex: layer.zIndex
                      }}>
                      {layer.type === 'text' ? (
                        <div style={{
                          fontSize: `${layer.fontSize}px`,
                          fontFamily: layer.fontFamily,
                          color: layer.color,
                          textAlign: layer.align,
                          fontWeight: layer.bold ? 'bold' : 'normal',
                          fontStyle: layer.italic ? 'italic' : 'normal',
                          whiteSpace: 'nowrap'
                        }}>
                          {layer.key && data[layer.key] ? data[layer.key] : layer.text}
                        </div>
                      ) : layer.imageUrl && (
                        <img src={layer.imageUrl} alt={layer.name}
                          style={{
                            width: `${layer.imageWidth}px`,
                            height: `${layer.imageHeight}px`,
                            objectFit: 'contain'
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
