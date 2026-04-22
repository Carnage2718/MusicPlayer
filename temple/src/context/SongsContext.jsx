import { createContext, useContext, useEffect, useRef, useState } from "react"
import API_BASE from "../api"

const SongsContext = createContext()

export function SongsProvider({ children }) {

  const audioRef = useRef(null)

  const [currentId, setCurrentId] = useState(null)
  const [queueIds, setQueueIds] = useState([])
  const [current, setCurrent] = useState(null)
  const [queue, setQueue] = useState([])
  const [history, setHistory] = useState([])

  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const streamCache = useRef({})
  const songCache = useRef({})

  // =========================
  // SONG META
  // =========================

  const getSongMeta = async (id) => {
    if (songCache.current[id]) return songCache.current[id]

    const res = await fetch(`${API_BASE}/songs/${id}`)
    const data = await res.json()

    const song = {
      song_id: id,
      title: data.title,
      artists: data.artists,
      image: data.cover,
      url: null
    }

    songCache.current[id] = song
    return song
  }

  // =========================
  // STREAM
  // =========================

  const getStream = async (id) => {
    if (streamCache.current[id]) return streamCache.current[id]

    const res = await fetch(`${API_BASE}/songs/${id}/stream`)
    const data = await res.json()

    streamCache.current[id] = data.stream_url
    return data.stream_url
  }

  // =========================
  // PRELOAD（次の曲）
  // =========================

  useEffect(() => {
    if (queueIds[0]) {
      getStream(queueIds[0])
    }
  }, [currentId, queueIds])

  // =========================
  // CURRENT LOAD（最重要）
  // =========================

  useEffect(() => {

    if (!currentId) return

    let cancelled = false

    const load = async () => {

      const [meta, stream] = await Promise.all([
        getSongMeta(currentId),
        getStream(currentId)
      ])

      if (cancelled) return

      setCurrent({
        ...meta,
        url: stream
      })

      setIsPlaying(true)

    }

    load()
    return () => { cancelled = true }

  }, [currentId])

  // =========================
  // QUEUE LOAD（遅延）
  // =========================

  useEffect(() => {

    if (!queueIds.length) {
      setQueue([])
      return
    }

    let cancelled = false

    const load = async () => {

      await new Promise(r => setTimeout(r, 0))

      const arr = []

      // 🔥 first
      const first = await getSongMeta(queueIds[0])
      arr.push(first)
      setQueue(arr.slice())

      // 🔥 rest
      for (let i = 1; i < queueIds.length; i++) {

        if (cancelled) return

        const meta = await getSongMeta(queueIds[i])
        arr.push(meta)

        setQueue(arr.slice())
      }

    }

    load()
    return () => { cancelled = true }

  }, [queueIds])

  // =========================
  // INIT
  // =========================

  useEffect(() => {
    loadQueue()
  }, [])

  const loadQueue = async () => {

    const res = await fetch(`${API_BASE}/queue`)
    const data = await res.json()

    setCurrentId(data.current || null)
    setQueueIds(data.queue || [])
  }

  // =========================
  // AUDIO CONTROL
  // =========================

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !current?.url) return

    if (!audio.src || !audio.src.includes(current.url)) {
      audio.src = current.url
    }

    if (isPlaying) {
      audio.play().catch(() => {})
    }

  }, [current])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    isPlaying ? audio.play().catch(() => {}) : audio.pause()

  }, [isPlaying])

  // =========================
  // NEXT
  // =========================

  const nextSong = () => {

    if (current) {
      setHistory(prev => [...prev, current])
    }

    if (!queueIds.length) return

    const nextId = queueIds[0]

    setCurrentId(nextId)
    setQueueIds(prev => prev.slice(1))

  }

  // =========================
  // PREV
  // =========================

  const prevSong = () => {

    if (!history.length) return

    const prevSongObj = history[history.length - 1]

    setQueueIds(q => [currentId, ...q])
    setCurrentId(prevSongObj.song_id)
    setHistory(h => h.slice(0, -1))

  }

  // =========================
  // PLAY
  // =========================

  const playSong = (song) => {
    const id = song.song_id || song.id
    setCurrentId(id)
    setIsPlaying(true)
  }

  // =========================
  // SHUFFLE
  // =========================

  const shuffleQueue = () => {

    setQueue(prev => {
      const arr = [...prev]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[arr[i], arr[j]] = [arr[j], arr[i]]
      }
      return arr
    })

    fetch(`${API_BASE}/queue/shuffle`, { method: "POST" })
  }

  // =========================
  // END
  // =========================

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => nextSong()

    audio.addEventListener("ended", handleEnded)
    return () => audio.removeEventListener("ended", handleEnded)

  }, [current]) // ← 修正

  // =========================
  // QUEUE UPDATE
  // =========================

  useEffect(() => {

    const handler = () => loadQueue()

    window.addEventListener("queueUpdated", handler)
    return () => window.removeEventListener("queueUpdated", handler)

  }, [])

  // =========================
  // PROGRESS
  // =========================

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    let raf

    const update = () => {

      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100)
      } else {
        setProgress(0)
      }

      raf = requestAnimationFrame(update)
    }

    setProgress(0)
    raf = requestAnimationFrame(update)

    return () => cancelAnimationFrame(raf)

  }, [current])

  return (
    <SongsContext.Provider
      value={{
        currentSong: current,
        queue,
        history,
        isPlaying,
        progress,
        playSong,
        nextSong,
        prevSong,
        setIsPlaying,
        shuffleQueue,
        audioRef
      }}
    >
      {children}
    </SongsContext.Provider>
  )
}

export function useSongs() {
  return useContext(SongsContext)
}