import { useEffect } from "react"
import { authfetch } from "../api"
import "./MenuComponent.css"

export default function SongMenu({
  song,
  position,
  onClose,
  onOpenSong,
  onCreatePlaylist
}) {

  const x = Math.min(position.x, window.innerWidth - 180)
  const y = Math.min(position.y, window.innerHeight - 200)

  useEffect(() => {

    const close = () => onClose()

    window.addEventListener("scroll", close)
    window.addEventListener("wheel", close)
    window.addEventListener("touchmove", close, {passive:true})

    return () => {
      window.removeEventListener("scroll", close)
      window.removeEventListener("wheel", close)
      window.removeEventListener("touchmove", close)
    }

  }, [])


  const addQueue = async () => {
    const res = await authfetch(`/queue/add?song_id=${song.id}`, { 
      method:"POST" 
    })

    const data = await res.json()

    window.dispatchEvent(new CustomEvent("queueApply", {detail:data}))
    
    onClose()
  }

  const addNext = async () => {
    const res = await authfetch(`/queue/add_next?song_id=${song.id}`, { 
      method:"POST" 
    })

    const data = await res.json()

    window.dispatchEvent(new CustomEvent("queueApply", {detail:data}))
    onClose()
  }

  return (
    <div className="menu-layer" onClick={onClose}>

      <div
        className="context-menu"
        style={{ top: y, left: x }}
        onClick={(e)=>e.stopPropagation()}
      >
        <div
          onClick={()=>{
            onOpenSong?.(song)
            onClose()
          }}
        >
          Open Song
        </div>

        <div onClick={addNext}>
          Next Play
        </div>

        <div onClick={addQueue}>
          Add Queue
        </div>
      </div>

    </div>
  )
}