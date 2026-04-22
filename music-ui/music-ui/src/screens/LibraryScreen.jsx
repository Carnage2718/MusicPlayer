import { useEffect, useState } from "react"
import API_BASE from "../api"
import SongCard from "../components/SongCard"
import AppHeader from "../components/AppHeader"
import "./LibraryScreen.css"

export default function LibraryScreen({
  onSelectSong,
  openSongs,
  openArtists,
  openAlbums,
  openGenre
}) {

  const [recent, setRecent] = useState([])
  const [favorites, setFavorites] = useState([])

  useEffect(() => {

    /* =========================
       Recently Played
    ========================= */

    fetch(`${API_BASE}/history?limit=8`)
      .then(res => res.json())
      .then(data => setRecent(data))
      .catch(err => console.error("history fetch error", err))


    /* =========================
       Favorites
    ========================= */

    fetch(`${API_BASE}/songs/favorites/1/songs`)
      .then(res => res.json())
      .then(data => setFavorites(data))
      .catch(err => console.error("favorites fetch error", err))

  }, [])


  return (

    <div className="screen">

      <AppHeader title="Library" />


      {/* =========================
         Categories
      ========================= */}

      <div className="library-categories">

        <div
          className="library-item"
          onClick={() => openSongs && openSongs()}
        >
          Songs
        </div>

        <div 
          className="library-item"
          onClick={() => openArtists && openArtists()}>
          Artists
        </div>

        <div 
          className="library-item"
          onClick={() => openAlbums && openAlbums()}
        >
          Albums
        </div>

        <div 
          className="library-item"
          onClick={() => openGenre && openGenre()}>
          Genres
        </div>

        <div className="library-item">
          Favorites
        </div>

      </div>


      {/* =========================
         Recently Played
      ========================= */}

      <div className="library-section">

        <div className="section-title">
          Recently Played
        </div>

        <div className="horizontal-scroll">

          {recent.map(song => (

            <SongCard
              key={`{song.song_id}-${song.played_at}`}
              song={{
                id: song.song_id,
                title: song.title,
                main: song.main,
                ft: song.ft,
                artists: song.artists,
                image: song.image,
                url: song.url
              }}
              onSelectSong={onSelectSong}
            />

          ))}

        </div>

      </div>


      {/* =========================
         Favorites
      ========================= */}

      <div className="library-section">

        <div className="section-title">
          Favorites
        </div>

        <div className="horizontal-scroll">

          {favorites.map(song => (

            <SongCard
              key={song.song_id}
              song={{
                id: song.song_id,
                title: song.title,
                main: song.main,
                ft: song.ft,
                artists: song.artists,
                image: song.image,
                url: song.url
              }}
              onSelectSong={onSelectSong}
            />

          ))}

        </div>

      </div>

    </div>

  )

}