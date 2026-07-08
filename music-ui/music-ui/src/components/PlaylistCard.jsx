import { Music } from "lucide-react"
import "./PlaylistCard.css"
import TextScroller from "./TextScroller"

export default function PlaylistCard({
  playlist,
  onOpenPlaylist
}) {

  return (
    <div className="playlists-card">

      <div className="playlists-card-cover-wrap">
        {playlist.cover_url ? (
          <img
            src={playlist.cover_url}
            className="playlists-card-cover-img"
          />
        ) : (
          <div className="playlists-card-cover-placeholder">
            <Music size={48}/>
          </div>
        )}
      </div>

      <TextScroller
        text={playlist.name}
        className="playlists-card-title"
      />

      <div className="playlists-card-meta">
        {playlist.song_count || 0} songs
      </div>

    </div>
  )
}