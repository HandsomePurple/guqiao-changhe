import { useMemo } from 'react'

export default function AmbientSpots() {
  const spots = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      id: i,
      left: 5 + Math.random() * 90,
      top: 5 + Math.random() * 90,
      size: 3 + Math.random() * 8,
      duration: 8 + Math.random() * 14,
      delay: Math.random() * 10,
    }))
  }, [])

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {spots.map(spot => (
        <div
          key={spot.id}
          style={{
            position: 'absolute',
            left: `${spot.left}%`,
            top: `${spot.top}%`,
            width: spot.size,
            height: spot.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(211,184,133,0.5) 0%, rgba(211,184,133,0) 70%)',
            animation: `ambientSpotFloat ${spot.duration}s ease-in-out ${spot.delay}s infinite, ambientSpotGlow ${spot.duration * 0.7}s ease-in-out ${spot.delay * 0.6}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
