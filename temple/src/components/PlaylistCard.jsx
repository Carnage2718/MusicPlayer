import { Music } from "lucide-react"
import "./PlaylistCard.css"

export default function PlaylistCard({
  playlist,
  onOpenPlaylist
}) {

  return (
    <div
      className="playlists-card"
      onClick={()=>onOpenPlaylist?.(playlist)}
    >

      <div className="playlists-cover-wrap">
        {playlist.cover_url ? (
          <img
            src={playlist.cover_url}
            className="playlists-cover-img"
          />
        ) : (
          <div className="playlists-cover-placeholder">
            <Music size={48}/>
          </div>
        )}
      </div>

      <div className="playlists-title">
        {playlist.name}
      </div>

      <div className="playlists-meta">
        {playlist.song_count || 0} songs
      </div>

    </div>
  )
}