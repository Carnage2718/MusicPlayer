import { Music } from "lucide-react"
import "./PlaylistCard.css"
import TextScroller from "./TextScroller"

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

      <TextScroller
        text={playlist.name}
        className="playlists-title"
      />

      <div className="playlists-meta">
        {playlist.song_count || 0} songs
      </div>

    </div>
  )
}