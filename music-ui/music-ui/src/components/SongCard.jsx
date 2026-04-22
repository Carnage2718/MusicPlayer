import { useRef } from "react"
import { Music } from "lucide-react"
import "./SongCard.css"
import ArtistLinks from "./ArtistLinks"
import TextScroller from "./TextScroller"
import { useMenu } from "../context/MenuContext"

export default function SongCard({
  song,
  onSelectSong,
  onOpenArtist,
  onLongPress
}) {
  const { openMenu } = useMenu()
  const lastTap = useRef(0)
  const tapTimeout = useRef(null)


  /* =========================
     SONG CLICK
  ========================= */

  const handleClick = (e) => {

    const now = Date.now()

    if (now - lastTap.current < 300) {

      clearTimeout(tapTimeout.current)
      // ダブルタップ
      const rect = e.currentTarget.getBoundingClientRect()

      openMenu(song, {
        x: rect.right,
        y: rect.bottom
      })

      lastTap.current = 0
      return
    }

    lastTap.current = now

    tapTimeout.current = setTimeout(() => {
      onSelectSong?.(song)
    }, 300)
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
     DATA
  ========================= */
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

        <TextScroller
          text={song.title}
          className="song-title"
        />

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