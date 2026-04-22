import { useEffect, useState } from "react"
import { Play, Shuffle } from "lucide-react"
import API_BASE from "../api"
import "./AlbumScreen.css"
import TextScroller from "../components/TextScroller"
import AppHeader from "../components/AppHeader"

export default function AlbumScreen({
  album,
  onSelectSong,
  onOpenArtist
}){

  const [songs,setSongs] = useState([])
  const [loading,setLoading] = useState(true)
  const [isShuffle, setIsShuffle] = useState(true)

  /* =========================
     LOAD ALBUM DETAIL
  ========================= */

  useEffect(()=>{

    if(!album?.id) return

    const load = async()=>{

      try{

        const res = await fetch(`${API_BASE}/albums/${album.id}`)
        const data = await res.json()

        setSongs(data.songs || [])

      }catch(e){
        console.error("album load error",e)
      }finally{
        setLoading(false)
      }

    }

    load()

  },[album])

  const formatArtists = (artists = []) => {
    if (!artists.length) return ""

    const main = artists
      .filter(a => a.role === "main")
      .map(a => a.name)

    const ft = artists
      .filter(a => a.role === "featuring")
      .map(a => a.name)

    if (ft.length > 0) {
      return `${main.join(", ")} ft. ${ft.join(", ")}`
    }

    return main.join(", ")
  }

  /* =========================
     PLAY ALL
  ========================= */

  const playAll = async () => {

    if (!album?.id) return

    await fetch(`${API_BASE}/queue/from_album/${album.id}?shuffle=${isShuffle}`, {
      method: "POST"
    })

    window.dispatchEvent(new Event("queueUpdated"))
  }

  /* =========================
     SHUFFLE
  ========================= */

  const toggleShuffle = () => {
    setIsShuffle(prev => !prev)
  }

  /* =========================
     UI
  ========================= */

  return(

    <div className="screen album-screen">
      
      <AppHeader title={album?.name}/>

      {/* HEADER */}

      <div className="album-header">

        <img
          src={album?.image || "/Mayhem.png"}
          className="album-cover"
        />

        <div className="album-meta">

          <div className="album-name">
            {album?.name}
          </div>

          <div className="album-artist">
            {formatArtists(album?.artists)}
          </div>
          <div className="album-info">
            {songs.length} Songs
          </div>

        </div>

      </div>

      {/* CONTROLS */}

      <div className="album-controls">

        <button 
          className="album-play"
          onClick={playAll}
        >
          <Play size={18}/>
          Play
        </button>

        <button 
          className={`album-shuffle ${isShuffle ? "active" : ""}`}
          onClick={toggleShuffle}
        >
          <Shuffle size={18}/>
          Shuffle
        </button>

      </div>

      {/* LOADING */}

      {loading && (
        <div className="loading">
          Loading...
        </div>
      )}

      {/* TRACKLIST */}

      {!loading && (
        <div className="album-tracks">

          {songs.map((song,index)=>(

            <div
              key={song.id || song.song_id || index}
              className="album-track"
              onClick={()=>onSelectSong(song)}
            >

              <div className="track-number">
                {song.track_number || index+1}
              </div>

              <div className="track-info">

                <TextScroller
                  text={song.title}
                  className="track-title"
                />

                <div className="track-artist">
                  {formatArtists(song.artists)}
                </div>

              </div>

            </div>

          ))}

        </div>
      )}

    </div>
  )
}