'use client'

import React, { Suspense, useContext, useEffect, useState } from 'react'
import { AppContext } from '@/context/AppContext'
import { loginUser, registerUser } from '@/app/actions/userActions'
import { registerDoctor, loginDoctor } from '@/app/actions/doctorActions'
import { toast } from 'react-toastify'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Mail, Lock, User as UserIcon, Calendar, Droplet, Users, Video, Bot, FileText } from 'lucide-react'
import { GENDER_CHOICES, GENDER_UNSET } from '@/lib/profile'

type AuthResponse = {
    success: boolean
    token?: string
    message?: string
    profileCompleted?: boolean
}

const LoginForm = () => {
    // The navbar links here as ?mode=login / ?mode=signup. Without this the page always
    // opened on Sign Up, so pressing "Login" landed people on a registration form.
    const searchParams = useSearchParams()
    const mode = searchParams.get('mode')
    const [state, setState] = useState<'Sign Up' | 'Login'>(
        mode === 'login' ? 'Login' : 'Sign Up',
    )

    // `useState`'s initial value is only read on the first mount. Navigating from
    // /login?mode=signup to /login?mode=login is the *same* route, so React reuses this
    // component and the initializer never runs again — which is why the navbar's "Login"
    // link changed the URL but left the form sitting on "Create an Account". Syncing on
    // the param makes the link work from anywhere, including when already on this page.
    useEffect(() => {
        setState(mode === 'login' ? 'Login' : 'Sign Up')
    }, [mode])
    const [role, setRole] = useState<'User' | 'Doctor'>('User')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    
    // New UI fields (for visual and local validation only, not sent to backend)
    const [confirmPassword, setConfirmPassword] = useState('')
    const [gender, setGender] = useState<string>(GENDER_UNSET)
    const [age, setAge] = useState('')
    const [bloodGroup, setBloodGroup] = useState('Unknown')
    const [showPassword, setShowPassword] = useState(false)

    const { setToken, setDocToken } = useContext(AppContext)
    const router = useRouter()

    const [submitting, setSubmitting] = useState(false)

    /**
     * Switches between the Sign Up and Login forms by changing the URL, so the `?mode=`
     * param stays the single source of truth. Setting local state alone would leave the
     * URL stale, and the navbar's "Login" link would then appear dead whenever the URL
     * already said `?mode=login`.
     */
    const switchMode = (next: 'Sign Up' | 'Login') => {
        router.replace(next === 'Login' ? '/login?mode=login' : '/login?mode=signup')
    }

    const onSubmitHandler = async (event: React.FormEvent) => {
        event.preventDefault()
        if (submitting) return

        if (state === 'Sign Up' && password !== confirmPassword) {
            toast.error("Passwords do not match")
            return
        }
        if (state === 'Sign Up' && password.length < 8) {
            toast.error("Password must be at least 8 characters")
            return
        }

        const formData = new FormData()
        formData.append('email', email)
        formData.append('password', password)
        if (state === 'Sign Up') {
            formData.append('name', name)
            // Gender is stored so we can show the right default avatar before a photo is
            // uploaded. Age and blood group remain UI-only for now.
            formData.append('gender', gender)
        }

        setSubmitting(true)
        let res: AuthResponse
        try {
            if (role === 'User') {
                res = state === 'Sign Up'
                    ? await registerUser(formData)
                    : await loginUser(formData)
            } else {
                res = state === 'Sign Up'
                    ? await registerDoctor(formData)
                    : await loginDoctor(formData)
            }
        } finally {
            setSubmitting(false)
        }

        if (!res.success || !res.token) {
            toast.error(res.message || 'Authentication failed')
            return
        }

        const tokenKey = role === 'User' ? 'token' : 'docToken'
        localStorage.setItem(tokenKey, res.token)
        toast.success(`${state} Successful`)

        if (role === 'User') {
            setToken(res.token)
            // Patients land on their appointments, which is what they came to manage —
            // the marketing home page is the pre-login view and tells them nothing new.
            router.push('/my-appointments')
            return
        }

        setDocToken(res.token)
        // A doctor who has not filled in their practice details yet cannot be found or
        // booked, so send them straight to the onboarding form. Otherwise their own
        // dashboard — signing in as a doctor and landing on the patient-facing home page
        // left them with no sign they were logged in as a doctor at all.
        router.push(
            res.profileCompleted === false
                ? '/doctor-dashboard/onboarding'
                : '/doctor-dashboard/dashboard',
        )
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
            <div className="hidden lg:flex w-1/2 relative bg-blue-600 flex-col overflow-hidden">
                <div 
                    className='absolute inset-0 z-0 opacity-20 bg-cover bg-center mix-blend-overlay'
                    style={{ backgroundImage: "url('/assets/header_img.png')" }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-b from-blue-600/80 to-blue-900/90 z-10"></div>
                
                {/* One centred column instead of `justify-between`: with the panel pinned
                    to the viewport height, pushing the two blocks apart overflowed on
                    shorter screens and silently clipped the feature list. */}
                <div className="relative z-20 flex flex-col justify-center h-full p-10 xl:p-14">
                    <Link href="/" className="inline-block mb-10 w-fit">
                        <img src="/assets/logo.svg" alt="MediCare" className="w-36 brightness-0 invert" />
                    </Link>

                    <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-5">
                        Join the future of <br /> healthcare today.
                    </h1>
                    <p className="text-blue-100 text-base xl:text-lg max-w-md leading-relaxed mb-10">
                        Book consultations, talk to your doctor over video, and keep every
                        prescription in one place.
                    </p>

                    {/* Concrete capabilities rather than a security claim — the previous
                        "Bank-level Security" badge asserted something the app cannot
                        substantiate, which is not a promise a health product should make
                        lightly. */}
                    <div className="space-y-5">
                        {[
                            { icon: Video, title: 'Video consultations', copy: 'Talk to your doctor face to face, from anywhere.' },
                            { icon: Bot, title: 'AI health assistant', copy: 'Answers grounded in your own records.' },
                            { icon: FileText, title: 'Digital prescriptions', copy: 'Saved, searchable and downloadable.' },
                        ].map((item) => (
                            <div key={item.title} className="flex items-center gap-4">
                                <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center shrink-0 border border-white/20">
                                    <item.icon className="text-white w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-white font-semibold leading-snug">{item.title}</h3>
                                    <p className="text-blue-200 text-sm leading-snug">{item.copy}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Side: Form Area */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
                
                {/* Mobile logo — also the way back to the site, since this page renders
                    without the navbar. */}
                <Link href="/" className="absolute top-6 left-6 lg:hidden">
                    <img src="/assets/logo.svg" alt="MediCare" className="w-32" />
                </Link>

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
                                                <option value={GENDER_UNSET}>Select</option>
                                                {GENDER_CHOICES.map((choice) => (
                                                    <option key={choice} value={choice}>{choice}</option>
                                                ))}
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
                            disabled={submitting}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 mt-2"
                        >
                            {submitting
                                ? 'Please wait...'
                                : state === 'Sign Up' ? 'Create Account' : 'Sign In'}
                        </button>

                        {/* "Sign up with Google" lived here. It was a placeholder that only
                            raised a toast saying it was simulated — a prominent button that
                            did nothing. Removed until OAuth is actually wired up. */}

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
                                <button
                                    type="button"
                                    onClick={() => switchMode('Login')}
                                    className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors font-medium"
                                >
                                    Log in here
                                </button>
                            </p>
                        ) : (
                            <p>
                                Don&apos;t have an account?{' '}
                                <button
                                    type="button"
                                    onClick={() => switchMode('Sign Up')}
                                    className="text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors font-medium"
                                >
                                    Create one here
                                </button>
                            </p>
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}

// `useSearchParams` opts a page into client-side rendering; the Suspense boundary keeps
// the rest of the route statically prerenderable.
const Login = () => (
    <Suspense fallback={<div className='min-h-screen bg-blue-50' />}>
        <LoginForm />
    </Suspense>
)

export default Login
