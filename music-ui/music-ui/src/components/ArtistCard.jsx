import { Music } from "lucide-react"
import "./ArtistCard.css"
import TextScroller from "./TextScroller"

export default function ArtistCard({
  artist,
  onOpenArtist
}) {

  const handleClick = () => {
    onOpenArtist?.(artist)
  }

  const count = Number(artist.song_count) || 0

  return (
    <div
      className="artist-card-root"
      onClick={handleClick}
    >

      {/* IMAGE */}
      <div className="artist-card-cover">
        {artist.image_url ? (
          <img src={artist.image_url} alt={artist.name} />
        ) : (
          <div className="artist-card-placeholder">
            <Music size={22} />
          </div>
        )}
      </div>

      {/* INFO */}
      <div className="artist-card-info">

        <TextScroller
          text={artist.name || "Unknown Artist"}
          className="artist-card-name"
        />  

        <div className="artist-card-meta">
          {count === 1 ? "1 song" : `${count} songs`}
        </div>

      </div>

    </div>
  )
}