import { useLayoutEffect, useRef, useState, useEffect } from "react"
import API_BASE from "../api"

import {
  Shuffle,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Music,
  GripVertical
} from "lucide-react"

import "./QueueScreen.css"
import AppHeader from "../components/AppHeader"
import SongCard from "../components/SongCard"
import { useSongs } from "../context/SongsContext"

export default function QueueScreen({
  openFullPlayer,
  isPlaying,
  setIsPlaying,
  onOpenArtist
}) {

  const {
    queue,
    history,
    currentSong,
    playSong,
    shuffleQueue,
    audioRef,
    nextSong,
    prevSong,
    historyMeta
  } = useSongs()

  const [shuffleActive, setShuffleActive] = useState(false)

  const nowPlayingRef = useRef(null)
  const firstScrollDone = useRef(false)

  const [dragSong, setDragSong] = useState(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = document.querySelector(".queue-screen")
    if (!el) return

    const headerHeight = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--header-height")
    ) || 72

    el.scrollTo({
      top: headerHeight,
      behavior: "auto"
    })

  }, [])

  /* INITIAL SCROLL（変更なし） */
  useLayoutEffect(() => {

    if (firstScrollDone.current) return
    if (!nowPlayingRef.current) return

    const container = document.querySelector(".queue-screen")
    if (!container) return

    const headerHeight =
      parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue("--header-height")) || 72

    requestAnimationFrame(() => {

      const now = nowPlayingRef.current

      const y =
        now.getBoundingClientRect().top +
        container.scrollTop -
        headerHeight - 20

      container.scrollTo({ top: y, behavior: "auto" })

      firstScrollDone.current = true

    })

  }, [])

  /* STOP SCROLL（変更なし） */
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => (document.body.style.overflow = prev)
  }, [])

  useEffect(() => {

    const target = document.querySelector(".queue-now-wrapper")
    if (!target) return

    const headerHeight = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue("--header-height")
    ) || 72

    const y =
      target.getBoundingClientRect().top +
      window.scrollY -
      headerHeight

    window.scrollTo({ top: y })

  }, [])

  /* =========================
     DRAG（軽量化）
  ========================= */

  const handleDrop = (targetSong) => {

    if (!dragSong) return

    // 🔥 UI即更新
    const newQueue = [...queue]
    const fromIndex = newQueue.findIndex(s => s.song_id === dragSong.song_id)
    const toIndex = newQueue.findIndex(s => s.song_id === targetSong.song_id)

    if (fromIndex === -1 || toIndex === -1) return

    const [moved] = newQueue.splice(fromIndex, 1)
    newQueue.splice(toIndex, 0, moved)

    fetch(`${API_BASE}/queue/reorder`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newQueue.map(s => s.song_id))
    })
    .then(res => res.json())
    .then(data => {
      window.dispatchEvent(
        new CustomEvent("queueApply", { detail: data })
      )
    })

    setDragSong(null)
  }


  /* =========================
     progress 同期
  ========================= */

  useEffect(() => {
    const audio = audioRef?.current
    if (!audio) return

    const update = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) *100)
      }
    }

    audio.addEventListener("timeupdate", update)

    return ()=>{
      audio.removeEventListener("timeupdate", update)
    }
  }, [audioRef.current])

  /* =========================
     PLAYER（完全即時）
  ========================= */

  const handleNext = nextSong

  const handlePrev = prevSong

  const toggleShuffle = () => {
    setShuffleActive(prev => !prev)
    shuffleQueue() // 🔥 UI即シャッフル
  }

  return (

    <div className="queue-screen">

      <AppHeader title="Queue" />

      <div className="queue-scroll">

        {/* HISTORY */}
        <div className="queue-section">

          <div className="queue-subtitle">
            Previously Played
          </div>

          {historyMeta.map((song, index) => (
            <div
              key={`history-${song.song_id}-${index}`}
              className="queue-row"
              onDragStart={() => setDragSong(song)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(song)}
            >

              <div className="queue-main">
                <SongCard
                  song={{
                    id: song.song_id,
                    title: song.title,
                    main: song.main,
                    ft: song.ft,
                    artists: song.artists,
                    image: song.cover || song.image,
                    url: song.url
                  }}
                  onSelectSong={() => playSong(song)}
                  onOpenArtist={onOpenArtist}
                />
              </div>

              <GripVertical className="drag" size={16} />

            </div>
          ))}
        </div>

        {/* NOW */}
        <div className="queue-now-wrapper" ref={nowPlayingRef}>

          <div className="queue-now-player" onClick={openFullPlayer}>

            {/* 左：SongCard */}
            <div className="queue-now-main">

              <SongCard
                key={`current-${currentSong?.song_id}-${currentSong?.position || 0}`}
                song={{
                  id: currentSong?.song_id,
                  title: currentSong?.title,
                  main: currentSong?.main,
                  ft: currentSong?.ft,
                  artists: currentSong?.artists,
                  image: currentSong?.cover || currentSong?.image,
                  url: currentSong?.url
                }}
                onOpenArtist={onOpenArtist}
              />

            </div>

            {/* 右：Controls */}
            <div
              className="queue-controls"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={handlePrev}>
                <SkipBack size={20} />
              </button>

              <button
                className="queue-play-main"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause size={24} /> : <Play size={24} />}
              </button>

              <button onClick={handleNext}>
                <SkipForward size={20} />
              </button>
            </div>

          </div>

          <div className="queue-progress">
            <div
              className="queue-progress-fill"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

        </div>

        {/* UP NEXT */}
        <div className="queue-section">

          <div className="queue-header-row">

            <div className="queue-subtitle">Up Next</div>

            <button
              className={`shuffle-toggle ${shuffleActive ? "active" : ""}`}
              onClick={toggleShuffle}
            >
              <Shuffle size={18} />
            </button>

          </div>

          {queue.map((song, index) => (
            <div
              key={`queue-${song.song_id}-${queue.length}-${index}`}
              className="queue-row"
              draggable
              onDragStart={() => setDragSong(song)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(song)}
            >

              <div className="queue-main">
                <SongCard
                  song={{
                    id: song.song_id,
                    title: song.title,
                    main: song.main,
                    ft: song.ft,
                    artists: song.artists,
                    image: song.cover || song.image,
                    url: song.url
                  }}
                  onSelectSong={() => playSong(song)}
                  onOpenArtist={onOpenArtist}
                />
              </div>

              <GripVertical className="drag" size={16} />

            </div>
          ))}

        </div>

      </div>

    </div>
  )
}