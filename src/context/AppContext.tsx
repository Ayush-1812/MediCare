'use client'

import React, { createContext, useState, useEffect } from 'react'
import { doctorList } from '@/app/actions/doctorActions'

export const AppContext = createContext<any>(null)

const AppContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [token, setToken] = useState<string | boolean>(false)
    const [docToken, setDocToken] = useState<string | boolean>(false)
    const [userData, setUserData] = useState<any>(null)
    const [doctors, setDoctors] = useState<any[]>([])

    const getDoctorsData = async () => {
        const res = await doctorList()
        if (res.success) {
            setDoctors(res.doctors || [])
        }
    }

    useEffect(() => {
        getDoctorsData()
    }, [])

    // Persist token
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedToken = localStorage.getItem('token')
            const storedDocToken = localStorage.getItem('docToken')
            if (storedToken) {
                setToken(storedToken)
            }
            if (storedDocToken) {
                setDocToken(storedDocToken)
            }
        }
    }, [])

    const value = {
        token,
        setToken,
        docToken,
        setDocToken,
        userData,
        setUserData,
        doctors,
        getDoctorsData
    }

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    )
}

export default AppContextProvider
