import { Music } from "lucide-react"
import "./SongCard.css"
import ArtistLinks from "./ArtistLinks"

export default function SongCard({
  song,
  onSelectSong,
  onOpenArtist
}) {

  /* =========================
     SONG CLICK
  ========================= */

  const handleClick = () => {

    if (onSelectSong) {
      onSelectSong(song)
    }

  }

  /* =========================
     KEYBOARD ACCESSIBILITY
  ========================= */

  const handleKeyDown = (e) => {

    if (e.key === "Enter" || e.key === " ") {
      handleClick()
    }

  }

  /* =========================
     ARTIST SPLIT
  ========================= */

  const main = song.main || ""
  const ft = song.ft || ""
  const artists = song.artists || []

  return (

    <div
      id={`song-${song.id}`}
      className="song-card"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >

      {/* COVER */}

      <div className="song-cover">

        {song.image ? (

          <img
            src={song.image}
            alt={song.title || "cover"}
            loading="lazy"
          />

        ) : (

          <div className="cover-placeholder">

            <Music
              size={22}
              className="music-icon"
            />

          </div>

        )}

      </div>

      {/* SONG INFO */}

      <div className="song-info">

        <div className="song-title">
          {song.title}
        </div>

        <div className="song-artist">

          <ArtistLinks
            artists={artists}
            onOpenArtist={onOpenArtist}
          />

        </div>
      </div>

    </div>

  )

}