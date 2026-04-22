import { useRef, useEffect, useState } from "react"
import API_BASE from "../api"
import PlaylistCard from "../components/PlaylistCard"
import AppHeader from "../components/AppHeader"
import "./PlaylistsScreen.css"

export default function PlaylistsScreen({
  onOpenPlaylist,
  onOpenCreate
}){

  const [playlists,setPlaylists] = useState([])

  useEffect(()=>{
    const load = async()=>{
      const res = await fetch(`${API_BASE}/playlists`)
      const data = await res.json()
      setPlaylists(data)
    }
    load()
  },[])

  const grouped = {}

  playlists.forEach(p=>{
    const letter =
      /^[A-Z]/.test(p.name?.[0]?.toUpperCase())
      ? p.name[0].toUpperCase()
      : "#"

    if(!grouped[letter]) grouped[letter] = []
    grouped[letter].push(p)
  })

  const alphabet = Object.keys(grouped).sort((a,b)=>{
    if(a === "#") return 1
    if(b === "#") return -1
    return a.localeCompare(b)
  })

  const letterRefs = useRef({})

  const jump = (letter) => {
    const el = letterRefs.current[letter]
    if (!el) return

    window.scrollTo({
      top: el.offsetTop - 80,
      behavior: "smooth"
    })
  }

  return(
    <div className="screen">

      {/* ✅ ヘッダーは1つだけ */}
      <AppHeader title="Playlists"/>

      {/* ✅ Albumsと同じ位置にボタン */}
      <div className="playlists-create-wrap">
        <button
          className="playlists-create-btn"
          onClick={onOpenCreate}
        >
          + CREATE PLAYLIST
        </button>
      </div>

      <div className="playlists-grid">

        {alphabet.map(letter=>(
          <div
            key={letter}
            ref={el => letterRefs.current[letter] = el}
          >

            <div className="songs-letter">{letter}</div>

            {grouped[letter].map(pl=>(
              <PlaylistCard
                key={pl.id}
                playlist={pl}
                onOpenPlaylist={onOpenPlaylist}
              />
            ))}

          </div>
        ))}

      </div>

      <div className="alphabet-bar">
        {alphabet.map(l => (
          <div
            key={l}
            className="alphabet-letter"
            onClick={()=>jump(l)}
          >
            {l}
          </div>
        ))}
      </div>

    </div>
  )
}