'use client'
import { useState, useEffect, useRef } from 'react'
import { useUser, UserButton } from '@clerk/nextjs'
import { GovSeal, GovHeaderLogos } from '@/components/GovernmentHeader'
import * as XLSX from 'xlsx'

type CertificateField = {
  id: string
  type: 'text' | 'date' | 'image'
  label: string
  key: string
  x: number
  y: number
  fontSize: number
  fontFamily: string
  color: string
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
}

type Template = {
  id: string
  name: string
  description?: string
  backgroundUrl?: string
  width: number
  height: number
  fields: CertificateField[]
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
  const [view, setView] = useState<'list' | 'designer' | 'generator'>('list')
  const [templates, setTemplates] = useState<Template[]>([])
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Designer state
  const [designerTemplate, setDesignerTemplate] = useState<Partial<Template>>({
    name: '',
    description: '',
    backgroundUrl: '',
    width: 1056,
    height: 816,
    fields: []
  })
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [draggingField, setDraggingField] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Generator state
  const [generatorData, setGeneratorData] = useState<Record<string, any>>({})
  const [csvData, setCsvData] = useState<Record<string, any>[]>([])
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

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

  const handleSaveTemplate = async () => {
    if (!designerTemplate.name || !designerTemplate.fields || designerTemplate.fields.length === 0) {
      alert('Please provide a template name and at least one field')
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

  const handleAddField = () => {
    const newField: CertificateField = {
      id: `field-${Date.now()}`,
      type: 'text',
      label: 'New Field',
      key: 'fieldKey',
      x: 100,
      y: 100,
      fontSize: 24,
      fontFamily: 'Arial',
      color: '#000000',
      align: 'center',
      bold: false,
      italic: false
    }
    setDesignerTemplate(prev => ({
      ...prev,
      fields: [...(prev.fields || []), newField]
    }))
    setSelectedField(newField.id)
  }

  const handleUpdateField = (fieldId: string, updates: Partial<CertificateField>) => {
    setDesignerTemplate(prev => ({
      ...prev,
      fields: (prev.fields || []).map(f => f.id === fieldId ? { ...f, ...updates } : f)
    }))
  }

  const handleDeleteField = (fieldId: string) => {
    setDesignerTemplate(prev => ({
      ...prev,
      fields: (prev.fields || []).filter(f => f.id !== fieldId)
    }))
    if (selectedField === fieldId) setSelectedField(null)
  }

  const handleFieldDrag = (fieldId: string, e: React.MouseEvent) => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scale = canvas.offsetWidth / (designerTemplate.width || 1056)
    
    const startX = e.clientX
    const startY = e.clientY
    const field = designerTemplate.fields?.find(f => f.id === fieldId)
    if (!field) return
    
    const startFieldX = field.x
    const startFieldY = field.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / scale
      const deltaY = (moveEvent.clientY - startY) / scale
      handleUpdateField(fieldId, {
        x: Math.max(0, Math.min((designerTemplate.width || 1056) - 100, startFieldX + deltaX)),
        y: Math.max(0, Math.min((designerTemplate.height || 816) - 50, startFieldY + deltaY))
      })
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      setDraggingField(null)
    }

    setDraggingField(fieldId)
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
        setView('list')
        setCsvData([])
        setUploadedFile(null)
      }
    } catch (error) {
      console.error('Error bulk generating:', error)
    }
    setSaving(false)
  }

  const handleSingleGenerate = async () => {
    if (!selectedTemplate) return

    setSaving(true)
    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          data: generatorData
        })
      })

      if (res.ok) {
        alert('Certificate generated successfully!')
        setGeneratorData({})
        setView('list')
      }
    } catch (error) {
      console.error('Error generating certificate:', error)
    }
    setSaving(false)
  }

  if (!clerkLoaded || !isSignedIn) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const scale = 0.6

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
            </nav>
            <UserButton afterSignOutUrl="/sign-in"/>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* LIST VIEW */}
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
                        {template.fields.length} fields
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

        {/* DESIGNER VIEW */}
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
              {/* Settings Panel */}
              <div className="glass rounded-2xl p-6 space-y-4">
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
                  <label className="text-xs font-semibold text-gray-600 block mb-1.5">Background Image URL</label>
                  <input value={designerTemplate.backgroundUrl} onChange={e => setDesignerTemplate(prev => ({ ...prev, backgroundUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
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
                    <h4 className="font-bold text-sm text-gray-700">Fields ({designerTemplate.fields?.length || 0})</h4>
                    <button onClick={handleAddField}
                      className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600">
                      + Add Field
                    </button>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {designerTemplate.fields?.map(field => (
                      <div key={field.id}
                        onClick={() => setSelectedField(field.id)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedField === field.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm text-gray-800">{field.label}</span>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteField(field.id) }}
                            className="text-red-500 hover:text-red-700 text-xs">
                            ✕
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">Key: {field.key}</p>
                        <p className="text-xs text-gray-400">Position: ({Math.round(field.x)}, {Math.round(field.y)})</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Canvas */}
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
                    {designerTemplate.fields?.map(field => (
                      <div key={field.id}
                        onMouseDown={(e) => handleFieldDrag(field.id, e)}
                        className={`absolute cursor-move select-none ${selectedField === field.id ? 'ring-2 ring-blue-500' : ''} ${draggingField === field.id ? 'opacity-50' : ''}`}
                        style={{
                          left: `${field.x * scale}px`,
                          top: `${field.y * scale}px`,
                          fontSize: `${field.fontSize * scale}px`,
                          fontFamily: field.fontFamily,
                          color: field.color,
                          textAlign: field.align,
                          fontWeight: field.bold ? 'bold' : 'normal',
                          fontStyle: field.italic ? 'italic' : 'normal'
                        }}>
                        {field.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Field Editor */}
                {selectedField && designerTemplate.fields?.find(f => f.id === selectedField) && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                    <h4 className="font-bold text-sm text-gray-800 mb-3">Edit Field</h4>
                    {(() => {
                      const field = designerTemplate.fields.find(f => f.id === selectedField)!
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Label</label>
                            <input value={field.label} onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Data Key</label>
                            <input value={field.key} onChange={e => handleUpdateField(field.id, { key: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Font Size</label>
                            <input type="number" value={field.fontSize} onChange={e => handleUpdateField(field.id, { fontSize: parseInt(e.target.value) || 24 })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"/>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Color</label>
                            <input type="color" value={field.color} onChange={e => handleUpdateField(field.id, { color: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm h-9"/>
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Font Family</label>
                            <select value={field.fontFamily} onChange={e => handleUpdateField(field.id, { fontFamily: e.target.value })}
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
                            <select value={field.align} onChange={e => handleUpdateField(field.id, { align: e.target.value as any })}
                              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                          <div className="col-span-2 flex gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={field.bold} onChange={e => handleUpdateField(field.id, { bold: e.target.checked })}
                                className="w-4 h-4"/>
                              <span className="text-sm font-semibold text-gray-700">Bold</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={field.italic} onChange={e => handleUpdateField(field.id, { italic: e.target.checked })}
                                className="w-4 h-4"/>
                              <span className="text-sm font-semibold text-gray-700">Italic</span>
                            </label>
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

        {/* GENERATOR VIEW */}
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
              {/* Single Generation */}
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

                  {selectedTemplate && selectedTemplate.fields.map(field => (
                    <div key={field.id}>
                      <label className="text-xs font-semibold text-gray-600 block mb-1.5">{field.label}</label>
                      <input value={generatorData[field.key] || ''} onChange={e => setGeneratorData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500"/>
                    </div>
                  ))}

                  <button onClick={handleSingleGenerate} disabled={!selectedTemplate || saving}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold disabled:opacity-50">
                    {saving ? 'Generating...' : 'Generate Certificate'}
                  </button>
                </div>
              </div>

              {/* Bulk Generation */}
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
          </div>
        )}
      </main>
    </div>
  )
}
