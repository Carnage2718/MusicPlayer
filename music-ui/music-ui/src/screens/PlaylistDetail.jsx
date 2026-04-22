import "./PlaylistDetail.css"
import AppHeader from "../components/AppHeader"

export default function PlaylistDetail({ playlist }){

  return(

    <div className="screen playlist-detail">

      <AppHeader title="PlaylistDetail"/>

      <div className="playlist-header">

        <img
          src="/playlist.jpg"
          className="playlist-cover"
        />

        <div className="playlist-meta">

          <div className="playlist-title">
            {playlist?.title || "Playlist"}
          </div>

          <div className="playlist-owner">
            Created by You
          </div>

        </div>

      </div>

      <div className="playlist-tracks">

        {[1,2,3].map((n)=>(
          
          <div
            key={n}
            className="playlist-track"
          >

            <img
              src="/Mayhem.png"
              className="playlist-track-cover"
            />

            <div className="playlist-track-info">

              <div className="playlist-track-title">
                Song Title
              </div>

              <div className="playlist-track-artist">
                Artist
              </div>

            </div>

          </div>

        ))}

      </div>

    </div>

  )

}