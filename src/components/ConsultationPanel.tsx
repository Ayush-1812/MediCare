'use client'

import React, { useState, useEffect } from 'react'
import { endConsultation } from '@/app/actions/consultationActions'
import { toast } from 'react-toastify'

interface ConsultationPanelProps {
    appointmentId: string
    startTime?: string | Date
    onEndCall: () => void
}

const ConsultationPanel: React.FC<ConsultationPanelProps> = ({ appointmentId, startTime, onEndCall }) => {
    const [duration, setDuration] = useState(0)
    const [diagnosis, setDiagnosis] = useState('')
    const [prescription, setPrescription] = useState('')
    const [notes, setNotes] = useState('')
    const [followUpDate, setFollowUpDate] = useState('')
    const [isEnding, setIsEnding] = useState(false)

    useEffect(() => {
        if (!startTime) return

        const start = new Date(startTime).getTime()
        const interval = setInterval(() => {
            const now = new Date().getTime()
            setDuration(Math.floor((now - start) / 1000))
        }, 1000)

        return () => clearInterval(interval)
    }, [startTime])

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }

    const handleEndConsultation = async () => {
        if (!diagnosis) {
            toast.warn('Please enter a diagnosis before ending')
            return
        }

        setIsEnding(true)
        try {
            const res = await endConsultation(appointmentId, {
                diagnosis,
                prescription,
                notes,
                followUpDate: followUpDate || undefined
            })

            if (res.success) {
                toast.success('Consultation ended successfully')
                onEndCall()
            } else {
                toast.error(res.message)
            }
        } catch (error) {
            console.error(error)
            toast.error('Failed to end consultation')
        } finally {
            setIsEnding(false)
        }
    }

    return (
        <div className="bg-white h-full overflow-y-auto p-6 border-l shadow-xl flex flex-col">
            <div className="flex justify-between items-center mb-6 pb-4 border-b">
                <h2 className="text-xl font-bold text-gray-800">Consultation</h2>
                <div className="bg-red-50 text-red-600 px-3 py-1 rounded-full font-mono font-medium">
                    {formatTime(duration)}
                </div>
            </div>

            <div className="space-y-4 flex-1">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
                    <textarea
                        className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                        rows={3}
                        placeholder="Enter diagnosis..."
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prescription</label>
                    <textarea
                        className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                        rows={5}
                        placeholder="Rx..."
                        value={prescription}
                        onChange={(e) => setPrescription(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Private Notes</label>
                    <textarea
                        className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                        rows={3}
                        placeholder="Notes for yourself..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Date</label>
                    <input
                        type="date"
                        className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                    />
                </div>
            </div>

            <button
                onClick={handleEndConsultation}
                disabled={isEnding}
                className={`w-full mt-6 py-3 rounded-lg text-white font-medium transition-colors ${isEnding ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700'
                    }`}
            >
                {isEnding ? 'Ending Session...' : 'End Consultation'}
            </button>
        </div>
    )
}

export default ConsultationPanel
