import { useState, useEffect } from "react"
import API_BASE from "../api"
import "./MenuComponent.css"

export default function SongMenu({
  song,
  position,
  onClose,
  onOpenAlbum,
  onCreatePlaylist
}) {

  const [showPlaylists, setShowPlaylists] = useState(false)
  const [includedPlaylists, setIncludedPlaylists] = useState([])
  const [playlists, setPlaylists] = useState([])
  const [album, setAlbum] = useState(null)

  const loadPlaylists = async () => {
    const res = await fetch(`${API_BASE}/playlists`)
    const data = await res.json()
    setPlaylists(data)
  }

  const loadAlbum = async () => {

    try {
      const res = await fetch(`${API_BASE}/songs/${song.id}`)
      const data = await res.json()

      setAlbum({
        id: data.album_id,
        name: data.album_name
      })

    } catch (e) {
      console.error(e)
    }

  }

  useEffect(() => {
    if (!song?.id) return
    loadAlbum()
  }, [song])

  useEffect(() => {

    const close = () => onClose()

    window.addEventListener("scroll", close)
    window.addEventListener("wheel", close)
    window.addEventListener("touchmove", close)

    return () => {
      window.removeEventListener("scroll", close)
      window.removeEventListener("wheel", close)
      window.removeEventListener("touchmove", close)
    }

  }, [])


  const addQueue = async () => {
    await fetch(`${API_BASE}/queue/add?song_id=${song.id}`, { method:"POST" })
    onClose()
  }

  const addNext = async () => {
    await fetch(`${API_BASE}/queue/add_next?song_id=${song.id}`, { method:"POST" })
    onClose()
  }

  const loadIncludedPlaylists = async () => {
    try {
      const res = await fetch(`${API_BASE}/songs/${song.id}/playlists`)
      const data = await res.json()
      setIncludedPlaylists(data.map(p => p.id))
    } catch (e) {
      console.error(e)
    }
  }

  const handleOpenPlaylists = async () => {

    if (showPlaylists) {
      setShowPlaylists(false)
      return
    }

    setShowPlaylists(true)

    if (playlists.length === 0) {
      await loadPlaylists()
    }

    await loadIncludedPlaylists() // 🔥 追加
  }

  const togglePlaylist = async (playlistId) => {

    const isAdded = includedPlaylists.includes(playlistId)

    try {

      if (isAdded) {
        // 🔥 削除
        await fetch(`${API_BASE}/playlists/${playlistId}/remove?song_id=${song.id}`, {
          method: "DELETE"
        })

        setIncludedPlaylists(prev =>
          prev.filter(id => id !== playlistId)
        )

      } else {
        // 🔥 追加
        await fetch(`${API_BASE}/playlists/${playlistId}/add?song_id=${song.id}`, {
          method: "POST"
        })

        setIncludedPlaylists(prev => [...prev, playlistId])
      }

    } catch (e) {
      console.error(e)
    }
  }

  const handleCreate = () => {
    onCreatePlaylist(song) // 🔥 曲渡す
    onClose()
  }

  const x = Math.min(position.x, window.innerWidth - 180)
  const y = Math.min(position.y, window.innerHeight - 200)

  return (
    <div className="menu-layer" onClick={onClose}>

      <div
        className="context-menu"
        style={{ top: y, left: x }}
        onClick={(e)=>e.stopPropagation()}
      >

        <div onClick={addQueue}>Add Queue</div>
        <div onClick={addNext}>Next Play</div>
        <div onClick={handleOpenPlaylists}>
          Add Playlist
        </div>

        {showPlaylists && (
          <div 
            className="playlist-submenu"
            onClick={(e)=>e.stopPropagation()}
          >
            <div className="playlist-create" onClick={handleCreate}>
              + Create
            </div>

            <div className="playlist-list">
              {playlists.map(p => {

                const added = includedPlaylists.includes(p.id)

                return (
                  <div
                    key={p.id}
                    className="playlist-item"
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePlaylist(p.id)
                    }}
                  >
                    <span>{p.name}</span>

                    {added && (
                      <span className="check">✔</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}        
        
        {album &&(
          <div
            onClick={()=>{
              onOpenAlbum(album)
              onClose()
            }}
          >
            Open {album.name}
          </div>
        )}

      </div>

    </div>
  )
}