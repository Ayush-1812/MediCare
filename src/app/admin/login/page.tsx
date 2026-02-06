'use client'

import React, { useState } from 'react'
import { loginAdmin } from '@/app/actions/adminActions'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

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
        if (res.success && res.token) {
            localStorage.setItem('adminToken', res.token)
            toast.success('Login Successful')
            router.push('/admin/dashboard')
        } else {
            toast.error(res.message)
        }
    }

    return (
        <form onSubmit={onSubmitHandler} className='min-h-[80vh] flex items-center'>
            <div className='flex flex-col gap-3 m-auto items-start p-8 min-w-[340px] sm:min-w-96 border rounded-xl text-zinc-600 text-sm shadow-lg'>
                <p className='text-2xl font-semibold m-auto text-primary'>Admin Login</p>
                <div className='w-full'>
                    <p>Email</p>
                    <input className='border border-zinc-300 rounded w-full p-2 mt-1' type="email" onChange={(e) => setEmail(e.target.value)} value={email} required />
                </div>
                <div className='w-full'>
                    <p>Password</p>
                    <input className='border border-zinc-300 rounded w-full p-2 mt-1' type="password" onChange={(e) => setPassword(e.target.value)} value={password} required />
                </div>
                <button type='submit' className='bg-primary text-white w-full py-2 rounded-md text-base mt-1'>Login</button>
            </div>
        </form>
    )
}

export default AdminLogin
