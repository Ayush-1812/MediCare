'use client'

import React, { createContext, useState, useEffect, useCallback } from 'react'
import { doctorList } from '@/app/actions/doctorActions'
import { doctorProfile } from '@/app/actions/doctorActions'
import { getProfile } from '@/app/actions/userActions'

export const AppContext = createContext<any>(null)

const AppContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [token, setToken] = useState<string | boolean>(false)
    const [docToken, setDocToken] = useState<string | boolean>(false)
    const [userData, setUserData] = useState<any>(null)
    const [doctorData, setDoctorData] = useState<any>(null)
    const [doctors, setDoctors] = useState<any[]>([])
    const [authReady, setAuthReady] = useState(false)

    const getDoctorsData = async () => {
        const res = await doctorList()
        if (res.success) {
            setDoctors(res.doctors || [])
        }
    }

    const getUserProfileData = useCallback(async () => {
        const res = await getProfile()
        if (res.success) {
            setUserData(res.userData)
        }
    }, [])

    const getDoctorProfileData = useCallback(async () => {
        const res = await doctorProfile()
        if (res.success) {
            setDoctorData(res.profileData)
        }
    }, [])

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
        setAuthReady(true)
    }, [])

    // Keep the logged-in patient's profile (name, avatar) available app-wide
    useEffect(() => {
        if (token) {
            getUserProfileData()
        } else {
            setUserData(null)
        }
    }, [token, getUserProfileData])

    // Keep the logged-in doctor's profile (name, avatar) available app-wide
    useEffect(() => {
        if (docToken) {
            getDoctorProfileData()
        } else {
            setDoctorData(null)
        }
    }, [docToken, getDoctorProfileData])

    const logoutUser = () => {
        setToken(false)
        setUserData(null)
        if (typeof window !== 'undefined') localStorage.removeItem('token')
    }

    const logoutDoctor = () => {
        setDocToken(false)
        setDoctorData(null)
        if (typeof window !== 'undefined') localStorage.removeItem('docToken')
    }

    const value = {
        token,
        setToken,
        docToken,
        setDocToken,
        userData,
        setUserData,
        doctorData,
        setDoctorData,
        doctors,
        getDoctorsData,
        getUserProfileData,
        getDoctorProfileData,
        logoutUser,
        logoutDoctor,
        authReady
    }

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    )
}

export default AppContextProvider
