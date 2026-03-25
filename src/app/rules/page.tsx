'use client'
import Link from 'next/link'
import { useState } from 'react'

const SECTIONS = [
  {
    id: 'sec1',
    title: 'Section 1 — Computer Laboratory (DTC Com Lab)',
    icon: '🖥️',
    color: 'blue',
    subsections: [
      {
        title: '1.1  Cleanliness and Order',
        rules: [
          'Maintain cleanliness at all times. Dispose of trash properly in designated bins only.',
          'Food and drinks are strictly prohibited inside the computer laboratory. Consume food only in designated areas outside.',
          'Keep your workstation clean and organized. Return chairs and peripherals to their original position after use.',
          'Report any spills, damage, or cleanliness concerns to the staff-in-charge immediately.',
        ],
      },
      {
        title: '1.2  Respect and Conduct',
        rules: [
          { text: 'Respect all persons in the facility — staff, fellow clients, interns, and visitors. Bullying, harassment, intimidation, or any form of verbal or physical abuse is strictly prohibited.', note: 'Zero tolerance — immediate removal from premises' },
          'Maintain a quiet and focused environment. Minimize noise and avoid unnecessary disturbances to others.',
          { text: 'Hacking, unauthorized access to other users\' accounts or data, interception of network traffic, and any form of data intervention is a serious offense.', note: 'Legal liability under RA 10175 Cybercrime Prevention Act' },
          'Do not attempt to access another person\'s files, browsing history, accounts, or personal information in any manner.',
        ],
      },
      {
        title: '1.3  Equipment Use and Care',
        rules: [
          'Handle all computer equipment — monitors, keyboards, mice, cables, peripherals — with care. Avoid applying force, misuse, or rough handling.',
          'Report any defective equipment, loose connections, or hardware issues to the staff-in-charge. Do not attempt to repair equipment yourself.',
          { text: 'Do not modify, rearrange, or tamper with the physical computer setup including wirings, power connections, cable routing, or monitor adjustments. Leave all hardware as configured by staff.', note: 'Equipment damage charge' },
          'Do not remove any equipment, cables, accessories, or peripherals from the laboratory.',
          'Upon completing your session, properly power off the computer following the standard shutdown procedure. Do not force-cut power. Unplug or switch off equipment only when instructed.',
        ],
      },
      {
        title: '1.4  Software and Internet Use',
        rules: [
          'Internet access is provided for educational, research, government transaction, and work-related purposes only.',
          { text: 'Do not install, download, or run any software, application, or file without explicit permission from the staff-in-charge.', note: 'Session termination' },
          { text: 'Accessing pornographic, gambling, or other inappropriate websites is strictly prohibited.', note: 'Immediate removal — blacklisting' },
          { text: 'Plugging in USB drives, external storage devices, or any unknown hardware without permission from staff is not allowed. This is a security measure to prevent malware.', note: 'Session termination' },
          'Do not attempt to bypass, circumvent, or disable any security software, firewall, content filter, or network policy.',
          'Playing computer games is not permitted unless explicitly authorized by the instructor or staff-in-charge. Gaming should not interfere with others\' use of the facility.',
          'Do not use the facility\'s computers for commercial activities, unauthorized streaming, cryptocurrency mining, or any activity that consumes excessive bandwidth.',
        ],
      },
      {
        title: '1.5  Session and Logbook',
        rules: [
          'All walk-in clients must log in using the DTC Client Logbook (dict.it.com/dtc-logbook) upon arrival. Provide your complete name, agency or school, and purpose of visit.',
          'Log out at the end of your session. The system records your time-in and time-out for service tracking.',
          'Sessions are subject to a maximum of two (2) hours per visit during peak hours. Extensions may be granted by the staff-in-charge if workstations are available.',
          'Saving personal files locally is not recommended. The DTC is not responsible for any data loss. Use cloud storage or personal devices for important files.',
        ],
      },
    ],
  },
  {
    id: 'sec2',
    title: 'Section 2 — DTC Hall',
    icon: '🏛️',
    color: 'indigo',
    subsections: [
      {
        title: '2.1  Cleanliness and Hygiene',
        rules: [
          'Maintain cleanliness at all times. Dispose of all trash and waste in the designated bins provided throughout the hall.',
          'Eating and drinking are allowed only in designated areas. Clean up after yourself. Do not leave food waste, containers, or debris on tables, floors, or seats.',
          'Report any spills or sanitation concerns to staff immediately.',
        ],
      },
      {
        title: '2.2  Conduct and Noise',
        rules: [
          'Keep noise to a minimum at all times. Conversations should be conducted at appropriate volume. Loud music, shouting, or disruptive behavior is not permitted.',
          'Respect all other occupants of the hall — fellow attendees, staff, and visitors.',
          'Always follow instructions from staff, facilitators, trainers, or DTC management at all times.',
        ],
      },
      {
        title: '2.3  Space and Property',
        rules: [
          'Respect the facility, furniture, and equipment. Treat all chairs, tables, projectors, screens, and fixtures with care.',
          { text: 'Vandalism — including writing on walls, tables, chairs, or any property — is strictly prohibited.', note: 'Legal action and cost of damages' },
          'Do not rearrange furniture or equipment without authorization from staff.',
          'Turn off lights, electric fans, air conditioning units, projectors, and all electrical equipment after use or when leaving the hall.',
        ],
      },
      {
        title: '2.4  Safety and Security',
        rules: [
          'Do not bring prohibited, dangerous, or illegal items into the DTC premises. This includes weapons, explosive materials, or any item that may cause harm.',
          'Keep all pathways, emergency exits, and fire escape routes clear and unobstructed at all times.',
          'Follow the scheduled use of the hall. Prior reservation or coordination with DTC staff is required for events, trainings, or group activities.',
          'In case of emergency, follow staff instructions immediately and proceed calmly to the nearest exit.',
        ],
      },
    ],
  },
  {
    id: 'sec3',
    title: 'Section 3 — Intern Guidelines',
    icon: '🎓',
    color: 'violet',
    subsections: [
      {
        title: '3.1  Attendance and Time Tracking',
        rules: [
          'Interns must log their daily time-in and time-out using the Intern Logbook system at dict.it.com/intern-logbook. Manual attendance tracking is not accepted.',
          { text: 'Time-in must be recorded upon arrival. Do not ask others to log in on your behalf — this constitutes falsification of attendance records.', note: 'Disciplinary action — potential internship termination' },
          'A progress note is required at time-out. Briefly describe what you accomplished during the day. Incomplete time-out submissions will not count toward OJT hours.',
          'The system automatically closes sessions at 5:00 PM. Interns who are still working beyond this time must re-log their session with approval from the supervisor.',
          'Target completion: 486 OJT hours. Track your progress via the intern logbook dashboard. Coordinate with your supervisor for scheduling.',
        ],
      },
      {
        title: '3.2  Task Management',
        rules: [
          'Tasks are assigned by the supervisor or admin through the system. Check your task list daily upon logging in.',
          { text: 'Mark tasks as complete only when they are actually finished. Do not mark tasks complete prematurely.', note: 'Task review by supervisor' },
          'For questions, clarifications, or blockers on assigned tasks, use the task comment feature in the system or approach the assigned supervisor directly.',
          'Deadlines must be respected. Notify your supervisor in advance if a task cannot be completed on time.',
        ],
      },
      {
        title: '3.3  Professional Conduct',
        rules: [
          'Dress appropriately when attending the DTC. Business casual or school uniform is required unless otherwise specified.',
          'Interns are expected to behave professionally at all times — with staff, walk-in clients, and the general public.',
          { text: 'Confidentiality must be maintained. Do not share, discuss, or disclose any client data, government records, internal documents, or system access credentials with unauthorized persons.', note: 'Legal liability under RA 10173 Data Privacy Act' },
          'Report any technical issues, system errors, or security concerns to the supervisor or IT staff immediately. Do not attempt unauthorized fixes.',
        ],
      },
    ],
  },
  {
    id: 'sec4',
    title: 'Section 4 — Data Privacy and Digital Security',
    icon: '🔒',
    color: 'emerald',
    subsections: [
      {
        title: 'In compliance with Republic Act No. 10173 (Data Privacy Act of 2012)',
        rules: [
          'Personal information collected (name, agency, contact details) is used exclusively for DTC service records and will not be shared with third parties without legal basis.',
          'Clients and interns have the right to access, correct, or request deletion of their personal data by contacting DTC staff.',
          'Photo capture for identification purposes is optional and requires explicit consent. Photos are stored securely and used only for identification.',
          'Any suspected data breach, unauthorized access, or privacy violation must be reported to the DTC staff or IT officer immediately.',
        ],
      },
    ],
  },
  {
    id: 'sec5',
    title: 'Section 5 — Violations and Sanctions',
    icon: '⚖️',
    color: 'red',
    subsections: [],
    sanctions: [
      { level: 'Minor', examples: 'Noise disturbance, minor cleanliness violation, unauthorized food', sanction: 'Verbal warning → Written warning', color: 'yellow' },
      { level: 'Moderate', examples: 'Unauthorized USB, game use without permission, not logging in/out', sanction: 'Session termination → Temporary suspension of access', color: 'orange' },
      { level: 'Major', examples: 'Bullying, harassment, unauthorized software installation, data tampering', sanction: 'Immediate removal from premises → Permanent ban', color: 'red' },
      { level: 'Severe', examples: 'Hacking, cybercrime, data theft, vandalism, possession of prohibited items', sanction: 'Permanent ban → Report to school → Legal action', color: 'rose' },
    ],
  },
]

type Rule = string | { text: string; note: string }

function RuleItem({ num, rule }: { num: number; rule: Rule }) {
  const isObj = typeof rule === 'object'
  return (
    <li className="flex gap-3 text-sm leading-relaxed">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center mt-0.5">{num}</span>
      <span className="text-gray-700 flex-1">
        {isObj ? rule.text : rule}
        {isObj && (
          <span className="ml-2 inline-flex items-center text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
            ⚠ {rule.note}
          </span>
        )}
      </span>
    </li>
  )
}

const colorMap: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    badge: 'bg-blue-100 text-blue-700' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  badge: 'bg-indigo-100 text-indigo-700' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  red:     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700' },
}

const sanctionColors: Record<string, string> = {
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  orange: 'bg-orange-50 border-orange-200 text-orange-800',
  red:    'bg-red-50 border-red-200 text-red-800',
  rose:   'bg-rose-50 border-rose-200 text-rose-900',
}

export default function RulesPage() {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setOpen(p => ({ ...p, [id]: !p[id] }))

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          body { font-size: 12px; }
        }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .fade-up { animation: fadeUp .4s ease both; }
      `}</style>

      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="bg-[#0038A8] text-white print:bg-[#0038A8]">
        <div className="flex h-1.5"><div className="flex-1 bg-[#0038A8]"/><div className="flex-1 bg-[#CE1126]"/><div className="flex-1 bg-[#FCD116]"/></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl flex-shrink-0">📋</div>
            <div className="flex-1">
              <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Republic of the Philippines · DICT Region V</p>
              <h1 className="text-2xl sm:text-3xl font-black leading-tight mb-1">House Rules and Guidelines</h1>
              <p className="text-blue-200 text-sm">Digital Transformation Center — Legazpi City, Albay, Bicol</p>
              <p className="text-blue-300 text-xs mt-1.5">Effective: 2026</p>
            </div>
          </div>
          <p className="mt-5 text-sm text-blue-100 leading-relaxed max-w-2xl">
            These guidelines ensure a safe, orderly, and productive environment for all clients, interns, staff, and visitors.
            All persons entering the premises are expected to read, understand, and comply with these rules at all times.
          </p>
        </div>
      </div>

      {/* ─── Back nav ────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 no-print">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#0038A8] font-semibold hover:underline">
            ← Back to Home
          </Link>
          <div className="flex gap-2">
            <Link href="/dtc-logbook"
              className="px-4 py-2 bg-[#0038A8] text-white text-sm font-bold rounded-lg hover:bg-blue-800 transition-colors">
              📋 Go to Logbook
            </Link>
            <button onClick={() => window.print()}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors">
              🖨 Print
            </button>
          </div>
        </div>
      </div>

      {/* ─── Section cards ───────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-12 space-y-4 fade-up">
        {SECTIONS.map((sec, si) => {
          const c = colorMap[sec.color]
          const isOpen = open[sec.id] !== false
          return (
            <div key={sec.id} className={`rounded-2xl border ${c.border} overflow-hidden shadow-sm`}>
              {/* Section header */}
              <button
                onClick={() => toggle(sec.id)}
                className={`w-full flex items-center gap-4 px-5 py-4 ${c.bg} text-left no-print:cursor-pointer`}>
                <span className="text-2xl flex-shrink-0">{sec.icon}</span>
                <span className={`flex-1 font-bold text-base sm:text-lg ${c.text}`}>{sec.title}</span>
                <span className={`${c.text} text-lg no-print`}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="p-5 space-y-6 bg-white">
                  {/* Intro text for Section 4 */}
                  {sec.id === 'sec4' && (
                    <p className="text-sm text-gray-500 leading-relaxed bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                      In compliance with <strong>Republic Act No. 10173 (Data Privacy Act of 2012)</strong>, the DICT DTC collects and processes
                      personal information solely for the purpose of service delivery, attendance tracking, and facility management.
                      All data collected through the logbook system is stored securely on government premises.
                    </p>
                  )}

                  {sec.subsections.map((sub, subi) => (
                    <div key={subi}>
                      <h3 className={`text-xs font-black uppercase tracking-widest ${c.text} mb-3`}>{sub.title}</h3>
                      <ol className="space-y-2.5">
                        {sub.rules.map((rule, ri) => (
                          <RuleItem key={ri} num={si < 3 ? ri + 1 : ri + 1} rule={rule as Rule} />
                        ))}
                      </ol>
                    </div>
                  ))}

                  {/* Sanctions table */}
                  {'sanctions' in sec && sec.sanctions && (
                    <div>
                      <p className="text-xs text-gray-400 mb-3">
                        Violations will be dealt with appropriately based on the nature and severity of the offense.
                      </p>
                      <div className="space-y-2.5">
                        {sec.sanctions.map((s, i) => (
                          <div key={i} className={`border rounded-xl px-4 py-3 ${sanctionColors[s.color]}`}>
                            <div className="flex items-start gap-3">
                              <span className="font-black text-sm w-20 flex-shrink-0">{s.level}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs leading-relaxed opacity-80">{s.examples}</p>
                                <p className="text-xs font-bold mt-1 opacity-90">→ {s.sanction}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* ─── Acknowledgment ──────────────────────────────────── */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-gray-800 text-base mb-2">Acknowledgment</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-4">
            By entering and using the DICT Digital Transformation Center facilities, all clients, interns, and visitors
            agree to comply with these House Rules and Guidelines.{' '}
            <strong className="text-gray-700">Ignorance of these rules is not an excuse for non-compliance.</strong>
          </p>
          <div className="grid sm:grid-cols-2 gap-6 mt-6 border-t border-gray-100 pt-5">
            <div>
              <p className="text-xs text-gray-400 mb-6">Client / Intern Signature</p>
              <div className="border-b border-gray-300 w-full"/>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-6">Date</p>
              <div className="border-b border-gray-300 w-full"/>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center mt-6">DICT DTC Region V  ·  dict.it.com  ·  dict.gov.ph</p>
        </div>

        {/* ─── CTA ─────────────────────────────────────────────── */}
        <div className="no-print rounded-2xl bg-[#0038A8] text-white p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-lg">Ready to use the DTC?</p>
            <p className="text-blue-200 text-sm">Log in to the Client Logbook to start your session.</p>
          </div>
          <Link href="/dtc-logbook"
            className="px-6 py-3 bg-white text-[#0038A8] font-bold rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap shadow-lg">
            🖥️ Open Logbook →
          </Link>
        </div>
      </main>
    </div>
  )
}
