import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  ListMusic,
  Music
} from "lucide-react"

import { useRef, useState, useEffect } from "react"
import "./FullPlayer.css"
import ArtistLinks from "./ArtistLinks"
import TextScroller from "./TextScroller"
import { useSongs } from "../context/SongsContext"

export default function FullPlayer({
  song,
  isPlaying,
  setIsPlaying,
  onClose,
  progress,
  setCurrentScreen,
  shuffleMode,
  setShuffleMode,
  onOpenArtist
}) {

  const startY = useRef(0)
  const cover = song.image || song.cover

  const [currentTime,setCurrentTime] = useState(0)
  const [duration,setDuration] = useState(0)
  const { nextSong, prevSong, audioRef, repeatMode, setRepeatMode } = useSongs()

  if(!song) return null

  /* =========================
     ARTISTS SPLIT
  ========================= */

  const artists = song.artists || []

  /* =========================
     SWIPE CLOSE
  ========================= */

  const handleTouchStart = (e)=>{
    startY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e)=>{
    const diff = e.changedTouches[0].clientY - startY.current
    if(diff > 120) onClose()
  }

  /* =========================
     AUDIO TIME
  ========================= */

  useEffect(()=>{

    const audio = audioRef?.current
    if(!audio) return

    const update = ()=>{
      setCurrentTime(audio.currentTime || 0)
      setDuration(audio.duration || 0)
    }

    audio.addEventListener("timeupdate",update)

    return ()=>audio.removeEventListener("timeupdate",update)

  },[audioRef])

  /* =========================
     SEEK
  ========================= */

  const handleSeek = (e)=>{

    const audio = audioRef.current
    if(!audio || !audio.duration) return

    audio.currentTime =
      (e.target.value / 100) * audio.duration

  }

  /* =========================
     TIME FORMAT
  ========================= */

  const formatTime = (time)=>{

    if(!time) return "0:00"

    const m = Math.floor(time/60)
    const s = Math.floor(time%60)

    return `${m}:${s<10?"0":""}${s}`

  }

  /* =========================
     REPEAT
  ========================= */

  const toggleRepeat = () => {
    if (repeatMode === "none") setRepeatMode("all")
    else if (repeatMode === "all") setRepeatMode("one")
    else setRepeatMode("none")
  }

  /* =========================
     OPEN QUEUE
  ========================= */

  const openQueue = ()=>{
    setCurrentScreen("queue")
    onClose()
  }

  return (

    <div
      className={`full-player ${song.image ? "has-cover":"no-cover-bg"}`}
      style={{
        "--player-bg": cover ? `url(${cover})` : "none"
      }}
    >

      {/* TOP BAR */}

      <div
        className="player-top"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        <div
          className="grab-bar"
          onClick={onClose}
        />

      </div>

      {/* RECORD */}

      <div className="record-disc">

        <div
          key={song.id}
          className={`record-vinyl ${isPlaying ? "playing":""}`}
        >

          <div className="record-grooves"/>

          {cover ? (

            <div className="record-label">

              <img
                src={cover}
                alt="cover"
              />

            </div>

          ) : (

            <div className="record-label no-cover">

              <Music
                size={60}
                className="music-icon-large"
              />

            </div>

          )}

        </div>

      </div>

      {/* SONG INFO */}

      <div className="full-info">


        <TextScroller
          text={song.title}
          className="full-title"
        />

        <div className="full-artist">

          <ArtistLinks
            artists={artists}
            onOpenArtist={(artist)=>{
              onOpenArtist?.(artist)
              onClose()
            }}
          />

        </div>
      </div>

      {/* SEEK BAR */}

      <div className="seek-wrapper">

        <div className="time-row">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <input
          className="seek-bar"
          type="range"
          min="0"
          max="100"
          value={progress || 0}
          onChange={handleSeek}
          style={{"--progress":`${progress}%`}}
        />

      </div>

      {/* CONTROLS */}

      <div className="controls">

        <button onClick={prevSong}>
          <SkipBack size={26}/>
        </button>

        <button
          className="play-main"
          onClick={()=>setIsPlaying(!isPlaying)}
        >
          {isPlaying
            ? <Pause size={36}/>
            : <Play size={36}/>
          }
        </button>

        <button onClick={nextSong}>
          <SkipForward size={26}/>
        </button>

      </div>

      {/* EXTRA CONTROLS */}

      <div className="extra-controls">

        <Shuffle
          size={20}
          color={shuffleMode ? "#1db954":"white"}
          onClick={()=>setShuffleMode(!shuffleMode)}
        />

        <div
          className="repeat-wrapper"
          onClick={toggleRepeat}
        >

          <Repeat
            size={20}
            color={repeatMode !== "none" ? "#1db954":"white"}
          />

          {repeatMode === "one" && (
            <span className="repeat-one">1</span>
          )}

        </div>

        <ListMusic
          size={20}
          onClick={openQueue}
        />

      </div>

    </div>

  )

}