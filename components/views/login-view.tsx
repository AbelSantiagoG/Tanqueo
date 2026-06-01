"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, Shield, Truck, User, ArrowLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
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
  const { loginWithCredentials } = useAuth()
  const [profiles, setProfiles] = useState<LoginProfile[]>([])
  const [role, setRole] = useState<UserRole | null>(null)
  const [selected, setSelected] = useState<LoginProfile | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    supabase.rpc("get_login_profiles").then(({ data, error }) => {
      if (error) {
        console.error(error)
        setErrorMsg("Aplica la migracion de Supabase para habilitar el acceso por perfiles.")
      } else {
        setProfiles((data || []) as LoginProfile[])
      }
    })
  }, [])

  const reset = () => {
    setRole(null)
    setSelected(null)
    setEmail("")
    setPassword("")
    setErrorMsg("")
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setErrorMsg("")
    if (!email || !password) return setErrorMsg("Ingresa correo y contrasena.")
    if (role !== "admin" && !selected) return setErrorMsg("Selecciona tu perfil.")

    setIsLoading(true)
    try {
      const profile = await loginWithCredentials(email, password, selected?.id)
      if (role && profile.role !== role) throw new Error("El perfil autenticado no tiene el rol seleccionado.")
      router.push(`/${profile.role}`)
    } catch (error: any) {
      setErrorMsg(error.message || "No fue posible iniciar sesion.")
    } finally {
      setIsLoading(false)
    }
  }

  const roleProfiles = profiles.filter((profile) => profile.role === role)

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-4">
      <Card className="w-full max-w-md bg-white text-slate-900 border-0 shadow-2xl">
        <CardHeader className="text-center">
          <CompanyLogo className="mx-auto h-24 w-full rounded-lg bg-white px-2" />
          <CardTitle className="text-xl font-black uppercase mt-3">Control de Tanqueo</CardTitle>
          <p className="text-xs text-slate-500">Selecciona tu perfil para ingresar</p>
        </CardHeader>
        <CardContent>
          {!role ? (
            <div className="space-y-3">
              <Button onClick={() => setRole("operario")} className="w-full justify-start py-6 bg-emerald-600 hover:bg-emerald-700">
                <User className="mr-3 w-5 h-5" /> Soy Operario
              </Button>
              <Button onClick={() => setRole("despachador")} className="w-full justify-start py-6 bg-amber-600 hover:bg-amber-700">
                <Truck className="mr-3 w-5 h-5" /> Soy Despachador
              </Button>
              <Button onClick={() => setRole("admin")} className="w-full justify-start py-6 bg-blue-800 hover:bg-blue-900">
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
                  <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-slate-100 p-2 border">
                    {roleProfiles.length ? roleProfiles.map((profile) => (
                      <button
                        type="button"
                        key={profile.id}
                        onClick={() => setSelected(profile)}
                        className={`w-full rounded-md p-2 text-left text-sm ${selected?.id === profile.id ? "bg-blue-700 text-white" : "hover:bg-white"}`}
                      >
                        <strong>{profile.full_name}</strong>
                        {profile.cargo && <span className="block text-xs opacity-75">{profile.cargo}</span>}
                      </button>
                    )) : <p className="p-2 text-center text-xs text-slate-500">No hay usuarios registrados para este perfil.</p>}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="email" className="text-slate-700">Correo</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9 bg-white" />
                </div>
              </div>
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
