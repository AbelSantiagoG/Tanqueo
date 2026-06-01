import { RecordsView } from "@/components/views/records-view"

export const metadata = {
  title: "Registros - Control de Tanqueo",
  description: "Historial completo de tanqueos",
}

export default function RegistrosPage() {
  return <RecordsView allowDelete />
}
