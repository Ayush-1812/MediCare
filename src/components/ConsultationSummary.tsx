'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

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
