'use client'

import React, { useContext, useState } from 'react'
import { AppContext } from '@/context/AppContext'
import { loginUser, registerUser } from '@/app/actions/userActions'
import { registerDoctor, loginDoctor } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'

type AuthResponse = {
    success: boolean
    token?: string
    message?: string
}

const Login = () => {
    const [state, setState] = useState<'Sign Up' | 'Login'>('Sign Up')
    const [role, setRole] = useState<'User' | 'Doctor'>('User')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')

    const { setToken, setDocToken } = useContext(AppContext)
    const router = useRouter()

    const onSubmitHandler = async (event: React.FormEvent) => {
        event.preventDefault()

        const formData = new FormData()
        formData.append('email', email)
        formData.append('password', password)
        if (state === 'Sign Up') {
            formData.append('name', name)
        }

        let res: AuthResponse

        if (role === 'User') {
            res = state === 'Sign Up'
                ? await registerUser(formData)
                : await loginUser(formData)
        } else {
            res = state === 'Sign Up'
                ? await registerDoctor(formData)
                : await loginDoctor(formData)
        }

        if (res.success && res.token) {
            const tokenKey = role === 'User' ? 'token' : 'docToken'
            localStorage.setItem(tokenKey, res.token)

            if (role === 'User') {
                setToken(res.token)
                router.push('/')
            } else {
                setDocToken(res.token)
                router.push('/doctor-dashboard/dashboard')
            }

            toast.success(`${state} Successful`)
        } else {
            toast.error(res.message || 'Authentication failed')
        }
    }

    return (
        <form onSubmit={onSubmitHandler} className="min-h-[80vh] flex items-center">
            <div className="flex flex-col gap-3 m-auto items-start p-8 min-w-[340px] sm:min-w-96 border rounded-xl text-zinc-600 text-sm shadow-lg bg-white">
                <p className="text-2xl font-semibold">
                    {state === 'Sign Up' ? 'Create Account' : 'Login'}
                </p>

                <div className="flex gap-4 mb-2">
                    <p
                        onClick={() => setRole('User')}
                        className={`cursor-pointer ${role === 'User'
                            ? 'text-primary font-bold border-b-2 border-primary'
                            : ''
                            }`}
                    >
                        User
                    </p>
                    <p
                        onClick={() => setRole('Doctor')}
                        className={`cursor-pointer ${role === 'Doctor'
                            ? 'text-primary font-bold border-b-2 border-primary'
                            : ''
                            }`}
                    >
                        Doctor
                    </p>
                </div>

                <p>
                    Please {state === 'Sign Up' ? 'sign up' : 'log in'} to{' '}
                    {role === 'User' ? 'book appointment' : 'manage appointments'}
                </p>

                {state === 'Sign Up' && (
                    <div className="w-full">
                        <p>Full Name</p>
                        <input
                            className="border border-zinc-300 rounded w-full p-2 mt-1"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                )}

                <div className="w-full">
                    <p>Email</p>
                    <input
                        className="border border-zinc-300 rounded w-full p-2 mt-1"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className="w-full">
                    <p>Password</p>
                    <input
                        className="border border-zinc-300 rounded w-full p-2 mt-1"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                <button
                    type="submit"
                    className="bg-primary text-white w-full py-2 rounded-md text-base"
                >
                    {state === 'Sign Up' ? 'Create Account' : 'Login'}
                </button>

                {state === 'Sign Up' ? (
                    <p>
                        Already have an account?{' '}
                        <span
                            onClick={() => setState('Login')}
                            className="text-primary underline cursor-pointer"
                        >
                            Login here
                        </span>
                    </p>
                ) : (
                    <p>
                        Create a {role === 'Doctor' ? 'Doctor' : ''} account?{' '}
                        <span
                            onClick={() => setState('Sign Up')}
                            className="text-primary underline cursor-pointer"
                        >
                            Click here
                        </span>
                    </p>
                )}
            </div>
        </form>
    )
}

export default Login
