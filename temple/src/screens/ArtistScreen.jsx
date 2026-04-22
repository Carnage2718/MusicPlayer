import { useEffect, useState } from "react"
import "./ArtistScreen.css"
import AppHeader from "../components/AppHeader"
import API_BASE from "../api"
import { Music } from"lucide-react"
import ArtistLinks from "../components/ArtistLinks"
import SongCard from "../components/SongCard"

export default function ArtistScreen({ 
  artistId, 
  onSelectSong, 
  onOpenArtist 
}) {

  const [artist, setArtist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  /* =========================
     LOAD ARTIST
  ========================= */

  useEffect(() => {

    const loadArtist = async () => {

      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`${API_BASE}/artists/${artistId}`)

        if (!res.ok) {
          throw new Error("API error")
        }

        const data = await res.json()

        console.log("artist data:", data)

        // APIエラー返却対策
        if (data.error) {
          throw new Error(data.error)
        }

        setArtist(data)

      } catch (err) {

        console.error("Artist load error:", err)
        setError(err.message)

      } finally {

        setLoading(false)

      }

    }

    if (artistId) {
      loadArtist()
    }

  }, [artistId])


  /* =========================
     LOADING
  ========================= */

  if (loading) {
    return (
      <div className="screen artist-screen">
        <AppHeader title="Artist" />
        <div className="loading">Loading...</div>
      </div>
    )
  }


  /* =========================
     ERROR
  ========================= */

  if (error) {
    return (
      <div className="screen artist-screen">
        <AppHeader title="Artist" />
        <div className="loading">Error: {error}</div>
      </div>
    )
  }


  /* =========================
     NO DATA
  ========================= */

  if (!artist) {
    return (
      <div className="screen artist-screen">
        <AppHeader title="Artist" />
        <div className="loading">Artist not found</div>
      </div>
    )
  }


  /* =========================
     MAIN
  ========================= */

  return (

    <div className="screen artist-screen">

      <AppHeader title="Artist" />

      {/* =========================
         ARTIST HEADER
      ========================= */}

      <div className="artist-header">

        {artist.cover_url ? (
          <img src={artist.cover_url} className="artist-image"/>
        ) : (
          <div className="artist-placeholder">
            <Music 
              size={60} 
              className="artist-icon"
            />
          </div>
        )}

        <div className="artist-name">
          {artist.name}
        </div>

        <div className="artist-plays">
          {artist.total_plays?.toLocaleString?.() || 0} plays
        </div>

        <div className="artist-meta">
          {artist.song_count || 0} songs ・ {artist.album_count || 0} albums
        </div>

      </div>


      {/* =========================
         TOP SONGS
      ========================= */}

      <div className="artist-section">

        <div className="section-title">
          Top Songs
        </div>

        {artist.top_songs?.map(song=>(
          <SongCard
            key={song.song_id}
            song={{
              id: song.song_id,
              title: song.title,
              main: song.main,
              ft: song.ft,
              artists: song.artists,
              artist_id: song.artist_id,
              image: song.cover_url,
              url: song.url
            }}
            onSelectSong={onSelectSong}
            onOpenArtist={onOpenArtist}
          />
        ))}

      </div>


      {/* =========================
         ALBUMS
      ========================= */}

      {artist.albums?.length > 0 &&(

        <div className="artist-section">

          <div className="section-title">
            Albums
          </div>

          <div className="album-grid">

            {artist.albums?.map(album => (

              <div 
                key={album.id}
                className="artist-album-card"
              >

                {album.cover_url ? (
                  <img src={album.cover_url} className="artist-album-cover"/>
                ) : (
                  <div className="artist-album-placeholder">
                    <Music size={30} className="artist-icon"/>
                  </div>
                )}

                <div className="artist-album-title">
                  {album.title || album.name}
                </div>

              </div>

            ))}

          </div>

        </div>
      )}

      {/* =========================
          ALL SONGS
      ========================= */}

      <div className="artist-section">

        <div className="section-title">Songs</div>

        {artist.all_songs?.map((song)=>(
          <SongCard
            key={song.song_id}
            song={{
              id: song.song_id,
              title: song.title,
              main: song.main,
              ft: song.ft,
              artists: song.artists,
              artist_id: song.artist_id,
              image: song.cover_url,
              url: song.url
            }}
            onSelectSong={onSelectSong}
            onOpenArtist={onOpenArtist}
            
          />
        ))}

      </div>


      {/* =========================
         RELATED ARTISTS
      ========================= */}

      {artist.related_artists?.length > 0 && (

        <div className="artist-section">

          <div className="section-title">
            Related Artists
          </div>

          <div className="related-grid">

            {artist.related_artists?.map(a => (

              <div 
                key={a.id}
                className="related-card"
                onClick={()=>onOpenArtist?.({id:a.id})}>

                {a.cover_url ? (
                  <img src={a.cover_url} className="related-image"/>
                ) : (
                  <div className="related-placeholder">
                    <Music size={26} className="artist-icon"/>
                  </div>
                )}

                <div className="related-name">
                  {a.name}
                </div>

              </div>

            ))}

          </div>

        </div>
      )}

    </div>
  )
}