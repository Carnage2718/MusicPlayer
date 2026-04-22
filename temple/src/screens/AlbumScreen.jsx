import { useEffect, useState } from "react"
import { Play, Shuffle } from "lucide-react"
import API_BASE from "../api"
import "./AlbumScreen.css"

export default function AlbumScreen({
  album,
  onSelectSong,
  onOpenArtist
}){

  const [songs,setSongs] = useState([])
  const [loading,setLoading] = useState(true)

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

  /* =========================
     PLAY ALL
  ========================= */

  const playAll = ()=>{
    if(songs.length > 0){
      onSelectSong(songs[0])
    }
  }

  /* =========================
     SHUFFLE
  ========================= */

  const shufflePlay = ()=>{
    if(songs.length === 0) return

    const random = songs[Math.floor(Math.random()*songs.length)]
    onSelectSong(random)
  }

  /* =========================
     UI
  ========================= */

  return(

    <div className="screen album-screen">

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

          <div
            className="album-artist"
            onClick={()=>onOpenArtist && onOpenArtist(album.artist)}
          >
            {album?.artist}
          </div>

          <div className="album-info">
            {songs.length} Songs
          </div>

        </div>

      </div>

      {/* CONTROLS */}

      <div className="album-controls">

        <button className="album-play" onClick={playAll}>
          <Play size={18}/>
          Play
        </button>

        <button className="album-shuffle" onClick={shufflePlay}>
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

                <div className="track-title">
                  {song.title}
                </div>

                <div
                  className="track-artist"
                  onClick={(e)=>{
                    e.stopPropagation()
                    onOpenArtist && onOpenArtist({
                      id: album.artist_id,
                      name: album.artist
                    })
                  }}
                >
                  {song.artist?.[0] || song.artist}
                </div>

              </div>

            </div>

          ))}

        </div>
      )}

    </div>
  )
}