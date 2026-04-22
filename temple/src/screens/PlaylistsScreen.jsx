import { useEffect, useState } from "react"
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

        {playlists.map(pl=>(
          <PlaylistCard
            key={pl.id}
            playlist={pl}
            onOpenPlaylist={onOpenPlaylist}

          />
        ))}

      </div>

    </div>
  )
}