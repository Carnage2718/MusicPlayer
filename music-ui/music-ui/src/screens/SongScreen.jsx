import { useEffect, useState } from "react"
import AppHeader from "../components/AppHeader"
import SongCard from "../components/SongCard"
import GenreEditor from "../components/GenreEditor"
import PlaylistEditor from "../components/PlaylistEditor"
import { authfetch } from "../api"

import "./SongScreen.css"

export default function SongScreen({
  song,
  embedded = false,
  onOpenAlbum,
  onOpenPlaylist
}) {

  const [showGenreEditor,setShowGenreEditor] = useState(false)
  const [showPlaylistEditor,setShowPlaylistEditor] = useState(false)
  const [data,setData] = useState(null)
  const [loading, setLoading] = useState(true)


  const load = async()=>{

    if(!song?.id){
      return
    }

    try{

      setLoading(true)

      const res =
        await authfetch(`/songs/${song.id}/screen`)

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

  return (

    <div className={`song-screen ${embedded ? "embedded" : ""}`}>

      {embedded ? (

        <div className="song-grab-wrapper">
          <div className="grab-bar"/>
        </div>

      ) : (

        <AppHeader title={data?.title || "Song"}/>

      )}

      <div className="song-content">

        {/* SONG */}

        <SongCard
          song={data || song}
          showMenu={false}
        />

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
              className="song-link"
              onClick={() => onOpenAlbum?.(data.album)}
            >
              {data.album.name}
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
                onClick={() => onOpenPlaylist?.(p)}
              >

                <img
                  src={p.image}
                  alt={p.name}
                />

                <span>{p.name}</span>

              </div>

            ))}

          </div>

        </div>

        {showGenreEditor && (
          <GenreEditor
            songId={song.id}
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