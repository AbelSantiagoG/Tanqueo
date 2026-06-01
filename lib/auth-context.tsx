"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { Profile, UserRole } from "@/lib/types"

interface AuthContextType {
  user: Profile | null
  role: UserRole | null
  isAuthenticated: boolean
  isLoading: boolean
  loginWithCredentials: (email: string, password: string, expectedProfileId?: string) => Promise<Profile>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function loadProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()
  if (error || !data) throw new Error("Tu cuenta no tiene un perfil activo en el sistema.")
  if (data.activo === false) throw new Error("Tu perfil esta inactivo. Contacta al administrador.")
  return data as Profile
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      try {
        if (data.session?.user && mounted) setUser(await loadProfile(data.session.user.id))
      } catch (error) {
        console.error(error)
        await supabase.auth.signOut()
      } finally {
        if (mounted) setIsLoading(false)
      }
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setUser(null)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const loginWithCredentials = async (email: string, password: string, expectedProfileId?: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
    if (!data.user) throw new Error("Supabase no devolvio un usuario autenticado.")

    const profile = await loadProfile(data.user.id)
    if (expectedProfileId && expectedProfileId !== profile.id) {
      await supabase.auth.signOut()
      throw new Error("Las credenciales no corresponden al perfil seleccionado.")
    }
    setUser(profile)
    return profile
  }

  const logout = async () => {
    setUser(null)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: Boolean(user),
        isLoading,
        loginWithCredentials,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within an AuthProvider")
  return context
}
