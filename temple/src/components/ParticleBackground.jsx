import { useEffect, useRef } from "react"

export default function ParticleBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    const app = document.querySelector(".app-container")

    let width, height, centerX, centerY

    function resize() {
      width = canvas.width = app.clientWidth
      height = canvas.height = app.clientHeight

      centerX = width / 2
      centerY = height / 2
    }

    resize()

    const BASE_RADIUS = 80
    const MAX_RADIUS = 300
    const PARTICLE_COUNT = 500

    const particles = Array.from({ length: PARTICLE_COUNT }).map(() => ({
      angle: Math.random() * Math.PI * 2,
      radius: BASE_RADIUS + Math.random() * 20,
      speed: Math.random() * 1 + 0.4,
      size: Math.random() * 1.5 + 0.5
    }))

    function animate() {
      ctx.clearRect(0, 0, width, height)

      particles.forEach(p => {
        p.radius += p.speed

        if (p.radius > MAX_RADIUS) {
          p.radius = BASE_RADIUS
          p.angle = Math.random() * Math.PI * 2
        }

        const x = centerX + Math.cos(p.angle) * p.radius
        const y = centerY + Math.sin(p.angle) * p.radius

        const ratio = (p.radius - BASE_RADIUS) / (MAX_RADIUS - BASE_RADIUS)

        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(29,185,84,${0.6 - ratio})`
        ctx.fill()
      })

      requestAnimationFrame(animate)
    }

    animate()

    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none"
      }}
    />
  )
}