import { useEffect, useState } from "react"
import AppHeader from "../components/AppHeader"
import SongCard from "../components/SongCard"
import GenreEditor from "../components/GenreEditor"
import PlaylistEditor from "../components/PlaylistEditor"
import { authfetch } from "../api"

import "./SongScreen.css"

export default function SongScreen({
  song,
  tabMode = false,
  onSelectSong,
  onOpenArtist,
  onOpenAlbum,
  onOpenPlaylist,
  onCloseTab,
  onBackToPlayer
}) {

  const [showGenreEditor,setShowGenreEditor] = useState(false)
  const [showPlaylistEditor,setShowPlaylistEditor] = useState(false)
  const [data,setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const songId = song?.id || song?.song_id


  const load = async()=>{

    if(song?.song_id){
      song.id = song?.song_id
    }

    if(!song?.id){
      return
    }

    try{

      setLoading(true)

      const res =
        await authfetch(`/songs/${song?.id}/screen`)

      const json =
        await res.json()

      setData(json)

    }catch(err){

      console.error(err)

    }finally{

      setLoading(false)

    }

  }

  useEffect(()=>{

    load()

  },[song?.id])

  const genres = data?.genres || []
  const playlists = data?.playlists || []

  const formatArtists = (artists = []) => {

    const main = artists
      .filter(a => a.role === "main")
      .map(a => a.name)

    const ft = artists
      .filter(a => a.role === "featuring")
      .map(a => a.name)

    if(ft.length){
      return `${main.join(", ")} ft. ${ft.join(", ")}`
    }

    return main.join(", ")
  }

  const formatDate = (dateString)=>{

    if(!dateString) return null

    const d = new Date(dateString)

    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2,"0")
    const day = String(d.getDate()).padStart(2,"0")

    return `${y}/${m}/${day}`
  }

  const handleSongCardClick = ()=>{

    if(tabMode){

      onBackToPlayer?.()
      return

    }

    onSelectSong?.(data || song)

  }

  const handleOpenArtist = (artist)=>{

    if(tabMode){
      onCloseTab?.()
    }

    onOpenArtist?.(artist)
  }

  return (

    <div className={`song-screen ${tabMode ? "tab-mode" : ""}`}>

      {tabMode ? (

        <div className="song-grab-wrapper">
          <div 
            className="grab-bar"
            onClick={onCloseTab}
          />
        </div>

      ) : (

        <AppHeader title={data?.title || "Song"}/>

      )}

      <div className="song-content">

        {/* SONG */}

        <SongCard
          song={data || song}
          onSelectSong={handleSongCardClick}
          onOpenArtist={handleOpenArtist}
          showMenu={false}
        />

        {data?.release_at && (
          <div className="song-release-date">
            release :
            {formatDate(data.release_at)}
          </div>
        )}

        {/* GENRES */}

        <div className="song-section">

          <div className="song-section-header">

            <div className="song-section-title">
              Genres
            </div>

            <button
              className="song-expand"
              onClick={() =>
                setShowGenreEditor(prev => !prev)
              }
            >
              {showGenreEditor ? "−" : "+"}
            </button>
            
          </div>

          {genres.length === 0 ? (

            <div className="song-none">
              None
            </div>

          ) : (

            <div className="genre-list">

              {genres.map(g => (
                <div
                  key={g.id}
                  className="genre-chip"
                >
                  {g.name}
                </div>
              ))}

            </div>

          )}

        </div>

        {/* ALBUM */}

        {data?.album && (

          <div className="song-section">

            <div className="song-section-title">
              Album
            </div>

            <div
              className="songscreen-album-card"
              onClick={() => {

                if(tabMode){
                  onCloseTab?.()
                }

                onOpenAlbum?.(data.album)

              }}
            >
              <img
                src={data.album.image}
                alt={data.album.name}
              />

              <div className="songscreen-album-info">

                <div className="songscreen-album-name">
                  {data.album.name}
                </div>

                <div className="songscreen-album-artist">
                  {formatArtists(data.album.artists)}
                </div>

              </div>

            </div>

          </div>

        )}

        {/* PLAYLISTS */}


        <div className="song-section">

          <div className="song-section-header">

            <div className="song-section-title">
              Playlists
            </div>

            <button
              className="song-expand"
              onClick={() =>
                setShowPlaylistEditor(prev => !prev)
              }
            >
              {showPlaylistEditor ? "−" : "+"}
            </button>

          </div>

          <div className="playlist-list">

            {playlists.map(p => (

              <div
                key={p.id}
                className="playlist-row"
                onClick={() => {

                  if(tabMode){
                    onCloseTab?.()
                  }

                  onOpenPlaylist?.(p)

                }}
              >

                <img
                  src={p.cover_url}
                  alt={p.name}
                />

                <div className="playlist-info">

                  <div className="playlist-name">
                    {p.name}
                  </div>

                  <div className="playlist-count">
                    {p.song_count} songs
                  </div>

                </div>

              </div>
            ))}

          </div>

        </div>

        {showGenreEditor && (
          <GenreEditor
            songId={songId}
            selectedGenres={genres}
            onClose={()=>
              setShowGenreEditor(false)
            }
            onSaved={load}
          />
        )}

        {showPlaylistEditor && (
          <PlaylistEditor
            songId={song.id}
            onClose={()=>
              setShowPlaylistEditor(false)
            }
            onSaved={load}
          />
        )}

        {/* LYRICS */}

        {song.lyrics && (

          <div className="song-section">

            <div className="song-section-title">
              Lyrics
            </div>

            <div className="lyrics-box">
              {song.lyrics}
            </div>

          </div>

        )}

      </div>

    </div>

  )

}