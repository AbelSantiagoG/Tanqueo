"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardList, Download, Eye, MapPin, Plus, Printer, RefreshCw, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { createFuelOrder, expireFuelOrders } from "@/lib/fuel-service"
import { formatCurrency, formatDate, todayIso } from "@/lib/fuel-utils"
import { downloadFuelOrderPdf, printFuelOrder } from "@/lib/order-print"
import { hasStationSchema } from "@/lib/schema-capabilities"
import { supabase } from "@/lib/supabase"
import type { CompanySettings, FuelOrder, OrderPhoto, Profile, ServiceStation, Vehicle } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { SchemaUpdateAlert } from "@/components/ui/schema-update-alert"

export function DespachadorView({ embedded = false }: { embedded?: boolean }) {
  const { role } = useAuth()
  const [orders, setOrders] = useState<FuelOrder[]>([])
  const [operators, setOperators] = useState<Profile[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [stations, setStations] = useState<ServiceStation[]>([])
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [photos, setPhotos] = useState<OrderPhoto[]>([])
  const [selected, setSelected] = useState<FuelOrder | null>(null)
  const [statusFilter, setStatusFilter] = useState("todas")
  const [search, setSearch] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [operatorId, setOperatorId] = useState("")
  const [vehicleId, setVehicleId] = useState("")
  const [stationId, setStationId] = useState("")
  const [authorizedGallons, setAuthorizedGallons] = useState("")
  const [issueDate, setIssueDate] = useState(todayIso())
  const [expiryDate, setExpiryDate] = useState(todayIso())
  const [notes, setNotes] = useState("")
  const [stationSchemaReady, setStationSchemaReady] = useState(true)

  const load = useCallback(async () => {
    try {
      const hasStations = await hasStationSchema()
      setStationSchemaReady(hasStations)
      await expireFuelOrders()
      const orderSelect: string = hasStations ? "*, vehicles(*), station:station_id(*), profiles:operator_id(*), despachador:despachador_id(*)" : "*, vehicles(*), profiles:operator_id(*), despachador:despachador_id(*)"
      const [settingsResult, profilesResult, vehiclesResult, stationsResult, ordersResult] = await Promise.all([
        supabase.from("company_settings").select("*").limit(1).maybeSingle(),
        supabase.from("profiles").select("*").eq("role", "operario").eq("activo", true).order("full_name"),
        supabase.from("vehicles").select("*, profiles:operario_asignado_id(*)").eq("activo", true).order("placa"),
        hasStations ? supabase.from("service_stations").select("*").eq("activo", true).order("nombre") : Promise.resolve({ data: [], error: null }),
        supabase.from("fuel_orders").select(orderSelect).order("created_at", { ascending: false }),
      ])
      if (settingsResult.error) throw settingsResult.error
      if (profilesResult.error) throw profilesResult.error
      if (vehiclesResult.error) throw vehiclesResult.error
      if (stationsResult.error) throw stationsResult.error
      if (ordersResult.error) throw ordersResult.error
      setSettings(settingsResult.data as CompanySettings | null)
      setOperators((profilesResult.data || []) as Profile[])
      setVehicles((vehiclesResult.data || []) as Vehicle[])
      setStations((stationsResult.data || []) as ServiceStation[])
      setOrders((ordersResult.data || []) as unknown as FuelOrder[])
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "No fue posible cargar ordenes y flota.")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    const issue = todayIso()
    const expiry = new Date(`${issue}T00:00:00`)
    expiry.setDate(expiry.getDate() + (settings?.dias_venc || 3))
    setOperatorId("")
    setVehicleId("")
    setStationId("")
    setAuthorizedGallons("")
    setIssueDate(issue)
    setExpiryDate(expiry.toISOString().split("T")[0])
    setNotes("")
    setShowCreate(true)
  }

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!operatorId || !vehicleId || !stationId || !authorizedGallons || !issueDate || !expiryDate) return toast.error("Completa los campos obligatorios.")
    if (Number(authorizedGallons) <= 0) return toast.error("Los galones autorizados deben ser mayores que cero.")
    setSaving(true)
    try {
      const order = await createFuelOrder({ operatorId, vehicleId, stationId, authorizedGallons: Number(authorizedGallons), issueDate, expiryDate, notes })
      toast.success(`Orden ${order.num} creada correctamente.`)
      setShowCreate(false)
      await load()
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "No se pudo crear la orden.")
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (order: FuelOrder) => {
    setSelected(order)
    const { data, error } = await supabase.from("order_photos").select("*").eq("order_id", order.id)
    if (error) console.error(error)
    setPhotos((data || []) as OrderPhoto[])
  }

  const updateStatus = async (order: FuelOrder, estado: "cerrada" | "verificado" | "observacion") => {
    if (!confirm(`Confirmar cambio de ${order.num} a ${estado}?`)) return
    const { error } = await supabase.from("fuel_orders").update({ estado }).eq("id", order.id)
    if (error) return toast.error(error.message)
    toast.success(`Orden ${order.num} actualizada.`)
    setSelected(null)
    await load()
  }

  const deleteOrder = async (order: FuelOrder) => {
    if (!confirm(`Eliminar la orden ${order.num}?`)) return
    const { error } = await supabase.from("fuel_orders").delete().eq("id", order.id)
    if (error) return toast.error(error.message)
    toast.success("Orden eliminada.")
    setSelected(null)
    await load()
  }

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const term = search.toLowerCase()
    const matchesText = order.num.toLowerCase().includes(term)
      || (order.vehicles?.placa || "").toLowerCase().includes(term)
      || (order.profiles?.full_name || "").toLowerCase().includes(term)
      || (order.station?.nombre || "").toLowerCase().includes(term)
    return matchesText && (statusFilter === "todas" || order.estado === statusFilter)
  }), [orders, search, statusFilter])

  const badge = (status: FuelOrder["estado"]) => <Badge variant={status === "vencida" ? "destructive" : "secondary"} className={status === "ejecutada" || status === "verificado" ? "bg-emerald-500/15 text-emerald-600" : ""}>{status}</Badge>

  return (
    <div className="space-y-5">
      {!embedded && <div><h2 className="text-2xl font-black">Panel de despacho</h2><p className="text-sm text-muted-foreground">Flota y ordenes de suministro</p></div>}
      {!embedded && !stationSchemaReady && <SchemaUpdateAlert />}
      <Tabs defaultValue="ordenes">
        <TabsList><TabsTrigger value="ordenes">Ordenes</TabsTrigger><TabsTrigger value="flota">Flota</TabsTrigger></TabsList>
        <TabsContent value="ordenes" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["pendiente", "ejecutada", "vencida", "cerrada"] as const).map((status) => <Card key={status}><CardContent className="p-4"><p className="text-xs capitalize text-muted-foreground">{status}</p><p className="text-2xl font-bold">{orders.filter((order) => order.estado === status).length}</p></CardContent></Card>)}
          </div>
          <Card>
            <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex gap-2"><ClipboardList className="w-5 h-5" /> Ordenes de suministro</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Buscar orden, placa u operario" /></div>
                <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{["todas", "pendiente", "ejecutada", "vencida", "cerrada", "verificado", "observacion"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select>
                <Button variant="outline" size="icon" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
                <Button onClick={openCreate} disabled={!stationSchemaReady} className="bg-amber-600 hover:bg-amber-700"><Plus className="w-4 h-4 mr-1" /> Nueva orden</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm"><thead><tr className="border-t text-left"><th className="p-3">Orden</th><th className="p-3">Moto</th><th className="p-3">Operario</th><th className="p-3">Estacion</th><th className="p-3">Galones registrados</th><th className="p-3">Vence</th><th className="p-3">Estado</th><th className="p-3"></th></tr></thead><tbody>
                {!filteredOrders.length ? <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Sin ordenes para mostrar.</td></tr> : filteredOrders.map((order) => <tr key={order.id} className="border-t"><td className="p-3 font-mono font-bold">{order.num}</td><td className="p-3">{order.vehicles?.placa}</td><td className="p-3">{order.profiles?.full_name}</td><td className="p-3">{order.station?.nombre || "-"}</td><td className="p-3">{order.galones ?? "-"}</td><td className="p-3">{formatDate(order.fecha_vencimiento)}</td><td className="p-3">{badge(order.estado)}</td><td className="p-3"><Button size="icon" variant="ghost" onClick={() => openDetail(order)}><Eye className="w-4 h-4" /></Button></td></tr>)}
              </tbody></table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="flota">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">{vehicles.length ? vehicles.map((vehicle) => <Card key={vehicle.id}><CardHeader><CardTitle>{vehicle.placa}</CardTitle></CardHeader><CardContent className="space-y-1 text-sm"><p>{vehicle.marca} {vehicle.modelo}</p><p>Capacidad: <strong>{vehicle.capacidad_tanque} gal</strong></p><p>Rendimiento esperado: <strong>{vehicle.rendimiento_esperado} km/gal</strong></p><p>Operario: <strong>{vehicle.profiles?.full_name || "Sin asignar"}</strong></p></CardContent></Card>) : <p className="text-muted-foreground">No hay motos registradas.</p>}</div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreate} onOpenChange={setShowCreate}><DialogContent><DialogHeader><DialogTitle>Nueva orden de suministro</DialogTitle><DialogDescription>Define el operario, la moto, la estacion y los galones autorizados.</DialogDescription></DialogHeader><form onSubmit={createOrder} className="space-y-3">
        <p className="rounded-md bg-blue-500/10 p-2 text-xs">El numero se genera en Supabase al guardar para evitar consecutivos repetidos.</p>
        <Field label="Operario"><Select value={operatorId} onValueChange={setOperatorId}><SelectTrigger><SelectValue placeholder="Selecciona operario" /></SelectTrigger><SelectContent>{operators.map((item) => <SelectItem key={item.id} value={item.id}>{item.full_name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Moto"><Select value={vehicleId} onValueChange={setVehicleId}><SelectTrigger><SelectValue placeholder="Selecciona moto" /></SelectTrigger><SelectContent>{vehicles.map((item) => <SelectItem key={item.id} value={item.id}>{item.placa} | {item.marca}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Estacion de servicio"><Select value={stationId} onValueChange={setStationId}><SelectTrigger><SelectValue placeholder="Selecciona estacion" /></SelectTrigger><SelectContent>{stations.map((item) => <SelectItem key={item.id} value={item.id}>{item.nombre} | {item.combustible}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Galones autorizados"><Input type="number" min="0.01" step="0.01" value={authorizedGallons} onChange={(event) => setAuthorizedGallons(event.target.value)} placeholder="Cantidad maxima autorizada" /></Field>
        <p className="rounded-md bg-amber-500/10 p-2 text-xs">El operario registrara los galones reales y el valor total de la factura al momento del suministro.</p>
        <div className="grid grid-cols-2 gap-3"><Field label="Emision"><Input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} /></Field><Field label="Vencimiento"><Input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} /></Field></div>
        <Field label="Observaciones"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        <Button disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700">{saving ? "Guardando..." : "Crear orden"}</Button>
      </form></DialogContent></Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Detalle de orden {selected?.num}</DialogTitle><DialogDescription>Consulta, imprime o descarga el comprobante de la orden.</DialogDescription></DialogHeader>{selected && <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2"><p>Estado: {badge(selected.estado)}</p><p>Vence: <strong>{formatDate(selected.fecha_vencimiento)}</strong></p><p>Operario: <strong>{selected.profiles?.full_name}</strong></p><p>Moto: <strong>{selected.vehicles?.placa}</strong></p><p>Estacion: <strong>{selected.station?.nombre || "-"}</strong></p><p>Galones autorizados: <strong>{selected.galones_autorizados ?? "-"} gal</strong></p><p>Galones registrados: <strong>{selected.galones ?? "-"} gal</strong></p><p>Valor: <strong>{formatCurrency(selected.valor_total)}</strong></p><p>Rendimiento: <strong>{selected.rendimiento_real || "-"} km/gal</strong></p></div>
        {selected.gps_maps_url && <a className="flex gap-1 text-blue-500 underline" href={selected.gps_maps_url} target="_blank" rel="noreferrer"><MapPin className="w-4 h-4" /> Abrir ubicacion en Google Maps</a>}
        {photos.length > 0 && <div className="grid grid-cols-3 gap-2">{photos.map((photo) => <a href={photo.photo_url} target="_blank" rel="noreferrer" key={photo.id}><img src={photo.photo_url} alt={photo.tipo} className="aspect-square w-full rounded-md object-cover" onError={(event) => { event.currentTarget.style.display = "none" }} /><small className="block text-center uppercase">{photo.tipo}</small></a>)}</div>}
        <div className="flex flex-wrap gap-2 border-t pt-3"><Button variant="outline" onClick={() => printFuelOrder(selected, settings, photos)}><Printer className="w-4 h-4 mr-1" /> Imprimir</Button><Button variant="outline" onClick={() => downloadFuelOrderPdf(selected, settings).catch((error) => toast.error(error.message))}><Download className="w-4 h-4 mr-1" /> Descargar PDF</Button>{selected.estado === "pendiente" && <Button variant="outline" onClick={() => updateStatus(selected, "cerrada")}>Cerrar orden</Button>}{selected.estado === "ejecutada" && <><Button onClick={() => updateStatus(selected, "verificado")}>Verificar</Button><Button variant="destructive" onClick={() => updateStatus(selected, "observacion")}>Observacion</Button></>} {(role === "admin" || selected.estado !== "ejecutada") && <Button variant="destructive" onClick={() => deleteOrder(selected)}><Trash2 className="w-4 h-4" /></Button>}</div>
      </div>}</DialogContent></Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>
}
