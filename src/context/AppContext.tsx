'use client'

import React, { createContext, useState, useEffect, useCallback } from 'react'
import { doctorList, doctorProfile, logoutDoctor as logoutDoctorAction } from '@/app/actions/doctorActions'
import { getProfile, logoutUser as logoutUserAction } from '@/app/actions/userActions'

export const AppContext = createContext<any>(null)

const AppContextProvider = ({ children }: { children: React.ReactNode }) => {
    const [token, setToken] = useState<string | boolean>(false)
    const [docToken, setDocToken] = useState<string | boolean>(false)
    const [userData, setUserData] = useState<any>(null)
    const [doctorData, setDoctorData] = useState<any>(null)
    const [doctors, setDoctors] = useState<any[]>([])
    const [authReady, setAuthReady] = useState(false)

    const getDoctorsData = useCallback(async () => {
        const res = await doctorList()
        if (res.success) {
            setDoctors(res.doctors)
        }
    }, [])

    // Both profile fetches double as session checks. If the server says the session is
    // gone, the local token is dropped as well — otherwise the navbar keeps rendering the
    // signed-in avatar menu off a dead localStorage token and never offers Login, leaving
    // no way back into the app.
    const getUserProfileData = useCallback(async () => {
        const res = await getProfile()
        if (res.success) {
            setUserData(res.userData)
            return true
        }
        localStorage.removeItem('token')
        setToken(false)
        setUserData(null)
        return false
    }, [])

    const getDoctorProfileData = useCallback(async () => {
        const res = await doctorProfile()
        if (res.success) {
            setDoctorData(res.profileData)
            return true
        }
        localStorage.removeItem('docToken')
        setDocToken(false)
        setDoctorData(null)
        return false
    }, [])

    useEffect(() => {
        getDoctorsData()
    }, [getDoctorsData])

    // Restore whichever sessions this browser has. The tokens here are only a hint for
    // the UI — the httpOnly cookie set at login is what actually authenticates every
    // server action, and the effects below confirm it is still valid.
    useEffect(() => {
        const storedToken = localStorage.getItem('token')
        const storedDocToken = localStorage.getItem('docToken')
        if (storedToken) setToken(storedToken)
        if (storedDocToken) setDocToken(storedDocToken)
        setAuthReady(true)
    }, [])

    useEffect(() => {
        if (token) {
            getUserProfileData()
        } else {
            setUserData(null)
        }
    }, [token, getUserProfileData])

    useEffect(() => {
        if (docToken) {
            getDoctorProfileData()
        } else {
            setDoctorData(null)
        }
    }, [docToken, getDoctorProfileData])

    // Both logouts must clear the httpOnly cookie too. Dropping only the localStorage
    // copy left the server-side session alive, so "log out" logged nobody out.
    const logoutUser = useCallback(async () => {
        await logoutUserAction()
        localStorage.removeItem('token')
        setToken(false)
        setUserData(null)
    }, [])

    const logoutDoctor = useCallback(async () => {
        await logoutDoctorAction()
        localStorage.removeItem('docToken')
        setDocToken(false)
        setDoctorData(null)
    }, [])

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
        authReady,
    }

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    )
}

export default AppContextProvider
