'use client'

import React, { useEffect, useRef, useState } from 'react'
import { savePatientNotes } from '@/app/actions/consultationActions'
import { NotebookPen, Check, Loader2 } from 'lucide-react'
import { toast } from 'react-toastify'

interface PatientNotesPanelProps {
    appointmentId: string
    /** Anything the patient saved previously, so re-opening the call restores it. */
    initialNotes?: string | null
    /** Shown above the box, so the patient knows who they are consulting. */
    doctorName?: string
}

/**
 * The patient's own notes during a consultation — questions to ask, what the doctor
 * said, dosages to remember. Saved against the appointment and visible only to them
 * (the doctor's `notes` field is a separate, doctor-only column).
 */
const PatientNotesPanel: React.FC<PatientNotesPanelProps> = ({
    appointmentId,
    initialNotes,
    doctorName,
}) => {
    const [notes, setNotes] = useState(initialNotes ?? '')
    const [saving, setSaving] = useState(false)
    const [savedAt, setSavedAt] = useState<Date | null>(null)

    // What is currently persisted, so the "unsaved changes" hint reflects reality rather
    // than just "has the user typed anything at all".
    const lastSavedRef = useRef(initialNotes ?? '')
    const dirty = notes !== lastSavedRef.current

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await savePatientNotes(appointmentId, notes)
            if (res.success) {
                lastSavedRef.current = notes
                setSavedAt(new Date())
                toast.success('Notes saved')
            } else {
                toast.error(res.message)
            }
        } catch {
            toast.error('Could not save your notes. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    // A consultation ending (or the tab closing) must not silently discard what the
    // patient typed. This is a best-effort nudge, not a substitute for pressing Save.
    useEffect(() => {
        const warnIfUnsaved = (event: BeforeUnloadEvent) => {
            if (notes !== lastSavedRef.current) event.preventDefault()
        }
        window.addEventListener('beforeunload', warnIfUnsaved)
        return () => window.removeEventListener('beforeunload', warnIfUnsaved)
    }, [notes])

    return (
        <div className="bg-white h-full overflow-y-auto p-6 border-l shadow-xl flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <NotebookPen className="w-5 h-5 text-primary" /> My Notes
                </h2>
                {savedAt && !dirty && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <Check className="w-3.5 h-3.5" /> Saved
                    </span>
                )}
            </div>

            <p className="text-sm text-gray-500 mb-4">
                {doctorName
                    ? `Jot down anything from your consultation with ${doctorName}.`
                    : 'Jot down anything from your consultation.'}{' '}
                Only you can see these.
            </p>

            <textarea
                className="w-full flex-1 min-h-[200px] border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                placeholder="Questions to ask, medicines and dosages, what to do next…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={5000}
            />

            <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                <span>{dirty ? 'Unsaved changes' : ' '}</span>
                <span>{notes.length}/5000</span>
            </div>

            <button
                onClick={handleSave}
                disabled={saving || !dirty}
                className="w-full mt-4 py-3 rounded-lg text-white font-medium transition-colors bg-primary hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {saving ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                    </>
                ) : (
                    'Save Notes'
                )}
            </button>
        </div>
    )
}

export default PatientNotesPanel
