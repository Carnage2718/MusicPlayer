import { Play, Pause } from "lucide-react"
import { useRef, useEffect, useState } from "react"
import "./MiniPlayer.css"
import ArtistLinks from "./ArtistLinks"
import { useSongs } from "../context/SongsContext"
import TextScroller from "./TextScroller"

export default function MiniPlayer({
  song,
  isPlaying,
  setIsPlaying,
  onExpand,
  onOpenArtist
}) {

  const startY = useRef(null)
  const lastTap = useRef(0)

  const cover = song.image || song.cover

  const [progress, setProgress] = useState(0)
  const { audioRef } = useSongs()

  /* ===============================
     progress 同期
  =============================== */
  useEffect(()=>{
    const audio = audioRef?.current
    if(!audio) return

    const update=()=>{
      if(audio.duration){
        setProgress((audio.currentTime / audio.duration) * 100)
      }
    }

    audio.addEventListener("timeupdate", update)

    return ()=>audio.removeEventListener("timeupdate", update)

  },[audioRef])


  /* ===============================
     スワイプ開始
  =============================== */

  const start = (y) => {
    startY.current = y
  }

  /* ===============================
     スワイプ終了
  =============================== */

  const end = (y) => {

    if (startY.current === null) return

    const diff = startY.current - y

    if (diff > 60) {
      onExpand()
    }

    startY.current = null

  }

  /* ===============================
     ダブルタップ
  =============================== */

  const handleTap = () => {

    const now = Date.now()

    if (now - lastTap.current < 300) {
      onExpand()
    }

    lastTap.current = now

  }

  if (!song) return null

  /* ===============================
     artist分解
  =============================== */
  
  return (

    <div
      className="mini-player"
      onTouchStart={(e) => start(e.touches[0].clientY)}
      onTouchEnd={(e) => end(e.changedTouches[0].clientY)}
      onMouseDown={(e) => start(e.clientY)}
      onMouseUp={(e) => end(e.clientY)}
      onDoubleClick={onExpand}
      onClick={handleTap}
    >

      <div className="mini-content">

        {/* 左：ジャケット */}

        <div className="mini-left">

          <div className={`album-art ${isPlaying ? "playing" : ""}`}>

            {cover ? (
              <img src={cover} alt="cover" />
            ) : (
              <div className="record" />
            )}

          </div>

        </div>

        {/* 中央：曲情報 */}

        <div className="mini-center">

          <TextScroller
            text={song.title}
            className="mini-title"
          />

          <div className="mini-artist">

            <ArtistLinks
              artists={song?.artists}
              onOpenArtist={onOpenArtist}
            />

          </div>
        </div>

        {/* 右：再生ボタン */}

        <div className="mini-right">

          <button
            className={`play-btn ${isPlaying ? "active" : ""}`}
            onClick={(e) => {

              e.stopPropagation()
              setIsPlaying(!isPlaying)

            }}
          >

            {isPlaying ? (
              <Pause size={18} />
            ) : (
              <Play size={18} />
            )}

          </button>

        </div>

      </div>

      {/* プログレスバー */}

      <div className="mini-progress">

        <div
          className="mini-progress-fill"
          style={{
            width: `${Math.min(progress,100)}%`
          }}
        />

      </div>

    </div>

  )

}