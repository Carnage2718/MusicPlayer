import { useEffect, useState } from "react"
import { authfetch } from "../api"
import PlaylistCard from "./PlaylistCard"
import "./PlaylistEditor.css"

export default function PlaylistEditor({
  songId,
  includedPlaylists = [],
  onClose,
  onSaved
}){

  const [playlists,setPlaylists] = useState([])
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const includedIds = includedPlaylists.map(p => p.id)
  const availablePlaylists =
    playlists.filter(
      p => !includedIds.includes(p.id)
    )

  useEffect(()=>{

    load()

  },[])

  const load = async()=>{

    try{

      setLoading(true)

      const res =
        await authfetch("/playlists")

      const data =
        await res.json()

      setPlaylists(data)

    }catch(err){

      console.error(err)

    }finally{

      setLoading(false)

    }

  }

  const togglePlaylist = async (playlist)=>{

    if(saving) return

    try{

      setSaving(true)

      await authfetch(
        `/playlists/${playlist.id}/add/one?song_id=${songId}`,
        { method:"POST" }
      )

      onSaved?.()
      onClose?.()

    }catch(err){

      console.error(err)

    }finally{

      setSaving(false)

    }

}

  return(

    <div
      className="playlist-editor-overlay"
      onClick={onClose}
    >

      <div
        className="playlist-editor-modal"
        onClick={e=>e.stopPropagation()}
      >

        <div className="playlist-editor-title">
          Playlists
        </div>

        <div className="playlist-selector">

          {loading ? (

            <div className="playlist-loading">
              loading...
            </div>

          ) : (
            availablePlaylists.map(p => (
              <div
                key={p.id}
                className= "playlist-item"
                onClick={async () => {
                  await togglePlaylist(p)
                }}
              >
                <PlaylistCard playlist={p}/>
              </div>
            ))

          )}

          {!loading && availablePlaylists.length === 0 && (
            <div className="playlist-loading">
              No available playlists
            </div>
          )}
          
        </div>

      </div>

    </div>

  )

}