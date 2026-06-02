export function CompanyLogo({ className = "" }: { className?: string }) {
  return <img src="/asucap-logo.png" alt="ASUCAP San Jorge" className={`max-w-full min-w-0 object-contain ${className}`} />
}
