'use client'
import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────
type School = {
  _id: string; name: string; type?: string; address?: string; email?: string
  practicumCoordinator?: string; coordinatorEmail?: string; coordinatorPhone?: string
}

type DocKey = 'photo2x2'|'resume'|'application'|'endorsement'|'medical'|'wfh'|'workplan'|'nda'|'notes'
type DocState = { url: string; storageId: string; uploading: boolean; error: string }

const DOC_LABELS: Record<DocKey, string> = {
  photo2x2:    '2x2 Photo',
  resume:      'Resume / CV',
  application: 'Application Form',
  endorsement: 'Endorsement Letter',
  medical:     'Medical Certificate',
  wfh:         'WFH Agreement',
  workplan:    'DICT Work Plan',
  nda:         'NDA',
  notes:       'Additional Notes / Files',
}
const DOC_ICONS: Record<DocKey, string> = {
  photo2x2:'🖼️', resume:'📄', application:'📋', endorsement:'✉️',
  medical:'🏥', wfh:'🏠', workplan:'📊', nda:'🔏', notes:'📝',
}
const CIVIL_STATUSES = ['Single','Married','Widowed','Separated','Divorced']
const OFFICE_OPTIONS = ['DICT Region V - Main Office','DTC Legazpi City','DTC Naga City','DTC Daet','DTC Sorsogon City','DTC Masbate City','DTC Virac']

// ── Main page ─────────────────────────────────────────────────────────────────
function RegisterContent() {
  const router = useRouter()
  const params = useSearchParams()

  // Steps: 1=Personal, 2=Academic, 3=Details, 4=Photo, 5=Documents, 6=Done
  const [step, setStep] = useState(1)
  const TOTAL_STEPS = 5

  // ── Form state ──────────────────────────────────────────────────────────────
  const [personal, setPersonal] = useState({
    fullName: '', email: '', phone: '',
    sex: '' as 'M'|'F'|'', age: '', civilStatus: '',
    isIndigenous: false, isPWD: false, isSoloParent: false,
  })
  const [academic, setAcademic] = useState({
    schoolId: '', school: '', course: '', requiredHours: '486',
    officeAssignment: '', onboardingDate: '', estimatedCompletion: '',
    supervisor: '', department: '',
  })
  const [schools, setSchools] = useState<School[]>([])

  // ── Photo ───────────────────────────────────────────────────────────────────
  const [photoDataUrl, setPhotoDataUrl] = useState<string|null>(null)
  const [photoStorageId, setPhotoStorageId] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoMode, setPhotoMode] = useState<'none'|'camera'|'upload'>('none')
  const [cameraStream, setCameraStream] = useState<MediaStream|null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const photoFileRef = useRef<HTMLInputElement>(null)

  // ── Documents ───────────────────────────────────────────────────────────────
  const initDocs = (): Record<DocKey, DocState> => {
    const keys: DocKey[] = ['photo2x2','resume','application','endorsement','medical','wfh','workplan','nda','notes']
    return Object.fromEntries(keys.map(k => [k, { url:'', storageId:'', uploading:false, error:'' }])) as Record<DocKey, DocState>
  }
  const [docs, setDocs] = useState<Record<DocKey, DocState>>(initDocs())

  // ── Errors / saving ─────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // ── Load schools ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/schools')
      .then(r => r.json())
      .then((d: School[]) => { if (Array.isArray(d)) setSchools(d) })
      .catch(() => {})
  }, [])

  // Pre-fill if referral params present
  useEffect(() => {
    const name = params.get('name'); const email = params.get('email')
    if (name) setPersonal(p => ({ ...p, fullName: name }))
    if (email) setPersonal(p => ({ ...p, email }))
  }, [params])

  // ── Camera helpers ──────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      setCameraStream(stream)
      setPhotoMode('camera')
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream }, 100)
    } catch {
      alert('Could not access camera. Please allow camera permission or use file upload instead.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    cameraStream?.getTracks().forEach(t => t.stop())
    setCameraStream(null)
  }, [cameraStream])

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    canvas.width  = video.videoWidth  || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setPhotoDataUrl(dataUrl)
    stopCamera()
    setPhotoMode('none')
    // Upload to Convex
    setPhotoUploading(true)
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const fd = new FormData(); fd.append('file', blob, 'photo.jpg')
      const res = await fetch('/api/interns/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const { url, storageId } = await res.json()
        setPhotoUrl(url); setPhotoStorageId(storageId)
      }
    } catch { /* silent - photo still stored as dataUrl */ }
    setPhotoUploading(false)
  }, [stopCamera])

  const handlePhotoFile = useCallback(async (file: File) => {
    const reader = new FileReader()
    reader.onload = e => setPhotoDataUrl(e.target?.result as string)
    reader.readAsDataURL(file)
    setPhotoUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/interns/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const { url, storageId } = await res.json()
        setPhotoUrl(url); setPhotoStorageId(storageId)
      }
    } catch { /* silent */ }
    setPhotoUploading(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  // ── Document upload ──────────────────────────────────────────────────────────
  const uploadDoc = async (key: DocKey, file: File) => {
    setDocs(d => ({ ...d, [key]: { ...d[key], uploading: true, error: '' } }))
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/interns/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error((await res.json()).error || 'Upload failed')
      const { url, storageId } = await res.json()
      setDocs(d => ({ ...d, [key]: { url, storageId, uploading: false, error: '' } }))
    } catch (e) {
      setDocs(d => ({ ...d, [key]: { ...d[key], uploading: false, error: e instanceof Error ? e.message : 'Upload failed' } }))
    }
  }

  // ── Validation ───────────────────────────────────────────────────────────────
  const validateStep = (s: number) => {
    const errs: Record<string,string> = {}
    if (s === 1) {
      if (!personal.fullName.trim()) errs.fullName = 'Full name is required'
      if (!personal.email.trim())    errs.email    = 'Email is required'
    }
    if (s === 2) {
      if (!academic.school.trim()) errs.school = 'School is required'
      if (!academic.course.trim()) errs.course = 'Course is required'
      if (!academic.onboardingDate) errs.onboardingDate = 'Onboarding date is required'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const nextStep = () => {
    if (!validateStep(step)) return
    if (step < TOTAL_STEPS) setStep(s => s + 1)
  }
  const prevStep = () => setStep(s => Math.max(1, s - 1))

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep(step)) return
    setSaving(true); setSubmitError('')
    try {
      const body = {
        fullName:           personal.fullName.trim(),
        email:              personal.email.trim()    || undefined,
        phone:              personal.phone.trim()    || undefined,
        sex:                personal.sex             || undefined,
        age:                personal.age ? parseInt(personal.age) : undefined,
        civilStatus:        personal.civilStatus     || undefined,
        isIndigenous:       personal.isIndigenous    || undefined,
        isPWD:              personal.isPWD           || undefined,
        isSoloParent:       personal.isSoloParent    || undefined,
        school:             academic.school,
        schoolId:           academic.schoolId        || undefined,
        course:             academic.course,
        requiredHours:      academic.requiredHours   || '486',
        officeAssignment:   academic.officeAssignment|| undefined,
        supervisor:         academic.supervisor      || undefined,
        department:         academic.department      || undefined,
        startDate:          academic.onboardingDate  || new Date().toISOString().slice(0,10),
        endDate:            academic.estimatedCompletion || new Date(Date.now() + 180*86400000).toISOString().slice(0,10),
        onboardingDate:     academic.onboardingDate  || undefined,
        estimatedCompletion:academic.estimatedCompletion || undefined,
        photoUrl:           photoUrl                 || undefined,
        photoStorageId:     photoStorageId           || undefined,
        // Document storage IDs (admin-only access)
        doc2x2StorageId:          docs.photo2x2.storageId    || undefined,
        docResumeStorageId:       docs.resume.storageId      || undefined,
        docApplicationStorageId:  docs.application.storageId || undefined,
        docEndorsementStorageId:  docs.endorsement.storageId || undefined,
        docMedicalStorageId:      docs.medical.storageId     || undefined,
        docWfhStorageId:          docs.wfh.storageId         || undefined,
        docWorkPlanStorageId:     docs.workplan.storageId    || undefined,
        docNdaStorageId:          docs.nda.storageId         || undefined,
        docNotesStorageId:        docs.notes.storageId       || undefined,
      }
      const res = await fetch('/api/interns/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setSubmitError(data.error || 'Registration failed'); return }
      setStep(6)
    } catch { setSubmitError('Network error. Please try again.') } finally { setSaving(false) }
  }

  // ── School picker helper ─────────────────────────────────────────────────────
  const onSchoolSelect = (s: School) => {
    setAcademic(a => ({
      ...a,
      schoolId:  s._id,
      school:    s.name,
      supervisor:s.practicumCoordinator || a.supervisor,
    }))
  }

  const inputCls = 'w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#0038A8] focus:ring-2 focus:ring-blue-100 transition-all bg-white'
  const labelCls = 'text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5'

  // ── Render ────────────────────────────────────────────────────────────────────
  if (step === 6) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-5xl">✅</span>
        </div>
        <h2 className="text-2xl font-black text-gray-800 mb-3">Registration Complete!</h2>
        <p className="text-gray-500 mb-2">Welcome to DICT DTC Region V, <strong>{personal.fullName}</strong>!</p>
        <p className="text-sm text-gray-400 mb-8">Your internship profile has been submitted. The admin team will complete your onboarding.</p>
        <Link href="/" className="block w-full py-3 rounded-xl bg-[#0038A8] text-white font-bold text-sm hover:bg-blue-800 transition-colors text-center">
          Back to Home
        </Link>
      </div>
    </div>
  )

  const stepLabels = ['Personal Info', 'Academic Info', 'Details', 'Photo', 'Documents']

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#0038A8] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white text-2xl font-black">D</span>
          </div>
          <h1 className="text-2xl font-black text-gray-800">Intern Registration</h1>
          <p className="text-gray-500 text-sm mt-1">DICT DTC Region V — Digital Transformation Center</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center mb-8 px-2">
          {stepLabels.map((label, i) => {
            const n = i + 1
            const done    = step > n
            const current = step === n
            return (
              <div key={n} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    done    ? 'bg-green-500 text-white shadow-md' :
                    current ? 'bg-[#0038A8] text-white shadow-md ring-4 ring-blue-100' :
                    'bg-gray-200 text-gray-500'
                  }`}>{done ? '✓' : n}</div>
                  <p className={`text-[10px] mt-1 font-semibold hidden sm:block ${current ? 'text-[#0038A8]' : done ? 'text-green-600' : 'text-gray-400'}`}>
                    {label}
                  </p>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`flex-1 h-1 mx-1 rounded-full transition-all ${done || current ? 'bg-[#0038A8]' : 'bg-gray-200'}`}/>
                )}
              </div>
            )
          })}
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-[#0038A8]/5 to-blue-50/30">
            <h2 className="font-bold text-gray-800 text-lg">Step {step}: {stepLabels[step-1]}</h2>
          </div>
          <div className="p-8 space-y-5">

            {/* ── STEP 1: PERSONAL INFO ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input value={personal.fullName}
                    onChange={e=>setPersonal(p=>({...p,fullName:e.target.value}))}
                    placeholder="First Middle Last" className={inputCls}/>
                  {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Email Address *</label>
                    <input type="email" value={personal.email}
                      onChange={e=>setPersonal(p=>({...p,email:e.target.value}))}
                      placeholder="intern@email.com" className={inputCls}/>
                    {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Phone Number</label>
                    <input type="tel" value={personal.phone}
                      onChange={e=>setPersonal(p=>({...p,phone:e.target.value}))}
                      placeholder="09xx-xxx-xxxx" className={inputCls}/>
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className={labelCls}>Sex</label>
                    <select value={personal.sex} onChange={e=>setPersonal(p=>({...p,sex:e.target.value as 'M'|'F'|''}))} className={inputCls}>
                      <option value="">Select…</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Age</label>
                    <input type="number" min="16" max="40" value={personal.age}
                      onChange={e=>setPersonal(p=>({...p,age:e.target.value}))}
                      placeholder="e.g. 21" className={inputCls}/>
                  </div>
                  <div>
                    <label className={labelCls}>Civil Status</label>
                    <select value={personal.civilStatus} onChange={e=>setPersonal(p=>({...p,civilStatus:e.target.value}))} className={inputCls}>
                      <option value="">Select…</option>
                      {CIVIL_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  <p className={labelCls}>Additional Attributes (check all that apply)</p>
                  {([
                    ['isIndigenous', '🌿', 'Indigenous People (IP)'],
                    ['isPWD',        '♿', 'Person with Disability (PWD)'],
                    ['isSoloParent', '👨‍👧', 'Solo Parent'],
                  ] as const).map(([key, icon, label]) => (
                    <label key={key} className="flex items-center gap-3 cursor-pointer">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${personal[key as keyof typeof personal] ? 'bg-[#0038A8] border-[#0038A8]' : 'border-gray-300'}`}
                        onClick={()=>setPersonal(p=>({...p,[key]:!p[key as keyof typeof personal]}))}>
                        {personal[key as keyof typeof personal] && <span className="text-white text-[10px] font-black">✓</span>}
                      </div>
                      <span className="text-sm text-gray-700">{icon} {label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 2: ACADEMIC INFO ── */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>School / University *</label>
                  {schools.length > 0 ? (
                    <div className="space-y-2">
                      <select value={academic.schoolId}
                        onChange={e=>{
                          const s = schools.find(sc=>sc._id===e.target.value)
                          if (s) onSchoolSelect(s)
                          else setAcademic(a=>({...a,schoolId:'',school:''}))
                        }} className={inputCls}>
                        <option value="">Select from registered schools…</option>
                        {schools.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
                      </select>
                      {academic.schoolId && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 space-y-0.5">
                          {schools.find(s=>s._id===academic.schoolId)?.type && <p>🏫 {schools.find(s=>s._id===academic.schoolId)?.type}</p>}
                          {schools.find(s=>s._id===academic.schoolId)?.address && <p>📍 {schools.find(s=>s._id===academic.schoolId)?.address}</p>}
                          {schools.find(s=>s._id===academic.schoolId)?.practicumCoordinator && <p>👤 PC: {schools.find(s=>s._id===academic.schoolId)?.practicumCoordinator}</p>}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-gray-200"/>
                        <span className="text-xs text-gray-400">or type manually</span>
                        <div className="flex-1 h-px bg-gray-200"/>
                      </div>
                    </div>
                  ) : null}
                  <input value={academic.school}
                    onChange={e=>setAcademic(a=>({...a,school:e.target.value,schoolId:''}))}
                    placeholder="School name" className={inputCls}/>
                  {errors.school && <p className="text-red-500 text-xs mt-1">{errors.school}</p>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Course / Program *</label>
                    <input value={academic.course}
                      onChange={e=>setAcademic(a=>({...a,course:e.target.value}))}
                      placeholder="e.g. BS Information Technology" className={inputCls}/>
                    {errors.course && <p className="text-red-500 text-xs mt-1">{errors.course}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>No. of Required Hours</label>
                    <input type="number" min="100" value={academic.requiredHours}
                      onChange={e=>setAcademic(a=>({...a,requiredHours:e.target.value}))}
                      placeholder="486" className={inputCls}/>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Onboarding Date *</label>
                    <input type="date" value={academic.onboardingDate}
                      onChange={e=>setAcademic(a=>({...a,onboardingDate:e.target.value}))}
                      className={inputCls}/>
                    {errors.onboardingDate && <p className="text-red-500 text-xs mt-1">{errors.onboardingDate}</p>}
                  </div>
                  <div>
                    <label className={labelCls}>Estimated Completion</label>
                    <input type="date" value={academic.estimatedCompletion}
                      onChange={e=>setAcademic(a=>({...a,estimatedCompletion:e.target.value}))}
                      className={inputCls}/>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Office Assignment</label>
                  <select value={academic.officeAssignment}
                    onChange={e=>setAcademic(a=>({...a,officeAssignment:e.target.value}))} className={inputCls}>
                    <option value="">Select office…</option>
                    {OFFICE_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Practicum Coordinator</label>
                    <input value={academic.supervisor}
                      onChange={e=>setAcademic(a=>({...a,supervisor:e.target.value}))}
                      placeholder="Name of supervisor from school" className={inputCls}/>
                  </div>
                  <div>
                    <label className={labelCls}>Department / Section</label>
                    <input value={academic.department}
                      onChange={e=>setAcademic(a=>({...a,department:e.target.value}))}
                      placeholder="e.g. ICT Division" className={inputCls}/>
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 3: DETAILS (summary / review) ── */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-3 text-sm">
                  <h3 className="font-bold text-gray-700 text-base">Registration Summary</h3>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                    {[
                      ['Name',    personal.fullName],
                      ['Email',   personal.email],
                      ['Phone',   personal.phone   || '—'],
                      ['Sex',     personal.sex === 'M' ? 'Male' : personal.sex === 'F' ? 'Female' : '—'],
                      ['Age',     personal.age     || '—'],
                      ['Civil Status', personal.civilStatus || '—'],
                      ['School',  academic.school  || '—'],
                      ['Course',  academic.course  || '—'],
                      ['Req. Hours', academic.requiredHours || '486'],
                      ['Office',  academic.officeAssignment || '—'],
                      ['Onboarding', academic.onboardingDate || '—'],
                      ['Estimated Completion', academic.estimatedCompletion || '—'],
                    ].map(([label, val]) => (
                      <div key={label} className="flex items-start gap-2">
                        <span className="text-gray-400 font-semibold w-32 flex-shrink-0">{label}:</span>
                        <span className="text-gray-700 font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 flex-wrap mt-2">
                    {personal.isIndigenous && <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">🌿 IP</span>}
                    {personal.isPWD        && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">♿ PWD</span>}
                    {personal.isSoloParent && <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">👨‍👧 Solo Parent</span>}
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">← Go back to edit. Next steps are optional (photo + documents).</p>
              </div>
            )}

            {/* ── STEP 4: PHOTO ── */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                  <span>💡</span>
                  <span>Photo is <strong>optional</strong> but helps staff identify you during check-in. You can use your camera or upload a file.</span>
                </div>

                {/* Photo preview */}
                {photoDataUrl && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-white shadow-lg">
                      <img src={photoDataUrl} alt="Preview" className="w-full h-full object-cover"/>
                    </div>
                    {photoUploading && <p className="text-xs text-blue-600 font-semibold animate-pulse">⬆ Uploading to secure storage…</p>}
                    {photoUrl && <p className="text-xs text-green-600 font-semibold">✅ Uploaded securely</p>}
                    <button onClick={()=>{setPhotoDataUrl(null);setPhotoUrl('');setPhotoStorageId('')}}
                      className="text-xs text-red-500 hover:text-red-700 underline">Remove photo</button>
                  </div>
                )}

                {/* Camera live view */}
                {photoMode === 'camera' && (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl overflow-hidden bg-black" style={{aspectRatio:'4/3'}}>
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 border-4 border-white/30 rounded-2xl pointer-events-none"/>
                    </div>
                    <canvas ref={canvasRef} className="hidden"/>
                    <div className="flex gap-3">
                      <button onClick={capturePhoto}
                        className="flex-1 py-3 rounded-xl bg-[#0038A8] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-800 transition-colors">
                        📸 Capture Photo
                      </button>
                      <button onClick={()=>{stopCamera();setPhotoMode('none')}}
                        className="px-5 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Controls */}
                {!photoDataUrl && photoMode === 'none' && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button onClick={startCamera}
                      className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer">
                      <span className="text-4xl">📷</span>
                      <div className="text-center">
                        <p className="font-bold text-gray-700 text-sm">Use Camera</p>
                        <p className="text-xs text-gray-400 mt-0.5">Take a selfie directly</p>
                      </div>
                    </button>
                    <label className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer">
                      <input ref={photoFileRef} type="file" accept="image/*" className="hidden"
                        onChange={e=>{ const f=e.target.files?.[0]; if(f) handlePhotoFile(f) }}/>
                      <span className="text-4xl">🖼️</span>
                      <div className="text-center">
                        <p className="font-bold text-gray-700 text-sm">Upload Photo</p>
                        <p className="text-xs text-gray-400 mt-0.5">Choose from device</p>
                      </div>
                    </label>
                  </div>
                )}
                <canvas ref={canvasRef} className="hidden"/>
              </div>
            )}

            {/* ── STEP 5: DOCUMENTS ── */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-700 flex items-start gap-2">
                  <span>🔒</span>
                  <span>All uploaded documents are <strong>encrypted and confidential</strong>. They are only accessible to authorized DICT DTC administrators.</span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {(Object.keys(DOC_LABELS) as DocKey[]).map(key => {
                    const d = docs[key]
                    return (
                      <div key={key} className={`rounded-2xl border-2 p-4 transition-all ${d.url ? 'border-green-200 bg-green-50' : 'border-gray-200 hover:border-blue-200 bg-white'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{DOC_ICONS[key]}</span>
                          <p className="font-semibold text-sm text-gray-800 flex-1">{DOC_LABELS[key]}</p>
                          {d.url && <span className="text-green-600 text-xs font-bold">✓ Uploaded</span>}
                        </div>
                        {d.error && <p className="text-xs text-red-500 mb-2">{d.error}</p>}
                        {d.uploading ? (
                          <div className="flex items-center gap-2 py-2">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                            <p className="text-xs text-blue-600">Uploading…</p>
                          </div>
                        ) : d.url ? (
                          <button onClick={()=>setDocs(dcs=>({...dcs,[key]:{url:'',storageId:'',uploading:false,error:''}}))}
                            className="text-xs text-red-400 hover:text-red-600 underline">Remove</button>
                        ) : (
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors">
                            <input type="file" accept="image/*,.pdf,.doc,.docx" className="hidden"
                              onChange={e=>{ const f=e.target.files?.[0]; if(f) uploadDoc(key,f) }}/>
                            <span>📎</span> Choose file
                          </label>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-400 text-center">All documents are optional. You can skip and submit now.</p>
                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex items-center gap-2">
                    <span>⚠</span>{submitError}
                  </div>
                )}
              </div>
            )}

            {/* ── Navigation ── */}
            <div className={`flex gap-3 pt-2 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
              {step > 1 && (
                <button onClick={prevStep}
                  className="px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors">
                  ← Back
                </button>
              )}
              {step < TOTAL_STEPS ? (
                <button onClick={nextStep}
                  className="px-8 py-3 rounded-xl bg-[#0038A8] text-white font-bold text-sm hover:bg-blue-800 transition-colors shadow-md">
                  {step === 3 ? 'Continue to Photo →' : 'Next →'}
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={saving}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#0038A8] to-blue-600 text-white font-bold text-sm hover:from-blue-800 hover:to-blue-700 transition-all shadow-md disabled:opacity-50 flex items-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Submitting…</> : '🎓 Submit Registration'}
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-gray-400 text-xs mt-6">
          Already registered? Visit the <a href="/" className="text-[#0038A8] underline">main portal</a>
        </p>
      </div>
    </div>
  )
}

export default function InternRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="w-10 h-10 border-4 border-[#0038A8]/30 border-t-[#0038A8] rounded-full animate-spin"/>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  )
}
