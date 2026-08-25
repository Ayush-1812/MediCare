'use client'

import React, { useState } from 'react'
import { loginAdmin } from '@/app/actions/adminActions'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import { Mail, Lock, ShieldCheck } from 'lucide-react'

const AdminLogin = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const router = useRouter()

    const onSubmitHandler = async (event: React.FormEvent) => {
        event.preventDefault()
        const formData = new FormData()
        formData.append('email', email)
        formData.append('password', password)

        const res = await loginAdmin(formData)
        if (res.success) {
            localStorage.setItem('adminToken', res.token)
            toast.success('Login Successful')
            router.push('/admin/dashboard')
        } else {
            toast.error(res.message)
        }
    }

    return (
        <div className='min-h-[85vh] flex items-center justify-center px-4'>
            <form onSubmit={onSubmitHandler} className='w-full max-w-md bg-white/90 backdrop-blur-xl border border-white rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)]'>
                <div className='flex flex-col items-center text-center mb-8'>
                    <div className='w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-sm mb-4'>
                        <ShieldCheck className='w-7 h-7 text-white' />
                    </div>
                    <h2 className='text-2xl font-bold text-gray-900'>Admin Login</h2>
                    <p className='text-gray-500 text-sm mt-1'>Sign in to manage the MediCare platform.</p>
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
                    <button type='submit' className='w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 mt-2'>
                        Sign In
                    </button>
                </div>
            </form>
        </div>
    )
}

export default AdminLogin
