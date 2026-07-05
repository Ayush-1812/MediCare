'use client'

import React, { useContext, useState } from 'react'
import { AppContext } from '@/context/AppContext'
import { loginUser, registerUser } from '@/app/actions/userActions'
import { registerDoctor, loginDoctor } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, User as UserIcon, Calendar, Droplet, Users, ShieldCheck } from 'lucide-react'

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
    
    // New UI fields (for visual and local validation only, not sent to backend)
    const [confirmPassword, setConfirmPassword] = useState('')
    const [gender, setGender] = useState('Not Specified')
    const [age, setAge] = useState('')
    const [bloodGroup, setBloodGroup] = useState('Unknown')
    const [showPassword, setShowPassword] = useState(false)

    const { setToken, setDocToken } = useContext(AppContext)
    const router = useRouter()

    const onSubmitHandler = async (event: React.FormEvent) => {
        event.preventDefault()

        if (state === 'Sign Up' && password !== confirmPassword) {
            toast.error("Passwords do not match")
            return
        }

        const formData = new FormData()
        formData.append('email', email)
        formData.append('password', password)
        if (state === 'Sign Up') {
            formData.append('name', name)
            // Note: Gender, Age, and Blood Group are currently UI only and not sent to the existing backend API.
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

    // Simple password strength calculator
    const getPasswordStrength = () => {
        if (password.length === 0) return 0;
        let score = 0;
        if (password.length >= 8) score += 25;
        if (password.match(/[A-Z]/)) score += 25;
        if (password.match(/[0-9]/)) score += 25;
        if (password.match(/[^A-Za-z0-9]/)) score += 25;
        return score;
    }
    const strength = getPasswordStrength();

    return (
        <div className="min-h-screen flex bg-blue-50">
            {/* Left Side: Illustration / Hero Area */}
            <div className="hidden lg:flex w-1/2 relative bg-blue-600 flex-col justify-between overflow-hidden">
                <div 
                    className='absolute inset-0 z-0 opacity-20 bg-cover bg-center mix-blend-overlay'
                    style={{ backgroundImage: "url('/assets/header_img.png')" }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-b from-blue-600/80 to-blue-900/90 z-10"></div>
                
                <div className="relative z-20 p-12">
                    <img src="/assets/logo.svg" alt="MediCare" className="w-40 brightness-0 invert mb-12" />
                    <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
                        Join the future of <br/> healthcare today.
                    </h1>
                    <p className="text-blue-100 text-lg max-w-md leading-relaxed">
                        Create your account to unlock personalized AI health insights, seamless doctor consultations, and intelligent medical record management.
                    </p>
                </div>

                <div className="relative z-20 p-12 pb-20">
                    <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="text-blue-600 w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg mb-1">Bank-level Security</h3>
                            <p className="text-blue-200 text-sm">Your health data is encrypted and strictly confidential.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Form Area */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
                
                {/* Mobile Logo */}
                <div className="absolute top-6 left-6 lg:hidden">
                    <img src="/assets/logo.svg" alt="MediCare" className="w-32" />
                </div>

                <div className="w-full max-w-lg bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-8 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mt-12 lg:mt-0">
                    
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-2">
                            {state === 'Sign Up' ? 'Create an Account' : 'Welcome Back'}
                        </h2>
                        <p className="text-gray-500 text-sm">
                            {state === 'Sign Up' 
                                ? 'Join MediCare+ to manage your health smarter.' 
                                : 'Please enter your details to sign in.'}
                        </p>
                    </div>

                    {/* Role Toggle */}
                    <div className="flex p-1 bg-gray-100 rounded-xl mb-8 relative">
                        <div 
                            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-in-out ${role === 'Doctor' ? 'left-[calc(50%+2px)]' : 'left-1'}`}
                        ></div>
                        <button
                            type="button"
                            onClick={() => setRole('User')}
                            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg relative z-10 transition-colors ${role === 'User' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Patient
                        </button>
                        <button
                            type="button"
                            onClick={() => setRole('Doctor')}
                            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg relative z-10 transition-colors ${role === 'Doctor' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Doctor
                        </button>
                    </div>

                    <form onSubmit={onSubmitHandler} className="flex flex-col gap-5">
                        
                        {state === 'Sign Up' && (
                            <div className="relative">
                                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Full Name</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <UserIcon className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="John Doe"
                                        className="pl-11 pr-4 py-3 w-full border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div className="relative">
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type="email"
                                    placeholder="john@example.com"
                                    className="pl-11 pr-4 py-3 w-full border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    className="pl-11 pr-12 py-3 w-full border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                            {state === 'Sign Up' && password.length > 0 && (
                                <div className="mt-2 flex gap-1 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-500 ${strength >= 25 ? 'bg-red-400 w-1/4' : 'w-0'}`}></div>
                                    <div className={`h-full transition-all duration-500 ${strength >= 50 ? 'bg-yellow-400 w-1/4' : 'w-0'}`}></div>
                                    <div className={`h-full transition-all duration-500 ${strength >= 75 ? 'bg-blue-400 w-1/4' : 'w-0'}`}></div>
                                    <div className={`h-full transition-all duration-500 ${strength === 100 ? 'bg-green-500 w-1/4' : 'w-0'}`}></div>
                                </div>
                            )}
                        </div>

                        {state === 'Sign Up' && (
                            <>
                                <div className="relative">
                                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Confirm Password</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••"
                                            className="pl-11 pr-4 py-3 w-full border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="relative col-span-1">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Age</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Calendar className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input
                                                type="number"
                                                placeholder="25"
                                                className="pl-9 pr-3 py-3 w-full border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 text-sm"
                                                value={age}
                                                onChange={(e) => setAge(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="relative col-span-1">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Gender</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Users className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <select
                                                className="pl-9 pr-3 py-3 w-full border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 text-sm appearance-none"
                                                value={gender}
                                                onChange={(e) => setGender(e.target.value)}
                                            >
                                                <option value="Not Specified">Select</option>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="relative col-span-1">
                                        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 block">Blood</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Droplet className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <select
                                                className="pl-9 pr-3 py-3 w-full border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-gray-800 text-sm appearance-none"
                                                value={bloodGroup}
                                                onChange={(e) => setBloodGroup(e.target.value)}
                                            >
                                                <option value="Unknown">Select</option>
                                                <option value="A+">A+</option>
                                                <option value="A-">A-</option>
                                                <option value="B+">B+</option>
                                                <option value="B-">B-</option>
                                                <option value="O+">O+</option>
                                                <option value="O-">O-</option>
                                                <option value="AB+">AB+</option>
                                                <option value="AB-">AB-</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 mt-2"
                        >
                            {state === 'Sign Up' ? 'Create Account' : 'Sign In'}
                        </button>

                        {state === 'Sign Up' && (
                            <button
                                type="button"
                                className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3.5 rounded-xl shadow-sm transition-all duration-300 flex items-center justify-center gap-3"
                                onClick={() => toast.info("Google Sign Up is simulated for this UI design.")}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                Sign up with Google
                            </button>
                        )}

                        {state === 'Sign Up' && (
                            <p className="text-center text-xs text-gray-500 mt-2 px-4">
                                By creating an account, you agree to our <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>.
                            </p>
                        )}
                        
                    </form>
                    
                    <div className="mt-8 text-center text-sm font-medium text-gray-600">
                        {state === 'Sign Up' ? (
                            <p>
                                Already have an account?{' '}
                                <span
                                    onClick={() => setState('Login')}
                                    className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
                                >
                                    Log in here
                                </span>
                            </p>
                        ) : (
                            <p>
                                Don't have an account?{' '}
                                <span
                                    onClick={() => setState('Sign Up')}
                                    className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors"
                                >
                                    Create one here
                                </span>
                            </p>
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}

export default Login
