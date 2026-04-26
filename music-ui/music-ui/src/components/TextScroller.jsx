import { useRef, useEffect } from "react"
import "./TextScroller.css"

export default function TextScroller({ text, className }) {

  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let isDown = false
    let startX
    let scrollLeft

    const start = (x) => {
      isDown = true
      startX = x
      scrollLeft = el.scrollLeft
    }

    let moved = false

    const move = (x) => {
      if (!isDown) return
      const walk = (startX - x)

      if (Math.abs(walk) > 5) {
        moved = true
      }

      el.scrollLeft = scrollLeft + walk
    }

    const end = () => {
      isDown = false

      if (moved) {
        el.dataset.dragged = "true"
        setTimeout(()=> el.dataset.dragged = "", 0)
      }

      moved = false
    }

    // mouse
    el.addEventListener("mousedown", e => start(e.pageX))
    el.addEventListener("mousemove", e => move(e.pageX))
    el.addEventListener("mouseup", end)
    el.addEventListener("mouseleave", end)

    // touch
    el.addEventListener("touchstart", e => start(e.touches[0].pageX))
    el.addEventListener("touchmove", e => move(e.touches[0].pageX))
    el.addEventListener("touchend", end)

    return () => {}
  }, [])

  return (
    <div className={`text-scroller ${className || ""}`} ref={ref}>
      <div className="text-inner">
        {text}
      </div>
    </div>
  )
}


