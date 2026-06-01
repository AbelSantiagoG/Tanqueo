"use client"

interface FuelGaugeProps {
  current: number
  max: number
  percentage: number
}

export function FuelGauge({ current, max, percentage }: FuelGaugeProps) {
  // Calculate the angle for the semi-circular gauge
  // 0% = -90deg (left), 100% = 90deg (right)
  const angle = -90 + (percentage / 100) * 180
  
  // Determine color based on percentage
  const getColor = () => {
    if (percentage < 20) return "text-destructive"
    if (percentage < 40) return "text-warning"
    return "text-success"
  }

  const getGlowColor = () => {
    if (percentage < 20) return "drop-shadow-[0_0_10px_oklch(0.65_0.25_25/0.5)]"
    if (percentage < 40) return "drop-shadow-[0_0_10px_oklch(0.8_0.2_70/0.5)]"
    return "drop-shadow-[0_0_10px_oklch(0.8_0.25_145/0.5)]"
  }

  return (
    <div className="relative w-64 h-32">
      {/* Background arc */}
      <svg
        viewBox="0 0 200 100"
        className="w-full h-full"
        style={{ transform: "rotate(0deg)" }}
      >
        {/* Track */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
          className="text-muted/30"
        />
        
        {/* Gradient Definition */}
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.65 0.25 25)" />
            <stop offset="50%" stopColor="oklch(0.8 0.2 70)" />
            <stop offset="100%" stopColor="oklch(0.8 0.25 145)" />
          </linearGradient>
        </defs>
        
        {/* Filled arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${percentage * 2.51} 251`}
          className={getGlowColor()}
        />
        
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const tickAngle = -180 + (tick / 100) * 180
          const rad = (tickAngle * Math.PI) / 180
          const x1 = 100 + 65 * Math.cos(rad)
          const y1 = 100 + 65 * Math.sin(rad)
          const x2 = 100 + 75 * Math.cos(rad)
          const y2 = 100 + 75 * Math.sin(rad)
          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground/50"
            />
          )
        })}
      </svg>
      
      {/* Center indicator needle */}
      <div
        className="absolute bottom-0 left-1/2 origin-bottom"
        style={{
          transform: `translateX(-50%) rotate(${angle}deg)`,
          transition: "transform 0.5s ease-out",
        }}
      >
        <div className={`w-1 h-16 ${getColor()} ${getGlowColor()}`}>
          <div className="w-full h-full bg-current rounded-t-full" />
        </div>
      </div>
      
      {/* Center dot */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
        <div className={`w-6 h-6 rounded-full bg-card border-4 border-current ${getColor()}`} />
      </div>
      
      {/* Labels */}
      <div className="absolute bottom-0 left-2 text-xs text-muted-foreground font-mono">
        E
      </div>
      <div className="absolute bottom-0 right-2 text-xs text-muted-foreground font-mono">
        F
      </div>
    </div>
  )
}
