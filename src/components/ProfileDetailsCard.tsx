'use client'

import React, { useState } from 'react'
import { toast } from 'react-toastify'
import {
    Activity,
    AlertCircle,
    Calendar,
    Droplet,
    MapPin,
    Phone,
    Plus,
    Ruler,
    User as UserIcon,
    Weight,
    X,
} from 'lucide-react'
import { updateProfileDetails } from '@/app/actions/userActions'
import {
    BLOOD_GROUPS,
    dobInputValue,
    formatAddress,
    formatDob,
    formatPhone,
    GENDER_CHOICES,
    GENDER_UNSET,
    isGenderSet,
    isPhoneSet,
    isValidPhone,
    normalizeGender,
    profileCompleteness,
    toAddress,
    type ProfileDetails,
} from '@/lib/profile'

const inputClass =
    'w-full bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-all'
const labelClass = 'text-xs font-semibold text-gray-500 mb-1.5 block'
const sectionTitleClass = 'text-xs font-bold text-gray-400 uppercase tracking-wider mb-4'

/** BMI needs both measurements; without them there is nothing honest to display. */
function computeBmi(heightCm?: number | null, weightKg?: number | null) {
    if (!heightCm || !weightKg) return null
    const metres = heightCm / 100
    const bmi = weightKg / (metres * metres)
    if (!Number.isFinite(bmi)) return null

    const band =
        bmi < 18.5
            ? { label: 'Underweight', tone: 'text-amber-600 bg-amber-50' }
            : bmi < 25
              ? { label: 'Normal', tone: 'text-emerald-600 bg-emerald-50' }
              : bmi < 30
                ? { label: 'Overweight', tone: 'text-amber-600 bg-amber-50' }
                : { label: 'Obese', tone: 'text-red-600 bg-red-50' }

    return { value: bmi.toFixed(1), ...band }
}

const StatCard = ({
    icon: Icon,
    label,
    value,
    unit,
    badge,
    iconTone = 'bg-blue-50 text-blue-600',
    wide = false,
}: {
    icon: React.ElementType
    label: string
    value: string
    unit?: string
    badge?: { label: string; tone: string }
    iconTone?: string
    wide?: boolean
}) => (
    <div
        className={`bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex ${
            wide ? 'items-start gap-3 col-span-2 md:col-span-4 text-left' : 'flex-col items-center text-center'
        }`}
    >
        <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${wide ? '' : 'mb-3'} ${iconTone}`}
        >
            <Icon className='w-5 h-5' />
        </div>
        <div className={wide ? 'min-w-0' : ''}>
            <p className='text-xs text-gray-500 font-bold uppercase tracking-wider mb-1'>{label}</p>
            <p className={`font-bold text-gray-900 ${wide ? 'text-sm' : 'text-lg'}`}>
                {value}
                {unit && <span className='text-xs font-medium text-gray-400'> {unit}</span>}
                {badge && (
                    <span className={`ml-1 text-xs font-medium px-1.5 py-0.5 rounded ${badge.tone}`}>
                        {badge.label}
                    </span>
                )}
            </p>
        </div>
    </div>
)

/**
 * The patient's profile details, shown only once they have been entered.
 *
 * These used to be hard-coded (175cm / 70kg / BMI 22.8 / 72bpm / blood group O+), which
 * reads as the patient's own data in a medical app. Nothing appears here unless the
 * patient filled it in.
 */
const ProfileDetailsCard = ({
    profile,
    onSaved,
}: {
    profile: ProfileDetails
    onSaved: () => void | Promise<void>
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const [gender, setGender] = useState(GENDER_UNSET as string)
    const [dob, setDob] = useState('')
    const [phone, setPhone] = useState('')
    const [line1, setLine1] = useState('')
    const [line2, setLine2] = useState('')
    const [heightCm, setHeightCm] = useState('')
    const [weightKg, setWeightKg] = useState('')
    const [bloodGroup, setBloodGroup] = useState('')
    const [allergies, setAllergies] = useState('')

    const completeness = profileCompleteness(profile)
    const bmi = computeBmi(profile.heightCm, profile.weightKg)
    const address = toAddress(profile.address)

    const openForm = () => {
        // Re-seed from the saved profile so a cancelled edit never persists, and so the
        // gender select always starts on a value that exists in its option list.
        setGender(normalizeGender(profile.gender))
        setDob(dobInputValue(profile.dob))
        setPhone(isPhoneSet(profile.phone) ? (profile.phone as string) : '')
        setLine1(address.line1)
        setLine2(address.line2)
        setHeightCm(profile.heightCm?.toString() ?? '')
        setWeightKg(profile.weightKg?.toString() ?? '')
        setBloodGroup(profile.bloodGroup ?? '')
        setAllergies(profile.allergies ?? '')
        setIsOpen(true)
    }

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault()
        if (saving) return

        if (phone.trim() && !isValidPhone(phone)) {
            toast.error('Enter a valid phone number')
            return
        }

        const formData = new FormData()
        formData.append('gender', gender)
        formData.append('dob', dob)
        formData.append('phone', phone)
        formData.append('addressLine1', line1)
        formData.append('addressLine2', line2)
        formData.append('heightCm', heightCm)
        formData.append('weightKg', weightKg)
        formData.append('bloodGroup', bloodGroup)
        formData.append('allergies', allergies)

        setSaving(true)
        let res
        try {
            res = await updateProfileDetails(formData)
        } finally {
            setSaving(false)
        }

        if (!res.success) {
            toast.error(res.message)
            return
        }

        toast.success(res.message)
        setIsOpen(false)
        await onSaved()
    }

    const draftBmi = computeBmi(Number(heightCm) || null, Number(weightKg) || null)

    return (
        <div>
            <div className='flex items-center justify-between mb-4 px-2'>
                <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider'>Profile Details</h3>
                {completeness.hasAny && (
                    <button onClick={openForm} className='text-xs font-semibold text-primary hover:underline'>
                        {completeness.isComplete ? 'Edit' : 'Complete profile'}
                    </button>
                )}
            </div>

            {completeness.hasAny && !completeness.isComplete && (
                <div className='bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mb-4'>
                    <div className='flex justify-between items-center mb-2'>
                        <p className='text-sm font-semibold text-gray-900'>Profile completion</p>
                        <span className='text-sm font-bold text-primary'>{completeness.percent}%</span>
                    </div>
                    <div className='w-full bg-gray-100 rounded-full h-2'>
                        <div
                            className='bg-primary h-2 rounded-full transition-all duration-500'
                            style={{ width: `${completeness.percent}%` }}
                        />
                    </div>
                    <p className='text-xs text-gray-500 mt-2'>
                        {completeness.done} of {completeness.total} details added.
                    </p>
                </div>
            )}

            {completeness.hasAny ? (
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                    {isGenderSet(profile.gender) && (
                        <StatCard icon={UserIcon} label='Gender' value={normalizeGender(profile.gender)} />
                    )}
                    {completeness.filled.dob && (
                        <StatCard icon={Calendar} label='Birthday' value={formatDob(profile.dob)} />
                    )}
                    {completeness.filled.phone && (
                        <StatCard icon={Phone} label='Phone' value={formatPhone(profile.phone)} />
                    )}
                    {profile.heightCm && (
                        <StatCard icon={Ruler} label='Height' value={String(profile.heightCm)} unit='cm' />
                    )}
                    {profile.weightKg && (
                        <StatCard icon={Weight} label='Weight' value={String(profile.weightKg)} unit='kg' />
                    )}
                    {bmi && (
                        <StatCard
                            icon={Activity}
                            label='BMI'
                            value={bmi.value}
                            badge={{ label: bmi.label, tone: bmi.tone }}
                        />
                    )}
                    {profile.bloodGroup && (
                        <StatCard
                            icon={Droplet}
                            label='Blood Group'
                            value={profile.bloodGroup}
                            iconTone='bg-red-50 text-red-500'
                        />
                    )}
                    {completeness.filled.address && (
                        <StatCard
                            icon={MapPin}
                            label='Address'
                            value={formatAddress(profile.address)}
                            iconTone='bg-blue-50 text-blue-600'
                            wide
                        />
                    )}
                    {profile.allergies && (
                        <StatCard
                            icon={AlertCircle}
                            label='Allergies'
                            value={profile.allergies}
                            iconTone='bg-amber-50 text-amber-500'
                            wide
                        />
                    )}
                </div>
            ) : (
                <button
                    onClick={openForm}
                    className='w-full bg-white border border-dashed border-blue-200 rounded-2xl p-8 text-center hover:border-primary hover:bg-blue-50/40 transition-colors group'
                >
                    <div className='w-12 h-12 rounded-full bg-blue-50 text-primary flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform'>
                        <Plus className='w-6 h-6' />
                    </div>
                    <p className='font-bold text-gray-900'>Complete your profile</p>
                    <p className='text-sm text-gray-500 mt-1'>
                        Add your birthday, phone, address and health details so your doctor and Aether AI
                        have the full picture.
                    </p>
                </button>
            )}

            {isOpen && (
                <div
                    className='fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4'
                    onClick={() => setIsOpen(false)}
                >
                    <form
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={handleSave}
                        className='bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 max-h-[90vh] overflow-y-auto'
                    >
                        <div className='flex items-start justify-between mb-6'>
                            <div>
                                <h2 className='text-xl font-bold text-gray-900'>Complete your profile</h2>
                                <p className='text-sm text-gray-500 mt-1'>
                                    Every field is optional — leave anything blank you would rather not share.
                                </p>
                            </div>
                            <button
                                type='button'
                                onClick={() => setIsOpen(false)}
                                className='p-2 -mr-2 -mt-1 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors'
                                aria-label='Close'
                            >
                                <X className='w-5 h-5' />
                            </button>
                        </div>

                        {/* ── Personal ─────────────────────────────────────── */}
                        <p className={sectionTitleClass}>Personal</p>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                            <div>
                                <label className={labelClass}>Gender</label>
                                <select
                                    className={`${inputClass} appearance-none`}
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                >
                                    <option value={GENDER_UNSET}>Prefer not to say</option>
                                    {GENDER_CHOICES.map((choice) => (
                                        <option key={choice} value={choice}>
                                            {choice}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Date of birth</label>
                                <input
                                    className={inputClass}
                                    type='date'
                                    max={new Date().toISOString().slice(0, 10)}
                                    value={dob}
                                    onChange={(e) => setDob(e.target.value)}
                                />
                            </div>
                            <div className='sm:col-span-2'>
                                <label className={labelClass}>Phone number</label>
                                <input
                                    className={inputClass}
                                    type='tel'
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder='e.g. 98765 43210'
                                />
                            </div>
                            <div className='sm:col-span-2'>
                                <label className={labelClass}>Address</label>
                                <div className='flex flex-col gap-2'>
                                    <input
                                        className={inputClass}
                                        type='text'
                                        value={line1}
                                        onChange={(e) => setLine1(e.target.value)}
                                        placeholder='Address line 1'
                                    />
                                    <input
                                        className={inputClass}
                                        type='text'
                                        value={line2}
                                        onChange={(e) => setLine2(e.target.value)}
                                        placeholder='Address line 2'
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Health ───────────────────────────────────────── */}
                        <p className={`${sectionTitleClass} mt-7`}>Health</p>
                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
                            <div>
                                <label className={labelClass}>Height (cm)</label>
                                <input
                                    className={inputClass}
                                    type='number'
                                    min={30}
                                    max={275}
                                    value={heightCm}
                                    onChange={(e) => setHeightCm(e.target.value)}
                                    placeholder='e.g. 172'
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Weight (kg)</label>
                                <input
                                    className={inputClass}
                                    type='number'
                                    min={1}
                                    max={500}
                                    step='0.1'
                                    value={weightKg}
                                    onChange={(e) => setWeightKg(e.target.value)}
                                    placeholder='e.g. 68.5'
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Blood group</label>
                                <select
                                    className={`${inputClass} appearance-none`}
                                    value={bloodGroup}
                                    onChange={(e) => setBloodGroup(e.target.value)}
                                >
                                    <option value=''>Not specified</option>
                                    {BLOOD_GROUPS.map((group) => (
                                        <option key={group} value={group}>
                                            {group}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className='sm:col-span-2'>
                                <label className={labelClass}>Allergies</label>
                                <textarea
                                    className={`${inputClass} min-h-20`}
                                    value={allergies}
                                    onChange={(e) => setAllergies(e.target.value)}
                                    maxLength={500}
                                    placeholder='e.g. Penicillin, peanuts — or leave blank if none'
                                />
                            </div>
                        </div>

                        {draftBmi && (
                            <p className='text-sm text-gray-500 mt-5'>
                                BMI works out to{' '}
                                <span className='font-bold text-gray-900'>{draftBmi.value}</span> (
                                {draftBmi.label}).
                            </p>
                        )}

                        <div className='flex gap-3 mt-8'>
                            <button
                                type='submit'
                                disabled={saving}
                                className='flex-1 bg-primary hover:bg-primary/90 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors'
                            >
                                {saving ? 'Saving...' : 'Save profile'}
                            </button>
                            <button
                                type='button'
                                onClick={() => setIsOpen(false)}
                                className='px-6 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors'
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

export default ProfileDetailsCard
