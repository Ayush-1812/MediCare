'use client'

import React, { useContext, useState } from 'react'
import { loginDoctor } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Stethoscope } from 'lucide-react'
import { AppContext } from '@/context/AppContext'

const DoctorLogin = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const { setDocToken } = useContext(AppContext)
    const router = useRouter()

    const onSubmitHandler = async (event: React.FormEvent) => {
        event.preventDefault()
        if (submitting) return

        const formData = new FormData()
        formData.append('email', email)
        formData.append('password', password)

        setSubmitting(true)
        let res
        try {
            res = await loginDoctor(formData)
        } finally {
            setSubmitting(false)
        }

        if (!res.success) {
            toast.error(res.message)
            return
        }

        localStorage.setItem('docToken', res.token)
        // Without this the navbar and dashboard shell never learn about the session,
        // because they read the doctor from context, not from localStorage.
        setDocToken(res.token)
        toast.success('Login Successful')
        router.push(res.profileCompleted ? '/' : '/doctor-dashboard/onboarding')
    }

    return (
        <div className='min-h-[85vh] flex items-center justify-center px-4'>
            <form onSubmit={onSubmitHandler} className='w-full max-w-md bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]'>
                <div className='flex flex-col items-center text-center mb-8'>
                    <div className='w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center shadow-sm mb-4'>
                        <Stethoscope className='w-7 h-7 text-white' />
                    </div>
                    <h2 className='text-2xl font-bold text-gray-900'>Doctor Login</h2>
                    <p className='text-gray-500 text-sm mt-1'>Sign in to access your practice dashboard.</p>
                </div>

                <div className='flex flex-col gap-5'>
                    <div>
                        <label className='text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block'>Email</label>
                        <div className='relative'>
                            <Mail className='absolute inset-y-0 left-4 my-auto h-5 w-5 text-gray-400' />
                            <input className='pl-11 pr-4 py-3 w-full border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800' type="email" onChange={(e) => setEmail(e.target.value)} value={email} required />
                        </div>
                    </div>
                    <div>
                        <label className='text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block'>Password</label>
                        <div className='relative'>
                            <Lock className='absolute inset-y-0 left-4 my-auto h-5 w-5 text-gray-400' />
                            <input className='pl-11 pr-4 py-3 w-full border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800' type="password" onChange={(e) => setPassword(e.target.value)} value={password} required />
                        </div>
                    </div>
                    <button type='submit' disabled={submitting} className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 mt-2'>
                        {submitting ? 'Signing in...' : 'Sign In'}
                    </button>
                </div>

                <p className='text-center text-sm text-gray-500 mt-6'>
                    Not registered yet?{' '}
                    <span onClick={() => router.push('/login')} className='text-blue-600 hover:text-blue-700 hover:underline cursor-pointer font-medium transition-colors'>
                        Create an account
                    </span>
                </p>
            </form>
        </div>
    )
}

export default DoctorLogin
