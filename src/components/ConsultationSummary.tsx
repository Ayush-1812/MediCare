'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'

interface ConsultationSummaryProps {
    // Every field is nullable: these come straight from the appointment row, where a
    // consultation that was cancelled before it started has none of them filled in.
    appointment: {
        id: string
        startTime?: string | null
        endTime?: string | null
        duration?: number | null
        diagnosis?: string | null
        prescription?: string | null
        notes?: string | null
        patientNotes?: string | null
        followUpDate?: string | null
        doctorName?: string | null
        patientName?: string | null
        slotDate?: string | null
        slotTime?: string | null
    }
    role: 'doctor' | 'patient'
}

const ConsultationSummary: React.FC<ConsultationSummaryProps> = ({ appointment, role }) => {
    const router = useRouter()

    const formatDate = (dateString?: string | null) => {
        if (!dateString) return 'N/A'
        const parsed = new Date(dateString)
        return Number.isNaN(parsed.getTime()) ? 'N/A' : parsed.toLocaleString()
    }

    const formatDuration = (seconds?: number | null) => {
        if (!seconds) return '0 mins'
        // A 90-second call used to render as "1 mins"; anything under a minute as "0 mins".
        if (seconds < 60) return `${seconds} sec`
        return `${Math.floor(seconds / 60)} mins`
    }

    /**
     * Downloads the report as a self-contained HTML file the patient keeps offline.
     *
     * Deliberately not a screenshot of this page: it is generated from the same data,
     * styled for printing, and opens in any browser. "Print" already existed but only
     * ever reached a printer or the OS "Save as PDF" dialog — this gives an actual file.
     */
    const handleSaveReport = () => {
        // Report content is user-entered free text (diagnosis, prescription, notes), so it
        // must be escaped before being interpolated into HTML — otherwise a stray "<" in a
        // dosage note would corrupt the document, and anything script-like would execute
        // when the saved file is opened.
        const escapeHtml = (value?: string | null) =>
            String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')

        const section = (title: string, body?: string | null, fallback = 'Not recorded.') =>
            `<h2>${escapeHtml(title)}</h2><div class="box">${escapeHtml(body) || fallback}</div>`

        const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Consultation Report — ${escapeHtml(appointment.slotDate ?? '')}</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2937; max-width: 760px; margin: 40px auto; padding: 0 24px; line-height: 1.6; }
  header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { margin: 0 0 4px; font-size: 24px; }
  .meta { color: #6b7280; font-size: 14px; }
  h2 { font-size: 16px; margin: 24px 0 8px; }
  .box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; white-space: pre-wrap; }
  .grid { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
  .grid div { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; font-size: 14px; }
  footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; color: #9ca3af; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>Consultation Report</h1>
  <p class="meta">
    Doctor: ${escapeHtml(appointment.doctorName) || 'N/A'} &nbsp;·&nbsp;
    Patient: ${escapeHtml(appointment.patientName) || 'N/A'}<br>
    ${escapeHtml(appointment.slotDate ?? '')} ${escapeHtml(appointment.slotTime ?? '')}
  </p>
</header>

<div class="grid">
  <div><strong>Duration:</strong> ${escapeHtml(formatDuration(appointment.duration))}</div>
  <div><strong>Start:</strong> ${escapeHtml(formatDate(appointment.startTime))}</div>
  <div><strong>End:</strong> ${escapeHtml(formatDate(appointment.endTime))}</div>
</div>

${section('Diagnosis', appointment.diagnosis, 'No diagnosis recorded.')}
${section('Prescription', appointment.prescription, 'No prescription issued.')}
${appointment.followUpDate ? `<h2>Follow-Up</h2><div class="box">${escapeHtml(new Date(appointment.followUpDate).toDateString())}</div>` : ''}
${role === 'patient' ? section('My Notes', appointment.patientNotes, 'No notes added.') : ''}
${role === 'doctor' ? section('Private Notes', appointment.notes, 'No private notes.') : ''}

<footer>
  MediCare Post-Consultation Report &nbsp;·&nbsp; Reference: ${escapeHtml(appointment.id)}<br>
  This report is a record of your consultation. Contact your doctor with any questions.
</footer>
</body>
</html>`

        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        // Date-stamped so a patient with several consultations gets distinct files rather
        // than "report (3).html".
        link.download = `medicare-consultation-${appointment.slotDate || appointment.id}.html`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        // Releasing the object URL prevents the blob being held in memory for the life of
        // the page.
        URL.revokeObjectURL(url)
    }

    return (
        <div className="max-w-3xl mx-auto my-10 bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
            <div className={`p-6 ${role === 'doctor' ? 'bg-indigo-50' : 'bg-green-50'} border-b flex justify-between items-center`}>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Consultation Report</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {role === 'doctor'
                            ? appointment.patientName || 'Patient'
                            : appointment.doctorName || 'Doctor'}
                        {appointment.slotTime ? ` · ${appointment.slotTime}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">ID: {appointment.id}</p>
                </div>
                <div className="text-right">
                    <span className={`px-4 py-1 rounded-full text-sm font-semibold ${role === 'doctor' ? 'bg-indigo-200 text-indigo-800' : 'bg-green-200 text-green-800'}`}>
                        {role === 'doctor' ? 'Doctor View' : 'Patient View'}
                    </span>
                    <p className="text-xs text-gray-500 mt-2">{formatDate(appointment.endTime)}</p>
                </div>
            </div>

            <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</p>
                        <p className="text-lg font-bold text-gray-800">{formatDuration(appointment.duration)}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Start Time</p>
                        <p className="text-sm font-medium text-gray-800">{formatDate(appointment.startTime)}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-xl">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">End Time</p>
                        <p className="text-sm font-medium text-gray-800">{formatDate(appointment.endTime)}</p>
                    </div>
                </div>

                <hr className="border-gray-100" />

                <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Diagnosis</h3>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <p className="text-gray-700 whitespace-pre-wrap">{appointment.diagnosis || "No diagnosis recorded."}</p>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Prescription</h3>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <p className="text-gray-700 whitespace-pre-wrap font-mono text-sm">{appointment.prescription || "No prescription issued."}</p>
                    </div>
                </div>

                {role === 'doctor' && (
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                            Private Notes
                            <span className="text-xs font-normal bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Only visible to you</span>
                        </h3>
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <p className="text-gray-700 whitespace-pre-wrap italic">{appointment.notes || "No private notes."}</p>
                        </div>
                    </div>
                )}

                {/* The patient's own notes — the mirror of the doctor's private notes, and
                    shown only to them for the same reason. */}
                {role === 'patient' && (
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                            My Notes
                            <span className="text-xs font-normal bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Only visible to you</span>
                        </h3>
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <p className="text-gray-700 whitespace-pre-wrap italic">
                                {appointment.patientNotes || 'You did not add any notes for this consultation.'}
                            </p>
                        </div>
                    </div>
                )}

                {appointment.followUpDate && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-4">
                        <div className="bg-green-100 p-2 rounded-full">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        </div>
                        <div>
                            <p className="text-sm text-green-800 font-semibold">Follow-Up Recommended</p>
                            <p className="text-lg font-bold text-green-900">{new Date(appointment.followUpDate).toDateString()}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-gray-50 px-8 py-6 border-t flex justify-between items-center">
                <p className="text-sm text-gray-500">Medicare Post-Consultation Report</p>
                <div className="flex gap-3">
                    <button
                        onClick={handleSaveReport}
                        className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-white transition-colors"
                    >
                        <Download className="w-4 h-4" /> Save Report
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-white transition-colors"
                    >
                        Print Report
                    </button>
                    <button
                        onClick={() => router.push(role === 'doctor' ? '/doctor-dashboard/appointments' : '/my-appointments')}
                        className="px-6 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConsultationSummary
