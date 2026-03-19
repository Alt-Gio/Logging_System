'use client'
import { useState, useEffect, useRef } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'
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
  width?: number
  height?: number
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

type Certificate = {
  id: string
  templateId: string
  internId?: string
  data: Record<string, any>
  pdfUrl?: string
  issuedAt: string
  template?: Template
  intern?: any
}

export default function CertificatesPage() {
  const { isLoaded: clerkLoaded, isSignedIn } = useUser()
  const [view, setView] = useState<'list' | 'designer' | 'generator' | 'gallery'>('list')
  const [templates, setTemplates] = useState<Template[]>([])
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [designerTemplate, setDesignerTemplate] = useState<Partial<Template>>({
    name: '',
    description: '',
    backgroundUrl: '',
    width: 1056,
    height: 816,
    fields: []
  })
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null)
  const [draggingLayer, setDraggingLayer] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const certificatePreviewRef = useRef<HTMLDivElement>(null)

  const [generatorData, setGeneratorData] = useState<Record<string, any>>({})
  const [csvData, setCsvData] = useState<Record<string, any>[]>([])
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [generatedCertUrl, setGeneratedCertUrl] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

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

  const handleImageUpload = async (file: File, purpose: 'background' | 'layer') => {
    setUploadingImage(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', 'certificates')

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo'}/image/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      setUploadingImage(false)
      return data.secure_url
    } catch (error) {
      console.error('Upload error:', error)
      setUploadingImage(false)
      return null
    }
  }

  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await handleImageUpload(file, 'background')
    if (url) {
      setDesignerTemplate(prev => ({ ...prev, backgroundUrl: url }))
    }
  }

  const handleLayerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, layerId: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await handleImageUpload(file, 'layer')
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
        setView('list')
        setDesignerTemplate({
          name: '',
          description: '',
          backgroundUrl: '',
          width: 1056,
          height: 816,
          fields: []
        })
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
      fontSize: 32,
      fontFamily: 'Arial',
      color: '#000000',
      align: 'center',
      bold: false,
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
      imageWidth: 200,
      imageHeight: 200
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
    const scale = canvas.offsetWidth / (designerTemplate.width || 1056)
    
    const startX = e.clientX
    const startY = e.clientY
    const startLayerX = layer.x
    const startLayerY = layer.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale
      handleUpdateLayer(layerId, {
        x: Math.max(0, Math.min((designerTemplate.width || 1056) - (layer.width || 100), startLayerX + deltaX)),
        y: Math.max(0, Math.min((designerTemplate.height || 816) - 50, startLayerY + deltaY))
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

    setUploadedFile(file)
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

  const generateCertificatePDF = async () => {
    if (!certificatePreviewRef.current || !selectedTemplate) return

    try {
      const canvas = await html2canvas(certificatePreviewRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: selectedTemplate.width > selectedTemplate.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [selectedTemplate.width, selectedTemplate.height]
      })

      pdf.addImage(imgData, 'PNG', 0, 0, selectedTemplate.width, selectedTemplate.height)
      
      const pdfBlob = pdf.output('blob')
      const pdfUrl = URL.createObjectURL(pdfBlob)
      setGeneratedCertUrl(pdfUrl)
      
      pdf.save(`certificate-${Date.now()}.pdf`)
      
      return imgData
    } catch (error) {
      console.error('Error generating PDF:', error)
      return null
    }
  }

  const handleSingleGenerate = async () => {
    if (!selectedTemplate) return

    const pdfData = await generateCertificatePDF()
    if (!pdfData) {
      alert('Failed to generate certificate')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          data: generatorData,
          pdfUrl: pdfData
        })
      })

      if (res.ok) {
        alert('Certificate generated successfully!')
        setGeneratorData({})
      }
    } catch (error) {
      console.error('Error generating certificate:', error)
    }
    setSaving(false)
  }

  const handleBulkGenerate = async () => {
    if (!selectedTemplate || !uploadedFile) return

    setSaving(true)
    const formData = new FormData()
    formData.append('file', uploadedFile)
    formData.append('templateId', selectedTemplate.id)

    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'PUT',
        body: formData
      })

      if (res.ok) {
        const result = await res.json()
        alert(`Successfully generated ${result.count} certificates!`)
        setView('gallery')
        setCsvData([])
        setUploadedFile(null)
      }
    } catch (error) {
      console.error('Error bulk generating:', error)
    }
    setSaving(false)
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

  const scale = 0.6
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
                <p className="text-xs text-gray-500">DICT Region V - ILCDB</p>
              </div>
            </div>
            <GovHeaderLogos/>
          </div>
          <div className="border-t border-white/15 flex items-center justify-between py-1 px-6">
            <nav className="flex gap-2">
              <button onClick={() => setView('list')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'list' ? 'bg-[var(--dict-blue)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                📋 Templates
              </button>
              <button onClick={() => { setView('designer'); setDesignerTemplate({ name: '', description: '', backgroundUrl: '', width: 1056, height: 816, fields: [] }) }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'designer' ? 'bg-[var(--dict-blue)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                🎨 Designer
              </button>
              <button onClick={() => setView('generator')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'generator' ? 'bg-[var(--dict-blue)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                ⚡ Generate
              </button>
              <button onClick={() => setView('gallery')}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'gallery' ? 'bg-[var(--dict-blue)] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                🖼️ Gallery
              </button>
            </nav>
            <UserButton afterSignOutUrl="/sign-in"/>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        {view === 'list' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-2xl text-gray-800">Certificate Templates</h2>
                <p className="text-sm text-gray-500 mt-1">{templates.length} templates available</p>
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
                    <div className="aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl mb-4 overflow-hidden relative">
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
                      <button onClick={() => { setSelectedTemplate(template); setView('generator') }}
                        className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 transition-all">
                        Generate
                      </button>
                      <button onClick={() => { setDesignerTemplate(template); setView('designer') }}
                        className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-all">
                        Edit
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
                <button onClick={() => setView('list')}
                  className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleSaveTemplate} disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="glass rounded-2xl p-6 space-y-4 max-h-[800px] overflow-y-auto">
                <h3 className="font-bold text-lg text-gray-800 mb-4">Template Settings</h3>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Template Name *</label>
                  <input value={designerTemplate.name} onChange={e => setDesignerTemplate(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Internship Certificate"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Description</label>
                  <textarea value={designerTemplate.description} onChange={e => setDesignerTemplate(prev => ({ ...prev, description: e.target.value }))}
                    rows={2} placeholder="Optional description"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 resize-none"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Background Image</label>
                  <input type="file" accept="image/*" onChange={handleBackgroundUpload}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
                  {uploadingImage && <p className="text-xs text-blue-500 mt-1">Uploading...</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Width (px)</label>
                    <input type="number" value={designerTemplate.width} onChange={e => setDesignerTemplate(prev => ({ ...prev, width: parseInt(e.target.value) || 1056 }))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Height (px)</label>
                    <input type="number" value={designerTemplate.height} onChange={e => setDesignerTemplate(prev => ({ ...prev, height: parseInt(e.target.value) || 816 }))}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
                  </div>
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
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{layer.type === 'text' ? '📝' : '🖼️'}</span>
                            <input value={layer.name} onChange={e => handleUpdateLayer(layer.id, { name: e.target.value })}
                              onClick={e => e.stopPropagation()}
                              className="font-semibold text-sm text-gray-800 bg-transparent border-none outline-none"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); moveLayerUp(layer.id) }}
                              className="text-gray-400 hover:text-gray-700 text-xs px-1">
                              ▲
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); moveLayerDown(layer.id) }}
                              className="text-gray-400 hover:text-gray-700 text-xs px-1">
                              ▼
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleUpdateLayer(layer.id, { visible: !layer.visible }) }}
                              className="text-gray-400 hover:text-gray-700 text-xs px-1">
                              {layer.visible ? '👁️' : '🚫'}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleUpdateLayer(layer.id, { locked: !layer.locked }) }}
                              className="text-gray-400 hover:text-gray-700 text-xs px-1">
                              {layer.locked ? '🔒' : '🔓'}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteLayer(layer.id) }}
                              className="text-red-500 hover:text-red-700 text-xs px-1">
                              ✕
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">Z-Index: {layer.zIndex} | Pos: ({Math.round(layer.x)}, {Math.round(layer.y)})</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 glass rounded-2xl p-6">
                <h3 className="font-bold text-lg text-gray-800 mb-4">Canvas Preview</h3>
                <div className="bg-gray-100 rounded-xl p-4 overflow-auto">
                  <div ref={canvasRef}
                    className="mx-auto bg-white shadow-2xl relative"
                    style={{
                      width: `${(designerTemplate.width || 1056) * scale}px`,
                      height: `${(designerTemplate.height || 816) * scale}px`,
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

                {selectedLayer && designerTemplate.fields?.find(f => f.id === selectedLayer) && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <h4 className="font-bold text-sm text-gray-800 mb-3">Edit Layer</h4>
                    {(() => {
                      const layer = designerTemplate.fields.find(f => f.id === selectedLayer)!
                      return layer.type === 'text' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Text Content</label>
                            <input value={layer.text} onChange={e => handleUpdateLayer(layer.id, { text: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Data Key</label>
                            <input value={layer.key} onChange={e => handleUpdateLayer(layer.id, { key: e.target.value })}
                              placeholder="e.g. fullName"
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                          </div>
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
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Font Family</label>
                            <select value={layer.fontFamily} onChange={e => handleUpdateLayer(layer.id, { fontFamily: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                              <option value="Arial">Arial</option>
                              <option value="Times New Roman">Times New Roman</option>
                              <option value="Georgia">Georgia</option>
                              <option value="Courier New">Courier New</option>
                              <option value="Verdana">Verdana</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Align</label>
                            <select value={layer.align} onChange={e => handleUpdateLayer(layer.id, { align: e.target.value as any })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                          <div className="col-span-2 flex gap-3">
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
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Width (px)</label>
                              <input type="number" value={layer.imageWidth} onChange={e => handleUpdateLayer(layer.id, { imageWidth: parseInt(e.target.value) || 200 })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                            </div>
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Height (px)</label>
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
            </div>
          </div>
        )}

        {view === 'generator' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-2xl text-gray-800">Generate Certificates</h2>
              <button onClick={() => setView('list')}
                className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Back to Templates
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="glass rounded-2xl p-6">
                <h3 className="font-bold text-lg text-gray-800 mb-4">Single Certificate</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Select Template</label>
                    <select value={selectedTemplate?.id || ''} onChange={e => setSelectedTemplate(templates.find(t => t.id === e.target.value) || null)}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                      <option value="">Choose a template...</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {selectedTemplate && selectedTemplate.fields.filter(f => f.type === 'text' && f.key).map(field => (
                    <div key={field.id}>
                      <label className="text-xs font-semibold text-gray-600 block mb-1.5">{field.name}</label>
                      <input value={generatorData[field.key!] || ''} onChange={e => setGeneratorData(prev => ({ ...prev, [field.key!]: e.target.value }))}
                        placeholder={`Enter ${field.name.toLowerCase()}`}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
                    </div>
                  ))}

                  <button onClick={handleSingleGenerate} disabled={!selectedTemplate || saving}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold disabled:opacity-50">
                    {saving ? 'Generating...' : 'Generate & Download Certificate'}
                  </button>
                </div>
              </div>

              <div className="glass rounded-2xl p-6">
                <h3 className="font-bold text-lg text-gray-800 mb-4">Bulk Generation (CSV/Excel)</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Select Template</label>
                    <select value={selectedTemplate?.id || ''} onChange={e => setSelectedTemplate(templates.find(t => t.id === e.target.value) || null)}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500">
                      <option value="">Choose a template...</option>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1.5">Upload CSV/Excel File</label>
                    <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
                    <p className="text-xs text-gray-400 mt-1">Column names should match field keys in the template</p>
                  </div>

                  {csvData.length > 0 && (
                    <div className="p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                      <p className="text-sm font-semibold text-green-800">✓ {csvData.length} rows loaded</p>
                      <p className="text-xs text-green-600 mt-1">Columns: {Object.keys(csvData[0]).join(', ')}</p>
                    </div>
                  )}

                  <button onClick={handleBulkGenerate} disabled={!selectedTemplate || csvData.length === 0 || saving}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-bold disabled:opacity-50">
                    {saving ? 'Generating...' : `Generate ${csvData.length} Certificates`}
                  </button>
                </div>
              </div>
            </div>

            {selectedTemplate && Object.keys(generatorData).length > 0 && (
              <div className="glass rounded-2xl p-6">
                <h3 className="font-bold text-lg text-gray-800 mb-4">Live Preview</h3>
                <div className="bg-gray-100 rounded-xl p-4 flex justify-center">
                  <div ref={certificatePreviewRef}
                    className="bg-white shadow-2xl relative"
                    style={{
                      width: `${selectedTemplate.width}px`,
                      height: `${selectedTemplate.height}px`,
                      backgroundImage: selectedTemplate.backgroundUrl ? `url(${selectedTemplate.backgroundUrl})` : 'none',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      transform: 'scale(0.5)',
                      transformOrigin: 'top center'
                    }}>
                    {selectedTemplate.fields.sort((a, b) => a.zIndex - b.zIndex).filter(l => l.visible).map(layer => (
                      <div key={layer.id}
                        className="absolute"
                        style={{
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
                            {layer.key && generatorData[layer.key] ? generatorData[layer.key] : layer.text}
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
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'gallery' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-2xl text-gray-800">Certificate Gallery</h2>
              <button onClick={() => setView('list')}
                className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Back to Templates
              </button>
            </div>

            <div className="glass rounded-2xl p-6 text-center py-20">
              <p className="text-6xl mb-4">🖼️</p>
              <p className="text-gray-500 font-medium text-lg">Generated certificates will appear here</p>
              <p className="text-sm text-gray-400 mt-2">Generate certificates to see them in the gallery</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
