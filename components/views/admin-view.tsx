"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { AlertTriangle, BarChart3, Building2, Car, ClipboardList, DollarSign, Edit, Fuel, Plus, Trash2 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { toast } from "sonner"
import { loadFuelRecords } from "@/lib/fuel-service"
import { BRAND_YIELDS, VEHICLE_BRANDS, formatCurrency } from "@/lib/fuel-utils"
import { hasStationSchema } from "@/lib/schema-capabilities"
import { supabase } from "@/lib/supabase"
import type { CompanySettings, FuelOrder, FuelRecord, Profile, ServiceStation, UserRole, Vehicle } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { SchemaUpdateAlert } from "@/components/ui/schema-update-alert"

const CHART_COLORS = ["#1a56db", "#0ea768", "#d97706", "#7c3aed", "#e53e3e", "#06b6d4"]
const DespachadorView = dynamic(() => import("@/components/views/despachador-view").then((module) => module.DespachadorView), { loading: () => <p className="p-4 text-sm text-muted-foreground">Cargando ordenes...</p> })
const RecordsView = dynamic(() => import("@/components/views/records-view").then((module) => module.RecordsView), { loading: () => <p className="p-4 text-sm text-muted-foreground">Cargando registros...</p> })

const EMPTY_SETTINGS: CompanySettings = {
  id: "", emp_nombre: "", emp_nit: "", emp_dir: "", emp_tel: "", emp_email: "", emp_ciudad: "", emp_logo: "",
  prefix: "OS", dias_venc: 3, alert_pct: 20,
}

const EMPTY_VEHICLE: Partial<Vehicle> = {
  placa: "", marca: "Honda", tipo: "moto", modelo: "", anio: "", color: "", capacidad_tanque: 0,
  rendimiento_esperado: BRAND_YIELDS.Honda, operario_asignado_id: null, kilometraje_inicial: 0, activo: true,
}

const EMPTY_PROFILE: Partial<Profile> & { password?: string } = {
  full_name: "", role: "operario", email: "", cedula: "", telefono: "", cargo: "", zona: "", observaciones: "", activo: true, password: "",
}

const EMPTY_STATION: Partial<ServiceStation> = {
  nombre: "", nit: "", direccion: "", telefono: "", combustible: "Corriente", logo_url: "", activo: true,
}

export function AdminView() {
  const [settings, setSettings] = useState<CompanySettings>(EMPTY_SETTINGS)
  const [stations, setStations] = useState<ServiceStation[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [orders, setOrders] = useState<FuelOrder[]>([])
  const [records, setRecords] = useState<FuelRecord[]>([])
  const [vehicleDraft, setVehicleDraft] = useState<Partial<Vehicle>>(EMPTY_VEHICLE)
  const [profileDraft, setProfileDraft] = useState<Partial<Profile> & { password?: string }>(EMPTY_PROFILE)
  const [stationDraft, setStationDraft] = useState<Partial<ServiceStation>>(EMPTY_STATION)
  const [showVehicle, setShowVehicle] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showStation, setShowStation] = useState(false)
  const [newPin, setNewPin] = useState("")
  const [stationSchemaReady, setStationSchemaReady] = useState(true)

  const load = useCallback(async () => {
    try {
      const hasStations = await hasStationSchema()
      setStationSchemaReady(hasStations)
      const orderSelect: string = hasStations ? "*, vehicles(*), station:station_id(*), profiles:operator_id(*), despachador:despachador_id(*)" : "*, vehicles(*), profiles:operator_id(*), despachador:despachador_id(*)"
      const [settingsResult, stationsResult, vehiclesResult, profilesResult, ordersResult, recordsResult] = await Promise.all([
        supabase.from("company_settings").select("*").limit(1).maybeSingle(),
        hasStations ? supabase.from("service_stations").select("*").order("nombre") : Promise.resolve({ data: [], error: null }),
        supabase.from("vehicles").select("*, profiles:operario_asignado_id(*)").order("placa"),
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("fuel_orders").select(orderSelect).order("created_at", { ascending: false }),
        loadFuelRecords(undefined, { stationSchemaReady: hasStations }),
      ])
      for (const result of [settingsResult, stationsResult, vehiclesResult, profilesResult, ordersResult]) if (result.error) throw result.error
      if (settingsResult.data) setSettings(settingsResult.data as CompanySettings)
      setStations((stationsResult.data || []) as ServiceStation[])
      setVehicles((vehiclesResult.data || []) as Vehicle[])
      setProfiles((profilesResult.data || []) as Profile[])
      setOrders((ordersResult.data || []) as unknown as FuelOrder[])
      setRecords(recordsResult)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "No fue posible cargar el panel administrativo.")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const metrics = useMemo(() => {
    const gallons = records.reduce((sum, record) => sum + record.galones, 0)
    const value = records.reduce((sum, record) => sum + record.valor_total, 0)
    return {
      gallons,
      value,
      average: records.length ? gallons / records.length : 0,
      alerts: records.filter((record) => record.alerta_rendimiento).length,
      pending: orders.filter((order) => order.estado === "pendiente").length,
    }
  }, [orders, records])

  const monthly = useMemo(() => aggregate(records, (record) => record.fecha.slice(0, 7), (record) => ({ gallons: record.galones, value: record.valor_total })), [records])
  const byOperator = useMemo(() => aggregate(records, (record) => record.profiles?.full_name || "Sin nombre", (record) => ({ value: record.valor_total })), [records])
  const byBrand = useMemo(() => aggregate(records, (record) => record.vehicles?.marca || "Otra", (record) => ({ count: 1, gallons: record.galones, value: record.valor_total, yield: record.rendimiento_real || 0, yieldCount: record.rendimiento_real ? 1 : 0 })), [records])
  const byVehicle = useMemo(() => aggregate(records, (record) => record.vehicles?.placa || "Sin placa", (record) => ({ count: 1, gallons: record.galones, value: record.valor_total, yield: record.rendimiento_real || 0, yieldCount: record.rendimiento_real ? 1 : 0 })), [records])

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault()
    const { error } = await supabase.from("company_settings").update({ ...settings, pin: undefined }).eq("id", settings.id)
    if (error) return toast.error(error.message)
    if (newPin) {
      const { error: pinError } = await supabase.rpc("set_admin_pin", { p_pin: newPin })
      if (pinError) return toast.error(pinError.message)
      setNewPin("")
    }
    toast.success("Configuracion actualizada.")
    await load()
  }

  const saveVehicle = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!vehicleDraft.placa || !vehicleDraft.marca || !vehicleDraft.capacidad_tanque) return toast.error("Placa, marca y capacidad son obligatorios.")
    const payload = {
      placa: vehicleDraft.placa.toUpperCase().trim(), marca: vehicleDraft.marca, tipo: vehicleDraft.tipo || "moto",
      modelo: vehicleDraft.modelo || null, anio: vehicleDraft.anio || null, color: vehicleDraft.color || null,
      capacidad_tanque: Number(vehicleDraft.capacidad_tanque), rendimiento_esperado: Number(vehicleDraft.rendimiento_esperado || BRAND_YIELDS[vehicleDraft.marca] || 50),
      operario_asignado_id: vehicleDraft.operario_asignado_id || null, kilometraje_inicial: Number(vehicleDraft.kilometraje_inicial || 0), activo: vehicleDraft.activo ?? true,
    }
    const result = vehicleDraft.id ? await supabase.from("vehicles").update(payload).eq("id", vehicleDraft.id) : await supabase.from("vehicles").insert(payload)
    if (result.error) return toast.error(result.error.message)
    toast.success("Moto guardada.")
    setShowVehicle(false)
    await load()
  }

  const deleteVehicle = async (vehicle: Vehicle) => {
    if (!confirm(`Eliminar la moto ${vehicle.placa}?`)) return
    const { error } = await supabase.from("vehicles").delete().eq("id", vehicle.id)
    if (error) return toast.error(error.message)
    toast.success("Moto eliminada.")
    await load()
  }

  const saveStation = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!stationDraft.nombre || !stationDraft.combustible) return toast.error("Nombre y combustible son obligatorios.")
    const payload = {
      nombre: stationDraft.nombre.trim(),
      nit: stationDraft.nit?.trim() || "",
      direccion: stationDraft.direccion?.trim() || "",
      telefono: stationDraft.telefono?.trim() || "",
      combustible: stationDraft.combustible.trim(),
      logo_url: stationDraft.logo_url?.trim() || "",
      activo: stationDraft.activo ?? true,
      updated_at: new Date().toISOString(),
    }
    const result = stationDraft.id ? await supabase.from("service_stations").update(payload).eq("id", stationDraft.id) : await supabase.from("service_stations").insert(payload)
    if (result.error) return toast.error(result.error.message)
    toast.success("Estacion guardada.")
    setShowStation(false)
    await load()
  }

  const deleteStation = async (station: ServiceStation) => {
    if (!confirm(`Eliminar la estacion ${station.nombre}?`)) return
    const { error } = await supabase.from("service_stations").delete().eq("id", station.id)
    if (error) return toast.error(error.message)
    toast.success("Estacion eliminada.")
    await load()
  }

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profileDraft.full_name || !profileDraft.email || !profileDraft.role) return toast.error("Nombre, correo y rol son obligatorios.")
    if (profileDraft.id) {
      const payload = { ...profileDraft }
      delete payload.password
      const { error } = await supabase.from("profiles").update(payload).eq("id", profileDraft.id)
      if (error) return toast.error(error.message)
    } else {
      const { data } = await supabase.auth.getSession()
      const response = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify(profileDraft),
      })
      const body = await response.json()
      if (!response.ok) return toast.error(body.error)
    }
    toast.success("Personal guardado.")
    setShowProfile(false)
    await load()
  }

  const deleteProfile = async (profile: Profile) => {
    if (!confirm(`Eliminar la cuenta de ${profile.full_name}?`)) return
    const { data } = await supabase.auth.getSession()
    const response = await fetch(`/api/admin/users?id=${profile.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${data.session?.access_token || ""}` } })
    const body = await response.json()
    if (!response.ok) return toast.error(body.error)
    toast.success("Cuenta eliminada.")
    await load()
  }

  return (
    <div className="space-y-5">
      <div><h2 className="text-2xl font-black">Administracion general</h2><p className="text-sm text-muted-foreground">Control integral de tanqueo y flota</p></div>
      {!stationSchemaReady && <SchemaUpdateAlert />}
      <Tabs defaultValue="dashboard">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger><TabsTrigger value="ordenes">Ordenes</TabsTrigger><TabsTrigger value="registros">Registros</TabsTrigger><TabsTrigger value="flota">Flota</TabsTrigger><TabsTrigger value="estaciones">Estaciones</TabsTrigger><TabsTrigger value="personal">Personal</TabsTrigger><TabsTrigger value="config">Configuracion</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <Metric label="Registros" value={records.length} icon={<ClipboardList />} /><Metric label="Galones totales" value={metrics.gallons.toFixed(1)} icon={<Fuel />} /><Metric label="Gasto total" value={`$${(metrics.value / 1_000_000).toFixed(1)}M`} icon={<DollarSign />} /><Metric label="Motos activas" value={vehicles.filter((item) => item.activo !== false).length} icon={<Car />} /><Metric label="Estaciones activas" value={stations.filter((item) => item.activo).length} icon={<Building2 />} /><Metric label="Prom. gal/registro" value={metrics.average.toFixed(2)} icon={<BarChart3 />} /><Metric label="Alertas" value={metrics.alerts} icon={<AlertTriangle />} /><Metric label="Ordenes pendientes" value={metrics.pending} icon={<ClipboardList />} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Chart title="Consumo mensual"><BarChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="gallons" fill="#1a56db" /></BarChart></Chart>
            <Chart title="Gasto por operario"><BarChart data={byOperator}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#0ea768" /></BarChart></Chart>
            <Chart title="Rendimiento km/gal por moto"><BarChart data={byVehicle.map((item) => ({ ...item, averageYield: item.yieldCount ? item.yield / item.yieldCount : 0 }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="averageYield" fill="#d97706" /></BarChart></Chart>
            <Chart title="Distribucion por marca"><PieChart><Pie data={byBrand} dataKey="value" nameKey="name" outerRadius={85}>{byBrand.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></Chart>
            <Chart title="Distribucion por placa"><PieChart><Pie data={byVehicle} dataKey="gallons" nameKey="name" outerRadius={85}>{byVehicle.map((item, index) => <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></Chart>
            <Chart title="Evolucion de costos" wide><LineChart data={monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line type="monotone" dataKey="value" stroke="#7c3aed" /></LineChart></Chart>
          </div>
          <SummaryTables byVehicle={byVehicle} byOperator={byOperator} byBrand={byBrand} orders={orders} />
        </TabsContent>
        <TabsContent value="ordenes"><DespachadorView embedded /></TabsContent>
        <TabsContent value="registros"><RecordsView allowDelete /></TabsContent>
        <TabsContent value="flota">
          <Section title="Flota de motos" button={<Button onClick={() => { setVehicleDraft(EMPTY_VEHICLE); setShowVehicle(true) }}><Plus className="w-4 h-4 mr-1" /> Nueva moto</Button>}>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{vehicles.length ? vehicles.map((vehicle) => <Card key={vehicle.id}><CardHeader><CardTitle>{vehicle.placa}</CardTitle></CardHeader><CardContent className="space-y-1 text-sm"><p>{vehicle.marca} {vehicle.modelo}</p><p>Capacidad: {vehicle.capacidad_tanque} gal</p><p>Rendimiento: {vehicle.rendimiento_esperado} km/gal</p><p>Operario: {vehicle.profiles?.full_name || "Sin asignar"}</p><div className="flex gap-2 pt-2"><Button variant="outline" size="sm" onClick={() => { setVehicleDraft(vehicle); setShowVehicle(true) }}><Edit className="w-4 h-4" /></Button><Button variant="destructive" size="sm" onClick={() => deleteVehicle(vehicle)}><Trash2 className="w-4 h-4" /></Button></div></CardContent></Card>) : <p className="text-muted-foreground">No hay motos registradas.</p>}</div>
          </Section>
        </TabsContent>
        <TabsContent value="estaciones">
          <Section title="Estaciones de servicio" button={<Button disabled={!stationSchemaReady} onClick={() => { setStationDraft(EMPTY_STATION); setShowStation(true) }}><Plus className="w-4 h-4 mr-1" /> Nueva estacion</Button>}>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{stations.length ? stations.map((station) => <Card key={station.id}><CardHeader><CardTitle className="flex items-center justify-between gap-2"><span>{station.nombre}</span><Badge variant={station.activo ? "secondary" : "outline"}>{station.activo ? "activa" : "inactiva"}</Badge></CardTitle></CardHeader><CardContent className="space-y-1 text-sm"><p>{station.combustible}</p><p>{station.direccion || "Sin direccion"}</p><p>{station.telefono || "Sin telefono"}</p><div className="flex gap-2 pt-2"><Button variant="outline" size="sm" onClick={() => { setStationDraft(station); setShowStation(true) }}><Edit className="w-4 h-4" /></Button><Button variant="destructive" size="sm" onClick={() => deleteStation(station)}><Trash2 className="w-4 h-4" /></Button></div></CardContent></Card>) : <p className="text-muted-foreground">No hay estaciones registradas.</p>}</div>
          </Section>
        </TabsContent>
        <TabsContent value="personal">
          <Section title="Operarios y despachadores" button={<Button onClick={() => { setProfileDraft(EMPTY_PROFILE); setShowProfile(true) }}><Plus className="w-4 h-4 mr-1" /> Nuevo usuario</Button>}>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th className="p-3">Nombre</th><th className="p-3">Rol</th><th className="p-3">Cedula</th><th className="p-3">Telefono</th><th className="p-3">Zona</th><th></th></tr></thead><tbody>{profiles.map((profile) => <tr key={profile.id} className="border-t"><td className="p-3">{profile.full_name}</td><td className="p-3"><Badge>{profile.role}</Badge></td><td className="p-3">{profile.cedula}</td><td className="p-3">{profile.telefono}</td><td className="p-3">{profile.zona}</td><td className="p-3 flex gap-1"><Button variant="ghost" size="icon" onClick={() => { setProfileDraft(profile); setShowProfile(true) }}><Edit className="w-4 h-4" /></Button><Button variant="ghost" size="icon" onClick={() => deleteProfile(profile)}><Trash2 className="w-4 h-4 text-red-500" /></Button></td></tr>)}</tbody></table></div>
          </Section>
        </TabsContent>
        <TabsContent value="config">
          <form onSubmit={saveSettings} className="space-y-4">
            <SettingsCard title="Empresa"><SettingsFields settings={settings} setSettings={setSettings} /></SettingsCard>
            <SettingsCard title="Sistema"><div className="grid sm:grid-cols-4 gap-3"><Field label="Prefijo"><Input value={settings.prefix} onChange={(event) => setSettings({ ...settings, prefix: event.target.value.toUpperCase() })} /></Field><Field label="Dias vencimiento"><Input type="number" value={settings.dias_venc} onChange={(event) => setSettings({ ...settings, dias_venc: Number(event.target.value) })} /></Field><Field label="% alerta rendimiento"><Input type="number" value={settings.alert_pct} onChange={(event) => setSettings({ ...settings, alert_pct: Number(event.target.value) })} /></Field><Field label="Nuevo PIN admin"><Input type="password" value={newPin} onChange={(event) => setNewPin(event.target.value)} placeholder="Dejar vacio para conservar" /></Field></div></SettingsCard>
            <Button className="bg-emerald-600 hover:bg-emerald-700">Guardar configuracion</Button>
          </form>
        </TabsContent>
      </Tabs>

      <Dialog open={showVehicle} onOpenChange={setShowVehicle}><DialogContent><DialogHeader><DialogTitle>Moto de la flota</DialogTitle></DialogHeader><form onSubmit={saveVehicle} className="grid grid-cols-2 gap-3">
        <Field label="Placa"><Input value={vehicleDraft.placa || ""} onChange={(event) => setVehicleDraft({ ...vehicleDraft, placa: event.target.value })} /></Field>
        <Field label="Marca"><Select value={vehicleDraft.marca} onValueChange={(marca) => setVehicleDraft({ ...vehicleDraft, marca, rendimiento_esperado: BRAND_YIELDS[marca] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{VEHICLE_BRANDS.map((brand) => <SelectItem key={brand} value={brand}>{brand}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Modelo"><Input value={vehicleDraft.modelo || ""} onChange={(event) => setVehicleDraft({ ...vehicleDraft, modelo: event.target.value })} /></Field><Field label="Ano"><Input value={vehicleDraft.anio || ""} onChange={(event) => setVehicleDraft({ ...vehicleDraft, anio: event.target.value })} /></Field>
        <Field label="Capacidad gal"><Input type="number" step="0.1" value={vehicleDraft.capacidad_tanque || ""} onChange={(event) => setVehicleDraft({ ...vehicleDraft, capacidad_tanque: Number(event.target.value) })} /></Field><Field label="Rendimiento km/gal"><Input type="number" value={vehicleDraft.rendimiento_esperado || ""} onChange={(event) => setVehicleDraft({ ...vehicleDraft, rendimiento_esperado: Number(event.target.value) })} /></Field>
        <Field label="KM inicial"><Input type="number" value={vehicleDraft.kilometraje_inicial || ""} onChange={(event) => setVehicleDraft({ ...vehicleDraft, kilometraje_inicial: Number(event.target.value) })} /></Field><Field label="Color / descripcion"><Input value={vehicleDraft.color || ""} onChange={(event) => setVehicleDraft({ ...vehicleDraft, color: event.target.value })} /></Field>
        <Field label="Estado"><Select value={vehicleDraft.activo === false ? "inactive" : "active"} onValueChange={(value) => setVehicleDraft({ ...vehicleDraft, activo: value === "active" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activa</SelectItem><SelectItem value="inactive">Inactiva</SelectItem></SelectContent></Select></Field>
        <div className="col-span-2"><Field label="Operario asignado"><Select value={vehicleDraft.operario_asignado_id || "none"} onValueChange={(value) => setVehicleDraft({ ...vehicleDraft, operario_asignado_id: value === "none" ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin asignar</SelectItem>{profiles.filter((profile) => profile.role === "operario").map((profile) => <SelectItem value={profile.id} key={profile.id}>{profile.full_name}</SelectItem>)}</SelectContent></Select></Field></div><Button className="col-span-2">Guardar moto</Button>
      </form></DialogContent></Dialog>

      <Dialog open={showStation} onOpenChange={setShowStation}><DialogContent><DialogHeader><DialogTitle>Estacion de servicio</DialogTitle></DialogHeader><form onSubmit={saveStation} className="grid grid-cols-2 gap-3">
        <Field label="Nombre"><Input value={stationDraft.nombre || ""} onChange={(event) => setStationDraft({ ...stationDraft, nombre: event.target.value })} /></Field><Field label="NIT"><Input value={stationDraft.nit || ""} onChange={(event) => setStationDraft({ ...stationDraft, nit: event.target.value })} /></Field>
        <Field label="Direccion"><Input value={stationDraft.direccion || ""} onChange={(event) => setStationDraft({ ...stationDraft, direccion: event.target.value })} /></Field><Field label="Telefono"><Input value={stationDraft.telefono || ""} onChange={(event) => setStationDraft({ ...stationDraft, telefono: event.target.value })} /></Field>
        <Field label="Combustible"><Input value={stationDraft.combustible || ""} onChange={(event) => setStationDraft({ ...stationDraft, combustible: event.target.value })} /></Field>
        <Field label="Logo URL"><Input value={stationDraft.logo_url || ""} onChange={(event) => setStationDraft({ ...stationDraft, logo_url: event.target.value })} /></Field><Field label="Estado"><Select value={stationDraft.activo === false ? "inactive" : "active"} onValueChange={(value) => setStationDraft({ ...stationDraft, activo: value === "active" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activa</SelectItem><SelectItem value="inactive">Inactiva</SelectItem></SelectContent></Select></Field>
        <Button className="col-span-2">Guardar estacion</Button>
      </form></DialogContent></Dialog>

      <Dialog open={showProfile} onOpenChange={setShowProfile}><DialogContent><DialogHeader><DialogTitle>Personal</DialogTitle></DialogHeader><form onSubmit={saveProfile} className="grid grid-cols-2 gap-3">
        <Field label="Nombre"><Input value={profileDraft.full_name || ""} onChange={(event) => setProfileDraft({ ...profileDraft, full_name: event.target.value })} /></Field><Field label="Rol"><Select value={profileDraft.role} onValueChange={(role: UserRole) => setProfileDraft({ ...profileDraft, role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="operario">Operario</SelectItem><SelectItem value="despachador">Despachador</SelectItem><SelectItem value="admin">Administrador</SelectItem></SelectContent></Select></Field>
        <Field label="Cedula"><Input value={profileDraft.cedula || ""} onChange={(event) => setProfileDraft({ ...profileDraft, cedula: event.target.value })} /></Field><Field label="Telefono"><Input value={profileDraft.telefono || ""} onChange={(event) => setProfileDraft({ ...profileDraft, telefono: event.target.value })} /></Field>
        <Field label="Correo"><Input type="email" value={profileDraft.email || ""} onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })} /></Field><Field label="Cargo"><Input value={profileDraft.cargo || ""} onChange={(event) => setProfileDraft({ ...profileDraft, cargo: event.target.value })} /></Field>
        <Field label="Zona / ruta"><Input value={profileDraft.zona || ""} onChange={(event) => setProfileDraft({ ...profileDraft, zona: event.target.value })} /></Field><Field label="Estado"><Select value={profileDraft.activo === false ? "inactive" : "active"} onValueChange={(value) => setProfileDraft({ ...profileDraft, activo: value === "active" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Activo</SelectItem><SelectItem value="inactive">Inactivo</SelectItem></SelectContent></Select></Field>{!profileDraft.id && <Field label="Contrasena temporal"><Input type="password" value={profileDraft.password || ""} onChange={(event) => setProfileDraft({ ...profileDraft, password: event.target.value })} /></Field>}
        <div className="col-span-2"><Field label="Observaciones"><Textarea value={profileDraft.observaciones || ""} onChange={(event) => setProfileDraft({ ...profileDraft, observaciones: event.target.value })} /></Field></div><Button className="col-span-2">Guardar personal</Button>
      </form></DialogContent></Dialog>
    </div>
  )
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return <Card><CardContent className="p-3"><div className="w-5 h-5 text-blue-500">{icon}</div><p className="mt-2 text-xl font-black">{value}</p><p className="text-[10px] uppercase text-muted-foreground">{label}</p></CardContent></Card>
}

function Chart({ title, children, wide = false }: { title: string; children: React.ReactElement; wide?: boolean }) {
  return <Card className={wide ? "lg:col-span-2" : ""}><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="h-64"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></CardContent></Card>
}

function SummaryTables({ byVehicle, byOperator, byBrand, orders }: { byVehicle: any[]; byOperator: any[]; byBrand: any[]; orders: FuelOrder[] }) {
  const states = ["pendiente", "ejecutada", "vencida", "cerrada", "verificado", "observacion"]
  return <div className="grid lg:grid-cols-2 gap-4"><SmallTable title="Resumen por moto" rows={byVehicle.map((item) => [item.name, item.count || 0, `${(item.gallons || 0).toFixed(1)} gal`, formatCurrency(item.value)])} /><SmallTable title="Resumen por operario" rows={byOperator.map((item) => [item.name, "-", "-", formatCurrency(item.value)])} /><SmallTable title="Rendimiento por marca" rows={byBrand.map((item) => [item.name, item.count || 0, `${(item.gallons || 0).toFixed(1)} gal`, item.yieldCount ? `${(item.yield / item.yieldCount).toFixed(1)} km/gal` : "-"])} /><SmallTable title="Estado de ordenes" rows={states.map((state) => [state, orders.filter((item) => item.estado === state).length, "", ""])} /></div>
}

function SmallTable({ title, rows }: { title: string; rows: Array<Array<string | number>> }) {
  return <Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-xs"><tbody>{rows.length ? rows.map((row, index) => <tr key={`${row[0]}-${index}`} className="border-t">{row.map((cell, cellIndex) => <td className="p-2" key={cellIndex}>{cell}</td>)}</tr>) : <tr><td className="p-4 text-muted-foreground">Sin datos</td></tr>}</tbody></table></CardContent></Card>
}

function Section({ title, button, children }: { title: string; button: React.ReactNode; children: React.ReactNode }) {
  return <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>{title}</CardTitle>{button}</CardHeader><CardContent>{children}</CardContent></Card>
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>
}

function SettingsFields({ settings, setSettings }: { settings: CompanySettings; setSettings: (value: CompanySettings) => void }) {
  const fields = [["Nombre", "emp_nombre"], ["NIT / RUT", "emp_nit"], ["Direccion", "emp_dir"], ["Telefono", "emp_tel"], ["Correo", "emp_email"], ["Ciudad", "emp_ciudad"]]
  return <div className="grid sm:grid-cols-2 gap-3">{fields.map(([label, key]) => <Field key={key} label={label}><Input value={String(settings[key as keyof CompanySettings] ?? "")} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} /></Field>)}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>
}

function aggregate<T extends Record<string, number>>(records: FuelRecord[], key: (record: FuelRecord) => string, values: (record: FuelRecord) => T): Array<{ name: string } & T> {
  const result: Record<string, Record<string, number>> = {}
  records.forEach((record) => {
    const name = key(record)
    if (!result[name]) result[name] = {}
    Object.entries(values(record)).forEach(([valueKey, value]) => { result[name][valueKey] = (result[name][valueKey] || 0) + value })
  })
  return Object.entries(result).map(([name, values]) => ({ name, ...values })) as Array<{ name: string } & T>
}
