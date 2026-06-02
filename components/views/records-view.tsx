"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { saveAs } from "file-saver"
import { Download, Eye, MapPin, Printer, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { loadFuelRecords } from "@/lib/fuel-service"
import { formatCurrency, formatDate, formatNumber, formatPhotoType } from "@/lib/fuel-utils"
import { downloadFuelOrderPdf, printFuelOrder } from "@/lib/order-print"
import { removeEvidence } from "@/lib/storage"
import { supabase } from "@/lib/supabase"
import { hasStationSchema } from "@/lib/schema-capabilities"
import type { CompanySettings, FuelOrder, FuelRecord, OrderPhoto } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { SchemaUpdateAlert } from "@/components/ui/schema-update-alert"

export function RecordsView({ operatorId, allowDelete = false, embedded = false }: { operatorId?: string; allowDelete?: boolean; embedded?: boolean }) {
  const [records, setRecords] = useState<FuelRecord[]>([])
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [selected, setSelected] = useState<FuelRecord | null>(null)
  const [search, setSearch] = useState("")
  const [exporting, setExporting] = useState(false)
  const [stationSchemaReady, setStationSchemaReady] = useState(true)

  const load = useCallback(async () => {
    try {
      const hasStations = await hasStationSchema()
      setStationSchemaReady(hasStations)
      const [loadedRecords, settingsResult] = await Promise.all([
        loadFuelRecords(operatorId, { stationSchemaReady: hasStations }),
        supabase.from("company_settings").select("*").limit(1).maybeSingle(),
      ])
      if (settingsResult.error) throw settingsResult.error
      setRecords(loadedRecords)
      setSettings(settingsResult.data as CompanySettings | null)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "No fue posible cargar los registros.")
    }
  }, [operatorId])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => records.filter((record) => {
    const value = search.toLowerCase()
    return (record.profiles?.full_name || "").toLowerCase().includes(value)
      || (record.vehicles?.placa || "").toLowerCase().includes(value)
      || (record.vehicles?.marca || "").toLowerCase().includes(value)
      || (record.fuel_orders?.num || "").toLowerCase().includes(value)
      || (record.station?.nombre || "").toLowerCase().includes(value)
  }), [records, search])

  const orderFor = (record: FuelRecord): FuelOrder | null => record.fuel_orders ? {
    ...record.fuel_orders,
    profiles: record.profiles,
    vehicles: record.vehicles,
    despachador: record.despachador,
    station: record.station,
    order_photos: record.order_photos,
  } : null

  const deleteRecord = async (record: FuelRecord) => {
    if (!confirm(`Eliminar el registro de la orden ${record.fuel_orders?.num}?`)) return
    const { data, error } = await supabase.rpc("delete_fuel_record", { p_record_id: record.id })
    if (error) return toast.error(error.message)
    await removeEvidence((data || []) as string[])
    toast.success("Registro eliminado y orden cerrada.")
    setSelected(null)
    await load()
  }

  const openDetail = async (record: FuelRecord) => {
    const { data, error } = await supabase.from("order_photos").select("*").eq("order_id", record.order_id)
    if (error) return toast.error(error.message)
    setSelected({ ...record, order_photos: (data || []) as OrderPhoto[] })
  }

  const exportExcel = async () => {
    if (!filtered.length) return toast.error("No hay registros para exportar.")
    setExporting(true)
    const toastId = toast.loading("Generando Excel...")
    try {
      const orderIds = filtered.map((record) => record.order_id)
      const [{ default: ExcelJS }, photosResult] = await Promise.all([
        import("exceljs"),
        supabase.from("order_photos").select("order_id, tipo, photo_url").in("order_id", orderIds),
      ])
      if (photosResult.error) throw photosResult.error
      const photosByOrder = new Map<string, Record<string, string>>()
      for (const photo of photosResult.data || []) {
        const photos = photosByOrder.get(photo.order_id) || {}
        photos[photo.tipo] = photo.photo_url
        photosByOrder.set(photo.order_id, photos)
      }
      const workbook = new ExcelJS.Workbook()
      workbook.creator = "ASUCAP Control de Tanqueo"
      const sheet = workbook.addWorksheet("Tanqueos")
      const columns: Array<[string, string, number]> = [
        ["Numero orden", "order", 18], ["Fecha", "date", 13], ["Operario", "operator", 24],
        ["Cedula", "cedula", 16], ["Moto placa", "plate", 14], ["Marca", "brand", 14], ["Modelo", "model", 16], ["Estacion", "station", 24],
        ["Kilometros", "mileage", 14], ["Galones", "gallons", 12], ["Valor COP", "value", 16], ["Nivel tanque", "level", 18],
        ["Rendimiento real", "realYield", 18], ["Rendimiento esperado", "expectedYield", 22], ["Alcance estimado", "range", 18],
        ["Alerta rendimiento", "alert", 18], ["Despachador", "dispatcher", 22], ["Observaciones", "notes", 30],
        ["Latitud", "lat", 15], ["Longitud", "lng", 15], ["Precision GPS", "accuracy", 15], ["Mapa", "maps", 42],
        ["Foto tablero", "dashboard", 48], ["Foto nivel del tanque", "tankLevelPhoto", 48], ["Foto factura", "invoice", 48], ["Fecha y hora", "timestamp", 22],
      ]
      sheet.columns = columns.map(([header, key, width]) => ({ header, key, width }))
      for (const key of ["mileage", "gallons", "value", "realYield", "expectedYield", "range"]) sheet.getColumn(key).numFmt = "#,##0.##"
      sheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } }
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A56DB" } }
      })
      filtered.forEach((record) => {
        const photos = photosByOrder.get(record.order_id) || {}
        sheet.addRow({
          order: record.fuel_orders?.num, date: record.fecha, operator: record.profiles?.full_name,
          cedula: record.profiles?.cedula, plate: record.vehicles?.placa, brand: record.vehicles?.marca, model: record.vehicles?.modelo,
          station: record.station?.nombre,
          mileage: record.kilometraje_actual, gallons: record.galones, value: record.valor_total, level: record.nivel_tanque,
          realYield: record.rendimiento_real ?? "-", expectedYield: record.rendimiento_esperado, range: record.alcance_estimado,
          alert: record.alerta_rendimiento ? "ALERTA" : "OK", dispatcher: record.despachador?.full_name, notes: record.observaciones,
          lat: record.gps_lat, lng: record.gps_lng, accuracy: record.gps_precision, maps: record.gps_maps_url,
          dashboard: photos.tablero, tankLevelPhoto: photos.nivel_tanque, invoice: photos.factura, timestamp: record.created_at,
        })
      })
      sheet.views = [{ state: "frozen", ySplit: 1 }]
      const buffer = await workbook.xlsx.writeBuffer()
      saveAs(new Blob([buffer]), `tanqueos-${new Date().toISOString().split("T")[0]}.xlsx`)
      toast.success("Excel descargado.", { id: toastId })
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "No fue posible generar el Excel.", { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-3">
      {!embedded && !stationSchemaReady && <SchemaUpdateAlert />}
      <Card>
      <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle>Registros de tanqueo</CardTitle>
        <div className="flex flex-wrap gap-2">
          <div className="relative"><Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar operario, placa, orden o estacion" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <Button onClick={exportExcel} disabled={exporting} className="bg-emerald-600 hover:bg-emerald-700"><Download className="w-4 h-4 mr-1" /> Excel</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="border-t text-left"><th className="p-3">Orden</th><th className="p-3">Fecha</th><th className="p-3">Operario</th><th className="p-3">Moto</th><th className="p-3">Estacion</th><th className="p-3">Galones</th><th className="p-3">Valor</th><th className="p-3">Rendimiento</th><th className="p-3"></th></tr></thead><tbody>
          {!filtered.length ? <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No hay registros para mostrar.</td></tr> : filtered.map((record) => <tr key={record.id} className="border-t"><td className="p-3 font-mono">{record.fuel_orders?.num}</td><td className="p-3">{formatDate(record.fecha)}</td><td className="p-3">{record.profiles?.full_name}</td><td className="p-3">{record.vehicles?.placa}</td><td className="p-3">{record.station?.nombre || "-"}</td><td className="p-3">{formatNumber(record.galones)}</td><td className="p-3">{formatCurrency(record.valor_total)}</td><td className="p-3">{formatNumber(record.rendimiento_real)} {record.alerta_rendimiento && <Badge variant="destructive">alerta</Badge>}</td><td className="p-3"><Button variant="ghost" size="icon" onClick={() => openDetail(record)}><Eye className="w-4 h-4" /></Button></td></tr>)}
        </tbody></table>
      </CardContent>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Detalle de tanqueo</DialogTitle><DialogDescription>Consulta los datos, evidencias y comprobante del tanqueo.</DialogDescription></DialogHeader>{selected && <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2"><p>Orden: <strong>{selected.fuel_orders?.num}</strong></p><p>Fecha: <strong>{formatDate(selected.fecha)}</strong></p><p>Operario: <strong>{selected.profiles?.full_name}</strong></p><p>Cedula: <strong>{selected.profiles?.cedula || "-"}</strong></p><p>Moto: <strong>{selected.vehicles?.placa}</strong></p><p>Marca: <strong>{selected.vehicles?.marca}</strong></p><p>Estacion: <strong>{selected.station?.nombre || "-"}</strong></p><p>KM: <strong>{formatNumber(selected.kilometraje_actual)}</strong></p><p>Galones: <strong>{formatNumber(selected.galones)}</strong></p><p>Valor: <strong>{formatCurrency(selected.valor_total)}</strong></p><p>Nivel: <strong>{selected.nivel_tanque}</strong></p><p>Rendimiento: <strong>{formatNumber(selected.rendimiento_real)} km/gal</strong></p><p>Alcance: <strong>{formatNumber(selected.alcance_estimado)} km</strong></p></div>
        {selected.observaciones && <p className="rounded-md bg-muted p-2">{selected.observaciones}</p>}
        {selected.gps_maps_url && <a href={selected.gps_maps_url} target="_blank" rel="noreferrer" className="flex gap-1 text-blue-500 underline"><MapPin className="w-4 h-4" /> Abrir ubicacion en Google Maps</a>}
        <div className="grid grid-cols-3 gap-2">{(selected.order_photos || []).map((photo) => <a href={photo.photo_url} target="_blank" rel="noreferrer" key={photo.id}><img src={photo.photo_url} alt={formatPhotoType(photo.tipo)} className="aspect-square w-full rounded-md object-cover" onError={(event) => { event.currentTarget.style.display = "none" }} /><small className="block text-center uppercase">{formatPhotoType(photo.tipo)}</small></a>)}</div>
        <div className="flex flex-wrap gap-2 border-t pt-3">{orderFor(selected) && <><Button variant="outline" onClick={() => printFuelOrder(orderFor(selected)!, settings, selected.order_photos)}><Printer className="w-4 h-4 mr-1" /> Imprimir</Button><Button variant="outline" onClick={() => downloadFuelOrderPdf(orderFor(selected)!, settings).catch((error) => toast.error(error.message))}><Download className="w-4 h-4 mr-1" /> Descargar PDF</Button></>}{allowDelete && <Button variant="destructive" onClick={() => deleteRecord(selected)}><Trash2 className="w-4 h-4 mr-1" /> Eliminar</Button>}</div>
      </div>}</DialogContent></Dialog>
      </Card>
    </div>
  )
}
