'use client'

import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '@/context/AppContext'
import { getProfile, updateProfile } from '@/app/actions/userActions'
import { toast } from 'react-toastify'
import { Mail, Phone, MapPin, User as UserIcon, Calendar, Droplet, Activity, FileText, ChevronRight, Bot, Ruler, Weight, HeartPulse, Sparkles, Plus, AlertCircle } from 'lucide-react'

const MyProfile = () => {
    const { token, userData, setUserData } = useContext(AppContext)
    const [isEdit, setIsEdit] = useState(false)
    const [image, setImage] = useState<File | null>(null)

    const loadProfileData = async () => {
        const res = await getProfile()
        if (res.success) {
            setUserData(res.userData)
        }
    }

    const updateUserProfileData = async () => {
        try {
            const formData = new FormData()
            formData.append('name', userData.name)
            formData.append('phone', userData.phone)
            formData.append('address', JSON.stringify(userData.address))
            formData.append('gender', userData.gender)
            formData.append('dob', userData.dob)
            if (image) formData.append('image', image)

            const res = await updateProfile(formData)
            if (res.success) {
                toast.success(res.message)
                await loadProfileData()
                setIsEdit(false)
                setImage(null)
            } else {
                toast.error(res.message)
            }
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    useEffect(() => {
        if (token) {
            loadProfileData()
        }
    }, [token])

    if (!userData) return <div className='min-h-[60vh] flex items-center justify-center font-medium text-blue-600'>Loading Profile Data...</div>

    return (
        <div className='min-h-screen bg-blue-50/40 pb-20'>
            {/* Header Area Background */}
            <div className="h-40 bg-gradient-to-r from-blue-600 to-blue-800 relative overflow-hidden">
                <div 
                    className='absolute inset-0 z-0 opacity-20 bg-cover bg-center mix-blend-overlay'
                    style={{ backgroundImage: "url('/assets/header_img.png')" }}
                ></div>
            </div>

            <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10'>
                <div className='flex flex-col lg:flex-row gap-8'>
                    
                    {/* Left Column */}
                    <div className='w-full lg:w-1/3 flex flex-col gap-6'>
                        
                        {/* Profile Summary Card */}
                        <div className='bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm flex flex-col items-center text-center relative pt-12'>
                            
                            {/* Profile Image */}
                            <div className='absolute -top-16'>
                                <label htmlFor="image">
                                    <div className={`relative w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-blue-50 flex items-center justify-center ${isEdit ? 'cursor-pointer group' : ''}`}>
                                        <img
                                            className={`w-full h-full object-cover transition-opacity ${isEdit ? 'group-hover:opacity-50' : ''}`}
                                            src={
                                                image
                                                    ? URL.createObjectURL(image)
                                                    : userData.image?.trim()
                                                        ? userData.image
                                                        : "/assets/profile_pic.png"
                                            }
                                            alt="Profile"
                                        />
                                        {isEdit && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                                <img src="/assets/upload_icon.png" className="w-8 h-8 mb-1" alt="Upload" />
                                                <span className="text-white text-xs font-bold">Upload</span>
                                            </div>
                                        )}
                                    </div>
                                    <input disabled={!isEdit} onChange={(e) => setImage(e.target.files?.[0] || null)} type="file" id="image" hidden />
                                </label>
                            </div>

                            <div className='mt-8 w-full'>
                                {isEdit ? (
                                    <input 
                                        className='w-full text-center bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-2xl font-bold text-gray-900 rounded-xl px-4 py-2 transition-all outline-none' 
                                        type='text' 
                                        value={userData.name} 
                                        onChange={(e) => setUserData((prev: any) => ({ ...prev, name: e.target.value }))} 
                                        placeholder="Full Name"
                                    />
                                ) : (
                                    <h2 className='text-2xl font-bold text-gray-900'>{userData.name}</h2>
                                )}
                                
                                <div className='mt-3 flex items-center justify-center gap-2'>
                                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200">Patient</span>
                                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100 flex items-center gap-1">
                                        <Activity className="w-3 h-3" /> Health Score: 92
                                    </span>
                                </div>
                            </div>

                            <div className='w-full border-t border-gray-100 mt-6 pt-6'>
                                {isEdit ? (
                                    <button 
                                        className='w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 hover:shadow-md transition-all shadow-sm' 
                                        onClick={updateUserProfileData}
                                    >
                                        Save Information
                                    </button>
                                ) : (
                                    <button 
                                        className='w-full bg-white border border-gray-200 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-50 hover:shadow-sm transition-all shadow-sm' 
                                        onClick={() => setIsEdit(true)}
                                    >
                                        Edit Profile
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Personal Information Card */}
                        <div className='bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm'>
                            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2'>
                                <UserIcon className="w-4 h-4 text-blue-600" /> Personal Information
                            </h3>
                            
                            <div className='flex flex-col gap-5'>
                                <div className='flex gap-4'>
                                    <div className='w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0'>
                                        <Mail className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className='flex-1'>
                                        <p className='text-xs text-gray-500 font-medium mb-1'>Email Address</p>
                                        <p className='text-sm font-medium text-gray-900'>{userData.email}</p>
                                    </div>
                                </div>

                                <div className='flex gap-4'>
                                    <div className='w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0'>
                                        <Phone className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className='flex-1'>
                                        <p className='text-xs text-gray-500 font-medium mb-1'>Phone Number</p>
                                        {isEdit ? (
                                            <input 
                                                className='w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 rounded-lg px-3 py-1.5 transition-all outline-none' 
                                                type='text' 
                                                value={userData.phone} 
                                                onChange={(e) => setUserData((prev: any) => ({ ...prev, phone: e.target.value }))} 
                                            />
                                        ) : (
                                            <p className='text-sm font-medium text-gray-900'>{userData.phone || 'Not provided'}</p>
                                        )}
                                    </div>
                                </div>

                                <div className='flex gap-4'>
                                    <div className='w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0'>
                                        <MapPin className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className='flex-1'>
                                        <p className='text-xs text-gray-500 font-medium mb-1'>Address</p>
                                        {isEdit ? (
                                            <div className="flex flex-col gap-2">
                                                <input 
                                                    className='w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 rounded-lg px-3 py-1.5 transition-all outline-none' 
                                                    type="text" 
                                                    placeholder="Line 1"
                                                    value={userData.address.line1} 
                                                    onChange={(e) => setUserData((prev: any) => ({ ...prev, address: { ...prev.address, line1: e.target.value } }))} 
                                                />
                                                <input 
                                                    className='w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-medium text-gray-900 rounded-lg px-3 py-1.5 transition-all outline-none' 
                                                    type="text" 
                                                    placeholder="Line 2"
                                                    value={userData.address.line2} 
                                                    onChange={(e) => setUserData((prev: any) => ({ ...prev, address: { ...prev.address, line2: e.target.value } }))} 
                                                />
                                            </div>
                                        ) : (
                                            <p className='text-sm font-medium text-gray-900 leading-relaxed'>
                                                {userData.address.line1}<br />
                                                {userData.address.line2}
                                                {(!userData.address.line1 && !userData.address.line2) && 'Not provided'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Health Profile Card */}
                        <div className='bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm'>
                            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2'>
                                <Activity className="w-4 h-4 text-blue-600" /> Health Profile
                            </h3>
                            
                            <div className='grid grid-cols-2 gap-4'>
                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2 text-gray-500">
                                        <UserIcon className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Gender</span>
                                    </div>
                                    {isEdit ? (
                                        <select 
                                            className='w-full bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-gray-900 rounded-lg px-2 py-1 transition-all outline-none appearance-none' 
                                            onChange={(e) => setUserData((prev: any) => ({ ...prev, gender: e.target.value }))} 
                                            value={userData.gender}
                                        >
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                            <option value="Not Selected">Select</option>
                                        </select>
                                    ) : (
                                        <p className='text-sm font-bold text-gray-900'>{userData.gender}</p>
                                    )}
                                </div>

                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2 text-gray-500">
                                        <Calendar className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Birthday</span>
                                    </div>
                                    {isEdit ? (
                                        <input 
                                            className='w-full bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-gray-900 rounded-lg px-2 py-1 transition-all outline-none' 
                                            type='date' 
                                            value={userData.dob} 
                                            onChange={(e) => setUserData((prev: any) => ({ ...prev, dob: e.target.value }))} 
                                        />
                                    ) : (
                                        <p className='text-sm font-bold text-gray-900'>{userData.dob || 'Not set'}</p>
                                    )}
                                </div>

                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2 text-gray-500">
                                        <Droplet className="w-4 h-4 text-red-400" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Blood Group</span>
                                    </div>
                                    <p className='text-sm font-bold text-gray-900'>O+ <span className="text-xs text-gray-400 font-normal">(UI Only)</span></p>
                                </div>

                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                    <div className="flex items-center gap-2 mb-2 text-gray-500">
                                        <AlertCircle className="w-4 h-4 text-yellow-500" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Allergies</span>
                                    </div>
                                    <p className='text-sm font-bold text-gray-900'>None <span className="text-xs text-gray-400 font-normal">(UI Only)</span></p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column */}
                    <div className='w-full lg:w-2/3 flex flex-col gap-6 mt-8 lg:mt-0'>
                        
                        {/* Profile Completion Bar */}
                        <div className="bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm flex items-center justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-gray-900">Profile Completion</h3>
                                    <span className="text-sm font-bold text-blue-600">80%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-1000" style={{ width: '80%' }}></div>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Complete your profile to unlock all AI insights.</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>

                        {/* Health Summary Grid */}
                        <div>
                            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 px-2'>Health Summary</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
                                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                                        <Ruler className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Height</p>
                                    <p className="text-lg font-bold text-gray-900">175 <span className="text-xs font-medium text-gray-400">cm</span></p>
                                </div>

                                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
                                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                                        <Weight className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Weight</p>
                                    <p className="text-lg font-bold text-gray-900">70 <span className="text-xs font-medium text-gray-400">kg</span></p>
                                </div>

                                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
                                    <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mb-3">
                                        <Activity className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">BMI</p>
                                    <p className="text-lg font-bold text-gray-900">22.8 <span className="text-xs font-medium text-green-500 bg-green-50 px-1 rounded">Normal</span></p>
                                </div>

                                <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
                                    <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mb-3">
                                        <HeartPulse className="w-5 h-5 text-red-500" />
                                    </div>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Heart Rate</p>
                                    <p className="text-lg font-bold text-gray-900">72 <span className="text-xs font-medium text-gray-400">bpm</span></p>
                                </div>
                            </div>
                        </div>

                        {/* Digital Health Records */}
                        <div className='bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm mt-2'>
                            <div className="flex justify-between items-center mb-5">
                                <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
                                    <FileText className="w-4 h-4 text-blue-600" /> Digital Health Records
                                </h3>
                            </div>
                            
                            <button
                                onClick={() => window.location.href = '/my-profile/prescriptions'}
                                className="w-full relative overflow-hidden group bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 hover:shadow-md transition-all duration-300 text-left flex items-center gap-4"
                            >
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                    <FileText className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-lg font-bold text-gray-900 mb-1">My Prescriptions</p>
                                    <p className="text-sm text-gray-500">Scan & Manage Handwritten Notes using AI</p>
                                </div>
                                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <ChevronRight className="w-5 h-5" />
                                </div>
                            </button>
                        </div>

                        {/* AI Health Assistant Preview */}
                        <div className='bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm'>
                            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider mb-5 flex items-center gap-2'>
                                <Bot className="w-4 h-4 text-blue-600" /> AI Health Assistant
                            </h3>
                            
                            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                                <div className="flex gap-4">
                                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                                        <Bot className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm p-4 shadow-sm text-sm text-gray-700 leading-relaxed">
                                        <p className="mb-2"><span className="font-bold text-gray-900">Hello {userData.name.split(' ')[0]},</span> your health profile looks great today!</p>
                                        <p>Based on your latest records, I recommend scheduling a routine checkup soon. Would you like me to find a top-rated general physician nearby?</p>
                                    </div>
                                </div>
                                
                                <div className="flex gap-3 mt-4 ml-14">
                                    <button className="bg-blue-50 text-blue-600 border border-blue-100 px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors">
                                        Find a Doctor
                                    </button>
                                    <button className="bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-gray-50 transition-colors">
                                        Not now
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    )
}

export default MyProfile
