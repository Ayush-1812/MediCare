'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Menu, X, LucideIcon } from 'lucide-react'

export interface DashboardNavItem {
    href: string
    label: string
    icon: LucideIcon
}

interface DashboardShellProps {
    brandLabel: string
    navItems: DashboardNavItem[]
    onLogout: () => void
    avatarUrl?: string
    displayName?: string
    subLabel?: string
    children: React.ReactNode
}

const DashboardShell = ({ brandLabel, navItems, onLogout, avatarUrl, displayName, subLabel, children }: DashboardShellProps) => {
    const pathname = usePathname()
    const [mobileOpen, setMobileOpen] = useState(false)

    const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
        <ul className='flex flex-col gap-1 px-3'>
            {navItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                    <Link key={item.href} href={item.href} onClick={onNavigate}>
                        <li className={`flex items-center gap-3 py-3 px-4 rounded-xl cursor-pointer font-medium transition-all duration-200 ${isActive
                                ? 'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(95,111,255,0.15)]'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`}>
                            <Icon className='w-[18px] h-[18px] shrink-0' />
                            <span className='hidden md:block text-sm'>{item.label}</span>
                        </li>
                    </Link>
                )
            })}
        </ul>
    )

    return (
        <div className='flex items-start bg-[#F8F9FD] min-h-screen'>
            {/* Desktop Sidebar */}
            <div className='hidden sm:flex flex-col min-h-screen bg-white border-r border-gray-100 sticky top-0'>
                <div className='px-4 md:px-6 py-6 border-b border-gray-100 flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center text-white font-bold shrink-0 shadow-sm'>
                        {brandLabel.charAt(0)}
                    </div>
                    <div className='hidden md:block min-w-0'>
                        <p className='text-sm font-bold text-gray-900 truncate'>{brandLabel}</p>
                        <p className='text-xs text-gray-400'>Portal</p>
                    </div>
                </div>

                {avatarUrl !== undefined && (
                    <div className='px-4 md:px-6 py-5 border-b border-gray-100 flex items-center gap-3'>
                        <img src={avatarUrl || '/assets/profile_pic.png'} alt='' className='w-10 h-10 rounded-full object-cover bg-blue-50 ring-2 ring-blue-50 shrink-0' />
                        <div className='hidden md:block min-w-0'>
                            <p className='text-sm font-semibold text-gray-800 truncate'>{displayName || 'Loading...'}</p>
                            <p className='text-xs text-gray-400 truncate'>{subLabel}</p>
                        </div>
                    </div>
                )}

                <nav className='mt-4 flex-1'>
                    <NavList />
                </nav>

                <div className='p-3 md:p-4'>
                    <button
                        onClick={onLogout}
                        className='w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-semibold py-2.5 rounded-xl hover:bg-red-100 transition-colors text-sm'
                    >
                        <LogOut className='w-4 h-4' />
                        <span className='hidden md:inline'>Logout</span>
                    </button>
                </div>
            </div>

            {/* Mobile Top Bar */}
            <div className='sm:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-4 py-3 flex items-center justify-between'>
                <div className='flex items-center gap-2.5'>
                    <div className='w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-teal-400 flex items-center justify-center text-white font-bold text-sm'>
                        {brandLabel.charAt(0)}
                    </div>
                    <p className='text-sm font-bold text-gray-900'>{brandLabel}</p>
                </div>
                <button onClick={() => setMobileOpen(true)} className='p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors' aria-label='Open menu'>
                    <Menu className='w-5 h-5' />
                </button>
            </div>

            {/* Mobile Drawer */}
            {mobileOpen && (
                <div className='fixed inset-0 bg-black/30 backdrop-blur-sm z-50 sm:hidden animate-fade-in' onClick={() => setMobileOpen(false)} />
            )}
            <div className={`fixed sm:hidden top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-2xl transition-transform duration-300 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className='flex items-center justify-between px-5 py-5 border-b border-gray-100'>
                    <p className='font-bold text-gray-900'>{brandLabel}</p>
                    <button onClick={() => setMobileOpen(false)} className='p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors'>
                        <X className='w-5 h-5' />
                    </button>
                </div>
                {avatarUrl !== undefined && (
                    <div className='flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-blue-50/50'>
                        <img src={avatarUrl || '/assets/profile_pic.png'} alt='' className='w-11 h-11 rounded-full object-cover bg-blue-100' />
                        <div className='min-w-0'>
                            <p className='font-semibold text-gray-900 truncate'>{displayName || 'Loading...'}</p>
                            <p className='text-xs text-gray-500 truncate'>{subLabel}</p>
                        </div>
                    </div>
                )}
                <nav className='mt-3'>
                    <NavList onNavigate={() => setMobileOpen(false)} />
                </nav>
                <div className='absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100'>
                    <button
                        onClick={onLogout}
                        className='w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-semibold py-3 rounded-xl hover:bg-red-100 transition-colors'
                    >
                        <LogOut className='w-4 h-4' /> Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className='flex-1 min-w-0 p-4 pt-20 sm:pt-6 sm:p-7 lg:p-10'>
                {children}
            </div>
        </div>
    )
}

export default DashboardShell
