import { useState } from "react"
import { Play, GripVertical } from "lucide-react"
import AppHeader from "../components/AppHeader"
import "./PlaylistScreen.css"
import SongCard from "../components/SongCard"

export default function PlaylistScreen({
  playlist,
  onSelectSong,
  onOpenArtist
}){

  const [tracks,setTracks] = useState(playlist?.songs || [])

  if(!playlist) return null

  /* =========================
     PLAY ALL
  ========================= */

  const playAll = ()=>{
    if(tracks.length > 0){
      onSelectSong(tracks[0], tracks)
    }
  }

  /* =========================
     REORDER（簡易）
  ========================= */

  const moveTrack = (from, to)=>{
    const updated = [...tracks]
    const [moved] = updated.splice(from,1)
    updated.splice(to,0,moved)
    setTracks(updated)
  }

  return(
    <div className="screen">

      <AppHeader title="Playlist"/>

      {/* =========================
         HERO
      ========================= */}
      <div className="playlist-hero">

        <div className="playlist-cover-wrap">
          {playlist.cover_url ? (
            <img src={playlist.cover_url}/>
          ) : (
            <div className="playlist-cover-placeholder"/>
          )}
        </div>

        <div className="playlist-meta">

          <div className="playlist-name">
            {playlist.name}
          </div>

          <div className="playlist-desc">
            {playlist.description || "No description"}
          </div>

          <div className="playlist-count">
            {tracks.length} songs
          </div>

          <button
            className="playlist-play-btn"
            onClick={playAll}
          >
            <Play size={16}/> PLAY
          </button>

        </div>

      </div>

      {/* =========================
         TRACK LIST
      ========================= */}

      <div className="playlist-tracks">

        {tracks.map((t,i)=>(
          <div key={t.id} className="playlist-track">

            {/* 番号 */}
            <div className="track-number">
              {i+1}
            </div>

            {/* SongCard */}
            <div className="track-main">

              <SongCard
                song={{
                  id: t.id,
                  title: t.title,
                  main: t.main,
                  ft: t.ft,
                  artists: t.artists,
                  image: t.image,
                  url: t.url
                }}
                onSelectSong={()=>onSelectSong(t, tracks)}
                onOpenArtist={onOpenArtist}
              />

            </div>

            {/* 右固定 */}
            <div className="track-actions">
              <GripVertical
                className="drag"
                onClick={()=>moveTrack(i, i-1)}
              />
            </div>

          </div>
        ))}

      </div>

    </div>
  )
}