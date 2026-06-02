"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, ArrowLeft, Camera, CheckCircle, ChevronRight, Clock, Download, Gauge, MapPin, Printer, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/lib/auth-context"
import { executeFuelOrder, expireFuelOrders, loadFuelRecords } from "@/lib/fuel-service"
import { FUEL_LEVELS, formatCurrency, formatDate, formatNumber, todayIso } from "@/lib/fuel-utils"
import { downloadFuelOrderPdf, printFuelOrder } from "@/lib/order-print"
import { hasStationSchema } from "@/lib/schema-capabilities"
import { removeEvidence, uploadEvidence } from "@/lib/storage"
import { supabase } from "@/lib/supabase"
import type { CompanySettings, FuelOrder, FuelRecord, OrderPhoto, PhotoType, UploadedEvidence } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SchemaUpdateAlert } from "@/components/ui/schema-update-alert"
import { FuelGauge } from "@/components/ui/fuel-gauge"

type GpsStatus = "idle" | "searching" | "captured" | "error"
type PhotoState = Record<PhotoType, string | null>

const PHOTO_LABELS: Record<PhotoType, string> = {
  tablero: "Tablero",
  nivel_tanque: "Nivel del tanque",
  factura: "Factura",
}

const EMPTY_PHOTOS: PhotoState = { tablero: null, nivel_tanque: null, factura: null }

export function OperarioView() {
  const { user } = useAuth()
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [orders, setOrders] = useState<FuelOrder[]>([])
  const [records, setRecords] = useState<FuelRecord[]>([])
  const [selectedOrder, setSelectedOrder] = useState<FuelOrder | null>(null)
  const [previousRecord, setPreviousRecord] = useState<FuelRecord | null>(null)
  const [date, setDate] = useState(todayIso())
  const [mileage, setMileage] = useState("")
  const [gallons, setGallons] = useState("")
  const [invoiceValue, setInvoiceValue] = useState("")
  const [notes, setNotes] = useState("")
  const [fuelLevelIndex, setFuelLevelIndex] = useState<number | null>(null)
  const [photos, setPhotos] = useState<PhotoState>(EMPTY_PHOTOS)
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("idle")
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [receipt, setReceipt] = useState<{ record: FuelRecord; order: FuelOrder; photos: OrderPhoto[] } | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [stationSchemaReady, setStationSchemaReady] = useState(true)
  const userId = user?.id
  const cameraRefs = {
    tablero: useRef<HTMLInputElement>(null),
    nivel_tanque: useRef<HTMLInputElement>(null),
    factura: useRef<HTMLInputElement>(null),
  }
  const galleryRefs = {
    tablero: useRef<HTMLInputElement>(null),
    nivel_tanque: useRef<HTMLInputElement>(null),
    factura: useRef<HTMLInputElement>(null),
  }

  const loadData = useCallback(async () => {
    if (!userId) return
    try {
      const hasStations = await hasStationSchema()
      setStationSchemaReady(hasStations)
      await expireFuelOrders()
      const orderSelect: string = hasStations ? "*, vehicles(*), station:station_id(*), profiles:operator_id(*), despachador:despachador_id(*)" : "*, vehicles(*), profiles:operator_id(*), despachador:despachador_id(*)"
      const [settingsResult, ordersResult, recordsResult] = await Promise.all([
        supabase.from("company_settings").select("*").limit(1).maybeSingle(),
        supabase
          .from("fuel_orders")
          .select(orderSelect)
          .eq("operator_id", userId)
          .order("created_at", { ascending: false }),
        loadFuelRecords(userId, { stationSchemaReady: hasStations }),
      ])
      if (settingsResult.error) throw settingsResult.error
      if (ordersResult.error) throw ordersResult.error
      setSettings(settingsResult.data as CompanySettings | null)
      setOrders((ordersResult.data || []) as unknown as FuelOrder[])
      setRecords(recordsResult)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "No fue posible cargar tus ordenes.")
    }
  }, [userId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const activeOrders = orders.filter((order) => order.estado === "pendiente" || order.estado === "vencida")
  const recentRecords = records.slice(0, 5)
  const expectedYield = selectedOrder?.vehicles?.rendimiento_esperado || selectedOrder?.rendimiento_esperado || 50
  const projectedRange = Number(gallons) > 0 ? Math.round(Number(gallons) * expectedYield) : 0
  const calculatedYield = useMemo(() => {
    if (!previousRecord || !mileage || previousRecord.galones <= 0) return null
    const distance = Number(mileage) - previousRecord.kilometraje_actual
    return distance > 0 ? Math.round((distance / previousRecord.galones) * 10) / 10 : null
  }, [mileage, previousRecord])

  const selectOrder = async (order: FuelOrder) => {
    if (order.estado !== "pendiente") return toast.error("La orden vencida no puede ejecutarse.")
    setSelectedOrder(order)
    setDate(todayIso())
    setMileage("")
    setGallons("")
    setInvoiceValue("")
    setNotes("")
    setFuelLevelIndex(null)
    setPhotos(EMPTY_PHOTOS)
    setGps(null)
    setGpsStatus("idle")
    const { data, error } = await supabase
      .from("fuel_records")
      .select("*")
      .eq("vehicle_id", order.vehicle_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) console.error(error)
    setPreviousRecord((data as FuelRecord | null) || null)
  }

  const captureGps = () => {
    if (!navigator.geolocation) return toast.error("Este navegador no ofrece ubicacion GPS.")
    setGpsStatus("searching")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGps({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy })
        setGpsStatus("captured")
        toast.success(`Ubicacion capturada con precision aproximada de ${Math.round(coords.accuracy)} m.`)
      },
      (error) => {
        console.error(error)
        setGps(null)
        setGpsStatus("error")
        toast.error(error.code === 1 ? "Permiso GPS denegado." : "No se pudo capturar la ubicacion.")
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  const readPhoto = (type: PhotoType, file?: File) => {
    if (!file) return
    if (!file.type.startsWith("image/")) return toast.error("Selecciona un archivo de imagen.")
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => {
        const max = 1200
        const ratio = Math.min(1, max / Math.max(image.width, image.height))
        const canvas = document.createElement("canvas")
        canvas.width = Math.round(image.width * ratio)
        canvas.height = Math.round(image.height * ratio)
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height)
        setPhotos((current) => ({ ...current, [type]: canvas.toDataURL("image/jpeg", 0.75) }))
      }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const validate = () => {
    if (!selectedOrder) return "Selecciona una orden."
    if (!date || Number(mileage) <= 0 || Number(gallons) <= 0 || Number(invoiceValue) <= 0) return "Completa fecha, kilometraje, galones y valor de factura."
    if (previousRecord && Number(mileage) <= previousRecord.kilometraje_actual) return `El kilometraje debe superar ${previousRecord.kilometraje_actual} km.`
    if (!gps) return "Captura la ubicacion GPS."
    if (fuelLevelIndex === null) return "Selecciona el nivel final del tanque."
    if (Object.values(photos).some((photo) => !photo)) return "Carga las fotos del tablero, nivel del tanque y factura."
    return null
  }

  const openReview = () => {
    const error = validate()
    if (error) return toast.error(error)
    setShowReview(true)
  }

  const confirm = async () => {
    if (!selectedOrder || !user || !gps || fuelLevelIndex === null) return
    const error = validate()
    if (error) return toast.error(error)
    setIsSaving(true)
    setShowReview(false)
    const toastId = toast.loading("Subiendo evidencias...")
    const uploaded: UploadedEvidence[] = []
    try {
      const tablero = await uploadEvidence(selectedOrder.id, "tablero", photos.tablero!)
      uploaded.push(tablero)
      const nivelTanque = await uploadEvidence(selectedOrder.id, "nivel_tanque", photos.nivel_tanque!)
      uploaded.push(nivelTanque)
      const factura = await uploadEvidence(selectedOrder.id, "factura", photos.factura!)
      uploaded.push(factura)
      toast.loading("Guardando tanqueo y actualizando orden...", { id: toastId })
      const record = await executeFuelOrder({
        orderId: selectedOrder.id,
        date,
        mileage: Number(mileage),
        gallons: Number(gallons),
        invoiceValue: Number(invoiceValue),
        fuelLevel: FUEL_LEVELS[fuelLevelIndex].label,
        fuelLevelPercentage: FUEL_LEVELS[fuelLevelIndex].val,
        notes,
        gps,
        evidence: { tablero, nivel_tanque: nivelTanque, factura },
      })
      const executedOrder: FuelOrder = {
        ...selectedOrder,
        estado: "ejecutada",
        fecha_ejecucion: date,
        galones: record.galones,
        valor_total: record.valor_total,
        kilometraje_actual: record.kilometraje_actual,
        rendimiento_real: record.rendimiento_real,
        alcance_estimado: record.alcance_estimado,
        nivel_tanque: record.nivel_tanque,
        alerta_rendimiento: record.alerta_rendimiento,
      }
      const storedPhotos = [
        { id: tablero.path, order_id: selectedOrder.id, record_id: record.id, tipo: "tablero", photo_url: tablero.url, storage_path: tablero.path },
        { id: nivelTanque.path, order_id: selectedOrder.id, record_id: record.id, tipo: "nivel_tanque", photo_url: nivelTanque.url, storage_path: nivelTanque.path },
        { id: factura.path, order_id: selectedOrder.id, record_id: record.id, tipo: "factura", photo_url: factura.url, storage_path: factura.path },
      ] as OrderPhoto[]
      setReceipt({ record, order: executedOrder, photos: storedPhotos })
      setSelectedOrder(null)
      await loadData()
      toast.success("Tanqueo registrado y orden ejecutada.", { id: toastId })
    } catch (requestError: any) {
      await removeEvidence(uploaded.map((item) => item.path))
      console.error(requestError)
      toast.error(requestError.message || "No se pudo registrar el tanqueo.", { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  const printRecord = async (record: FuelRecord) => {
    const order = orders.find((item) => item.id === record.order_id) || record.fuel_orders
    if (!order) return toast.error("No se encontro la orden asociada.")
    const { data } = await supabase.from("order_photos").select("*").eq("order_id", record.order_id)
    printFuelOrder({ ...order, estado: "ejecutada", ...record }, settings, (data || []) as OrderPhoto[])
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {!stationSchemaReady && <SchemaUpdateAlert />}
      <div className="grid gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground uppercase">Operario activo</p><p className="font-bold">{user?.full_name}</p></CardContent></Card>
      </div>

      {!selectedOrder ? (
        <>
          <Card>
            <CardHeader><CardTitle className="flex gap-2"><Clock className="w-5 h-5 text-amber-500" /> Mis ordenes asignadas</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!activeOrders.length ? <p className="p-8 text-center text-muted-foreground">No tienes ordenes pendientes ni vencidas.</p> : activeOrders.map((order) => (
                <button key={order.id} onClick={() => selectOrder(order)} className="flex w-full flex-col items-start justify-between gap-2 border-t p-4 text-left hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-3">
                  <div><strong className="font-mono">{order.num}</strong><p className="text-xs text-muted-foreground">{order.vehicles?.placa} | {order.station?.nombre || "Sin estacion"} | vence {formatDate(order.fecha_vencimiento)}</p></div>
                  <div className="flex items-center gap-2"><Badge variant={order.estado === "vencida" ? "destructive" : "secondary"}>{order.estado}</Badge><ChevronRight className="w-4 h-4" /></div>
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex gap-2"><CheckCircle className="w-5 h-5 text-emerald-500" /> Ultimos registros</CardTitle></CardHeader>
            <CardContent className="p-0">
              {!recentRecords.length ? <p className="p-8 text-center text-muted-foreground">Aun no hay tanqueos registrados.</p> : recentRecords.map((record) => (
                <div key={record.id} className="flex items-start justify-between gap-3 border-t p-4 sm:items-center">
                  <div className="min-w-0"><strong>{record.vehicles?.placa}</strong><p className="text-xs text-muted-foreground">{formatDate(record.fecha)} | {formatNumber(record.galones)} gal | {formatCurrency(record.valor_total)}</p></div>
                  <Button variant="outline" size="icon" onClick={() => printRecord(record)}><Printer className="w-4 h-4" /></Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader className="border-b"><CardTitle className="flex items-center gap-2 text-sm sm:text-base"><Button variant="ghost" size="icon" className="shrink-0" onClick={() => setSelectedOrder(null)}><ArrowLeft className="w-4 h-4" /></Button><span>Registrar tanqueo | {selectedOrder.num}</span></CardTitle></CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="grid gap-2 rounded-lg bg-blue-500/10 p-3 text-sm sm:grid-cols-3 sm:text-center"><div>Moto<strong className="block">{selectedOrder.vehicles?.placa}</strong></div><div>Estacion<strong className="block">{selectedOrder.station?.nombre || "-"}</strong></div><div>Rendimiento esperado<strong className="block">{formatNumber(expectedYield)} km/gal</strong></div></div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Fecha"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
              <Field label="Kilometraje actual"><Input type="number" value={mileage} onChange={(event) => setMileage(event.target.value)} /></Field>
              <Field label="Galones suministrados"><Input type="number" step="0.01" value={gallons} onChange={(event) => setGallons(event.target.value)} placeholder="Ingresa los galones de la factura" /></Field>
              <Field label="Valor total de la factura"><Input type="number" value={invoiceValue} onChange={(event) => setInvoiceValue(event.target.value)} placeholder="Ingresa el valor pagado" /></Field>
            </div>
            <Field label="Observaciones"><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
            <div className="rounded-lg border p-3 text-sm"><Gauge className="inline w-4 h-4 mr-1" /> Alcance estimado: <strong>{formatNumber(projectedRange)} km</strong> | Rendimiento real: <strong>{calculatedYield === null ? "sin historial previo" : `${formatNumber(calculatedYield)} km/gal`}</strong></div>
            <div className="space-y-2"><Label>GPS</Label><div className="flex flex-col gap-2 sm:flex-row"><Input readOnly value={gps ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)} (+/- ${Math.round(gps.accuracy)} m)` : gpsStatus === "searching" ? "Buscando ubicacion..." : gpsStatus === "error" ? "Error de ubicacion" : "Sin ubicacion"} /><Button type="button" variant="outline" onClick={captureGps} disabled={gpsStatus === "searching"}><MapPin className="w-4 h-4 mr-1" /> Capturar</Button></div></div>
            <div className="space-y-2"><Label>Evidencias fotograficas</Label><div className="grid gap-3 sm:grid-cols-3">{(Object.keys(photos) as PhotoType[]).map((type) => (
              <div key={type} className="space-y-2 rounded-lg border p-2">
                <input ref={cameraRefs[type]} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => readPhoto(type, event.target.files?.[0])} />
                <input ref={galleryRefs[type]} type="file" accept="image/*" className="hidden" onChange={(event) => readPhoto(type, event.target.files?.[0])} />
                {photos[type] ? <div className="relative aspect-square overflow-hidden rounded-lg border"><img src={photos[type]!} alt={PHOTO_LABELS[type]} className="w-full h-full object-cover" /><button type="button" onClick={() => setPhotos((value) => ({ ...value, [type]: null }))} className="absolute right-1 top-1 rounded-full bg-red-600 p-1 text-white"><X className="w-3 h-3" /></button></div> : <div className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed text-center text-xs text-muted-foreground">{PHOTO_LABELS[type]}</div>}
                <div className="grid grid-cols-2 gap-1">
                  <Button type="button" size="sm" variant="outline" className="h-auto px-1 py-2 text-[10px]" onClick={() => cameraRefs[type].current?.click()}><Camera className="mr-1 h-3 w-3" /> Tomar foto</Button>
                  <Button type="button" size="sm" variant="outline" className="h-auto px-1 py-2 text-[10px]" onClick={() => galleryRefs[type].current?.click()}><Upload className="mr-1 h-3 w-3" /> Subir imagen</Button>
                </div>
              </div>
            ))}</div></div>
            <div className="space-y-2">
              <Label>Nivel del tanque despues del suministro</Label>
              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="flex justify-center"><FuelGauge percentage={fuelLevelIndex === null ? 0 : FUEL_LEVELS[fuelLevelIndex].val} /></div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{FUEL_LEVELS.map((level, index) => <button type="button" key={level.label} onClick={() => setFuelLevelIndex(index)} className={`rounded-lg border bg-white p-3 text-xs ${fuelLevelIndex === index ? `${level.border} font-bold shadow-sm` : ""}`}>{level.label}</button>)}</div>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => setSelectedOrder(null)} className="w-full"><ArrowLeft className="w-4 h-4 mr-2" /> Volver a mis ordenes</Button>
            <Button onClick={openReview} className="w-full bg-emerald-600 hover:bg-emerald-700"><CheckCircle className="w-4 h-4 mr-2" /> Revisar antes de guardar</Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={showReview} onOpenChange={setShowReview}><DialogContent><DialogHeader><DialogTitle>Revision del tanqueo</DialogTitle><DialogDescription>Verifica los datos antes de confirmar el registro.</DialogDescription></DialogHeader><div className="space-y-2 text-sm"><p>Orden: <strong>{selectedOrder?.num}</strong></p><p>Estacion: <strong>{selectedOrder?.station?.nombre || "-"}</strong></p><p>KM: <strong>{formatNumber(Number(mileage))}</strong></p><p>Galones: <strong>{formatNumber(Number(gallons))}</strong></p><p>Factura: <strong>{formatCurrency(Number(invoiceValue))}</strong></p><p>Nivel: <strong>{fuelLevelIndex !== null ? FUEL_LEVELS[fuelLevelIndex].label : ""}</strong></p><p className="text-emerald-600"><Camera className="inline w-4 h-4 mr-1" /> Tres evidencias listas y GPS capturado.</p>{calculatedYield !== null && calculatedYield < expectedYield * (1 - (settings?.alert_pct || 20) / 100) && <p className="text-red-600"><AlertTriangle className="inline w-4 h-4 mr-1" /> Se generara alerta por bajo rendimiento.</p>}<div className="flex flex-col gap-2 pt-3 sm:flex-row"><Button variant="outline" onClick={() => setShowReview(false)} className="flex-1">Corregir</Button><Button onClick={confirm} disabled={isSaving} className="flex-1 bg-emerald-600">{isSaving ? "Guardando..." : "Confirmar"}</Button></div></div></DialogContent></Dialog>
      <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && setReceipt(null)}><DialogContent><DialogHeader><DialogTitle className="text-emerald-600">Tanqueo registrado</DialogTitle><DialogDescription>El tanqueo fue guardado correctamente y el comprobante esta disponible.</DialogDescription></DialogHeader>{receipt && <div className="space-y-3 text-sm"><p>La orden <strong>{receipt.order.num}</strong> quedo ejecutada correctamente.</p><p>{formatNumber(receipt.record.galones)} gal | {formatCurrency(receipt.record.valor_total)} | alcance {formatNumber(receipt.record.alcance_estimado)} km</p><div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><Button onClick={() => printFuelOrder(receipt.order, settings, receipt.photos)}><Printer className="w-4 h-4 mr-1" /> Imprimir</Button><Button variant="outline" onClick={() => downloadFuelOrderPdf(receipt.order, settings).catch((error) => toast.error(error.message))}><Download className="w-4 h-4 mr-1" /> Descargar PDF</Button><Button variant="outline" onClick={() => setReceipt(null)}>Cerrar</Button></div></div>}</DialogContent></Dialog>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>
}
