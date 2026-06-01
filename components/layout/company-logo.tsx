export function CompanyLogo({ className = "" }: { className?: string }) {
  return <img src="/asucap-logo.png" alt="ASUCAP San Jorge" className={`object-contain ${className}`} />
}
