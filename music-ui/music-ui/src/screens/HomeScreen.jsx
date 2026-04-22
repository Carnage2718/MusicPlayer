import { useEffect, useCallback } from "react"
import { useSongs } from "../context/SongsContext"
import { Play, Music } from "lucide-react"
import API_BASE from "../api"
import "./HomeScreen.css"
import AppHeader from "../components/AppHeader"
import TextScroller from "../components/TextScroller"

export default function HomeScreen({
  onSelectSong,
  openArtist,
  openAlbum
}) {

  const { homeData, setHomeData } = useSongs()

  const data = homeData || {
    recent: [],
    trending: [],
    albums: [],
    artists: []
  }


  /* =========================
     LOAD（最適化）
  ========================= */

  useEffect(() => {

    if (homeData) return

    let mounted = true

    const load = async () => {
      const res = await fetch(`${API_BASE}/home`)
      const d = await res.json()

      if (!mounted) return

      setHomeData({
        recent: d.recent || [],
        trending: d.trending || [],
        albums: d.albums || [],
        artists: d.artists || []
      })
    }

    load()

    return () => { mounted = false }

  }, [homeData])

  /* =========================
     HOMEEVENT
  ========================= */

  const HomeEvent = useCallback(async () => {

    try {
      const res = await fetch(`${API_BASE}/queue/from_recent`, {
        method: "POST"
      })

      const data = await res.json()

      if (data.current) {
        onSelectSong({ id: data.current }) // 🔥 ここ変更
      }

    } catch (e) {
      console.error(e)
    }

  }, [onSelectSong])

  /* =========================
     STATION CARD（構造維持）
  ========================= */

  const StationCard = ({
    title,
    artists,
    image,
    onClick,
    onArtistClick
  }) => (

    <div className="station-card" onClick={onClick}>

      <div className="station-cover">
        {image
          ? <img src={image} />
          : (
            <div className="station-placeholder">
              <Music size={80} color="#30ff7a"/>
            </div>
          )
        }
      </div>

      <TextScroller
        text={title}
        className="station-title"
      />

      <div className="station-subtitle">

        {Array.isArray(artists) && artists.length > 0 && (

          (() => {

            const main = artists.filter(a => (a.role || "") === "main")
            const feat = artists.filter(a => (a.role || "") === "featuring")

            return (
              <>
                {main.map((a, i) => (
                  <span
                    key={a.id}
                    className="artist-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      onArtistClick && onArtistClick(a)
                    }}
                  >
                    {a.name}
                    {i < main.length - 1 && ", "}
                  </span>
                ))}

                {feat.length > 0 && " ft. "}

                {feat.map((a, i) => (
                  <span
                    key={a.id}
                    className="artist-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      onArtistClick && onArtistClick(a)
                    }}
                  >
                    {a.name}
                    {i < feat.length - 1 && ", "}
                  </span>
                ))}
              </>
            )

          })()

        )}

      </div>

    </div>
  )

  /* =========================
     UI（完全維持）
  ========================= */

  return (

    <div className="screen">

      <AppHeader title="Home" />

      <div className="bottom-countermeasure">

        {/* HERO */}
        <div className="hero-row">

          <div className="hero-card hero-main">

            <div className="hero-text">
              <div className="hero-tag">FEATURED</div>
              <div className="hero-title">Your Daily Mix</div>
              <div className="hero-desc">Trending tracks for you</div>
            </div>

          </div>

          <div className="shuffle-card" onClick={HomeEvent}>

            {/* 🔥 BLOB維持（重要） */}
            <div className="blob blob1"></div>
            <div className="blob blob2"></div>
            <div className="blob blob3"></div>
            <div className="blob blob4"></div>
            <div className="blob blob5"></div>
            <div className="blob blob6"></div>

            <div className="shuffle-center">
              <Play size={40} />
            </div>

          </div>

        </div>

        {/* CONTINUE */}
        <section className="home-section">

          <div className="section-title">
            Continue Listening
          </div>

          <div className="horizontal-scroll">

            {data.recent.map(song => (

              <StationCard
                key={song.song_id}
                title={song.title}
                artists={song.artists}
                image={song.image}
                onClick={() => onSelectSong({ id: song.song_id })}
                onArtistClick={(artist) => openArtist({
                  id: artist.id,
                  name: artist.name
                })}
              />

            ))}

          </div>

        </section>

        {/* TRENDING */}
        <section className="home-section">

          <div className="section-title">
            Trending Now
          </div>

          <div className="horizontal-scroll">

            {data.trending.map(song => (

              <StationCard
                key={song.song_id}
                title={song.title}
                artists={song.artists}
                image={song.image}
                onClick={() => onSelectSong({ id: song.song_id })}
                onArtistClick={(artist) => openArtist({
                  id: artist.id,
                  name: artist.name
                })}
              />

            ))}

          </div>

        </section>

        {/* ARTISTS */}
        <section className="home-section">

          <div
            className="section-title clickable"
            onClick={() => openArtist(null)}
          >
            Popular Artists
          </div>

          <div className="horizontal-scroll">

            {data.artists.map(artist => (

              <StationCard
                key={artist.artist_id}
                title={artist.name}
                artists={[{name: `${artist.song_count} songs`, role: "main"}]} // 🔥 曲数表示追加
                image={artist.image}
                onClick={() => openArtist({
                  id: artist.artist_id,
                  name: artist.name
                })}
              />

            ))}

          </div>

        </section>

        {/* ALBUMS */}
        <section className="home-section">

          <div
            className="section-title clickable"
            onClick={() => openAlbum(null)}
          >
            Popular Albums
          </div>

          <div className="horizontal-scroll">

            {data.albums.map(album => (

              <StationCard
                key={album.id}
                title={album.name}
                artists={album.artists}
                image={album.image}
                onClick={() => openAlbum(album)}
                onArtistClick={() => openArtist({
                  id: album.artists[0].id,
                  name: album.artists[0].name
                })}
              />

            ))}

          </div>

        </section>

      </div>

    </div>
  )
}