"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, Shield, Truck, User, ArrowLeft, Loader2, Search } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import type { Profile, UserRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CompanyLogo } from "@/components/layout/company-logo"

type LoginProfile = Pick<Profile, "id" | "full_name" | "role" | "cargo">

export function LoginView() {
  const router = useRouter()
  const { loginWithCredentials, loginWithSelectedProfile } = useAuth()
  const [profiles, setProfiles] = useState<LoginProfile[]>([])
  const [role, setRole] = useState<UserRole | null>(null)
  const [selected, setSelected] = useState<LoginProfile | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [profilesLoading, setProfilesLoading] = useState(false)
  const [profilesError, setProfilesError] = useState("")
  const [profileSearch, setProfileSearch] = useState("")
  const [profilesRetry, setProfilesRetry] = useState(0)
  const [hasMoreProfiles, setHasMoreProfiles] = useState(false)

  useEffect(() => {
    if (!role || role === "admin") return
    let cancelled = false
    const controller = new AbortController()
    setProfilesLoading(true)
    setProfilesError("")
    void (async () => {
      await new Promise((resolve) => window.setTimeout(resolve, profileSearch ? 250 : 0))
      if (cancelled) return
      const timeout = window.setTimeout(() => controller.abort(), 12000)
      try {
        const params = new URLSearchParams({ role, limit: "50" })
        if (profileSearch.trim()) params.set("search", profileSearch.trim())
        const response = await fetch(`/api/auth/login-profiles?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const body = await response.json()
        if (cancelled) return
        if (!response.ok) throw new Error(body.error || "No fue posible cargar usuarios.")
        setProfiles((body.profiles || []) as LoginProfile[])
        setHasMoreProfiles(Boolean(body.hasMore))
      } catch (error: any) {
        if (cancelled) return
        console.error(error)
        setProfiles([])
        setHasMoreProfiles(false)
        setProfilesError(error.name === "AbortError" ? "La carga de usuarios tardo demasiado. Intenta buscar por nombre o reintenta." : error.message || "No fue posible cargar usuarios.")
      } finally {
        window.clearTimeout(timeout)
        if (!cancelled) setProfilesLoading(false)
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [profileSearch, profilesRetry, role])

  const reset = () => {
    setRole(null)
    setSelected(null)
    setEmail("")
    setPassword("")
    setErrorMsg("")
    setProfiles([])
    setProfilesError("")
    setProfileSearch("")
    setHasMoreProfiles(false)
  }

  const selectRole = (selectedRole: UserRole) => {
    router.prefetch(`/${selectedRole}`)
    setRole(selectedRole)
    setSelected(null)
    setProfiles([])
    setProfilesError("")
    setProfileSearch("")
    setHasMoreProfiles(false)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMsg("")
    if (role !== "admin" && !selected) return setErrorMsg("Selecciona tu perfil.")
    if (role === "admin" && !email) return setErrorMsg("Ingresa correo y contrasena.")
    if (!password) return setErrorMsg("Ingresa la contrasena.")

    setIsLoading(true)
    try {
      const profile = role === "admin"
        ? await loginWithCredentials(email, password)
        : await loginWithSelectedProfile(selected!.id, password)
      if (role && profile.role !== role) throw new Error("El perfil autenticado no tiene el rol seleccionado.")
      router.replace(`/${profile.role}`)
    } catch (error: any) {
      setErrorMsg(error.message || "No fue posible iniciar sesion.")
    } finally {
      setIsLoading(false)
    }
  }

  const roleProfiles = useMemo(() => profiles.filter((profile) => profile.role === role), [profiles, role])

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-4">
      <Card className="min-w-0 w-full max-w-md overflow-hidden bg-white text-slate-900 border-0 shadow-2xl">
        <CardHeader className="min-w-0 text-center">
          <CompanyLogo className="mx-auto h-24 w-full" />
          <CardTitle className="mt-3 text-lg font-black uppercase sm:text-xl">Control de Tanqueo</CardTitle>
          <p className="text-xs text-slate-500">Selecciona tu perfil para ingresar</p>
        </CardHeader>
        <CardContent>
          {!role ? (
            <div className="space-y-3">
              <Button onClick={() => selectRole("operario")} className="w-full justify-start py-6 bg-emerald-600 hover:bg-emerald-700">
                <User className="mr-3 w-5 h-5" /> Soy Operario
              </Button>
              <Button onClick={() => selectRole("despachador")} className="w-full justify-start py-6 bg-amber-600 hover:bg-amber-700">
                <Truck className="mr-3 w-5 h-5" /> Soy Despachador
              </Button>
              <Button onClick={() => selectRole("admin")} className="w-full justify-start py-6 bg-blue-800 hover:bg-blue-900">
                <Shield className="mr-3 w-5 h-5" /> Administrador
              </Button>
              {errorMsg && <p className="text-xs text-red-600 text-center">{errorMsg}</p>}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Button type="button" variant="ghost" onClick={reset} className="px-0 text-slate-600">
                <ArrowLeft className="mr-1 w-4 h-4" /> Cambiar perfil
              </Button>

              {role !== "admin" && (
                <div className="space-y-2">
                  <Label className="text-slate-700">Selecciona tu usuario</Label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 shadow-inner">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        value={profileSearch}
                        onChange={(event) => {
                          setSelected(null)
                          setProfileSearch(event.target.value)
                        }}
                        placeholder="Buscar por nombre"
                        className="bg-white pl-9"
                      />
                    </div>
                    <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                      {profilesLoading ? (
                        <div className="flex items-center justify-center gap-2 rounded-lg bg-white p-4 text-xs text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" /> Cargando usuarios...
                        </div>
                      ) : profilesError ? (
                        <div className="space-y-2 rounded-lg bg-red-50 p-3 text-center text-xs text-red-700">
                          <p>{profilesError}</p>
                          <Button type="button" size="sm" variant="outline" className="h-8 bg-white text-slate-700" onClick={() => setProfilesRetry((value) => value + 1)}>Reintentar</Button>
                        </div>
                      ) : roleProfiles.length ? roleProfiles.map((profile) => (
                        <button
                          type="button"
                          key={profile.id}
                          onClick={() => setSelected(profile)}
                          className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${selected?.id === profile.id ? "border-blue-700 bg-blue-700 text-white shadow-sm" : "border-transparent bg-white hover:border-blue-200 hover:bg-blue-50"}`}
                        >
                          <strong>{profile.full_name}</strong>
                          {profile.cargo && <span className="block text-xs opacity-75">{profile.cargo}</span>}
                        </button>
                      )) : (
                        <p className="rounded-lg bg-white p-4 text-center text-xs text-slate-500">{profileSearch ? "No se encontraron usuarios con esa busqueda." : "No hay usuarios registrados para este perfil."}</p>
                      )}
                    </div>
                    {hasMoreProfiles && !profilesLoading && !profilesError && (
                      <p className="px-1 pt-2 text-[11px] text-slate-500">Mostrando los primeros 50 usuarios. Usa la busqueda para encontrar otro perfil.</p>
                    )}
                  </div>
                </div>
              )}

              {role === "admin" && (
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-slate-700">Correo</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9 bg-white" />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="password" className="text-slate-700">Contrasena</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="pl-9 bg-white" />
                </div>
              </div>
              {errorMsg && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{errorMsg}</p>}
              <Button disabled={isLoading} className="w-full bg-blue-700 hover:bg-blue-800">
                {isLoading ? "Ingresando..." : "Ingresar"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
