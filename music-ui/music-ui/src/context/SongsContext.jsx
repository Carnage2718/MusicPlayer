import { createContext, useContext, useEffect, useRef, useState } from "react"
import API_BASE from "../api"

const SongsContext = createContext()

export function SongsProvider({ children }) {
  const [homeData, setHomeData] = useState(() => {
    try {
      const saved = localStorage.getItem("homeCache")
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const audioRef = useRef(null)
  const [currentId, setCurrentId] = useState(null)
  const [queueIds, setQueueIds] = useState([])
  const [current, setCurrent] = useState(null)
  const [queue, setQueue] = useState([])
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem("history")
    return saved ? JSON.parse(saved) : []
  })
  const [historyMeta, setHistoryMeta] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const songCache = useRef({})
  const streamCache = useRef({})
  const nextCache = useRef({})
  const userInteracted = useRef(false)
  const preloadRef = useRef(new Audio())
  const isStartingRef = useRef(false)
  const [repeatMode, setRepeatMode] = useState("none")
  const repeatModeRef = useRef(repeatMode)


  
  /* =========================
     repeatModeRef init
  ========================= */

  useEffect(() => {
    repeatModeRef.current = repeatMode
  }, [repeatMode])
  
  /* =========================
     audioref init
  ========================= */
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.preload = "auto"
    }
  }, [])

  /* =========================
     HomeCache
  ========================= */
  useEffect(() => {
    if (homeData) {
      localStorage.setItem("homeCache", JSON.stringify(homeData))
    }
  }, [homeData])

  useEffect(() => {

    const handler = () => {
      setHomeData(null)
    }

    window.addEventListener("homeUpdated", handler)

    return () => {
      window.removeEventListener("homeUpdated", handler)
    }

  }, [])


  /* =========================
     QUEUE APPLY（最重要）
  ========================= */

  const applyQueue = (data) => {

    if (data.current !== undefined) {
      setCurrentId(data.current)
    }

    if (data.queue !== undefined) {
      setQueueIds([...data.queue])
    }
  }

  /* =========================
     INIT
  ========================= */

  useEffect(() => {
    fetch(`${API_BASE}/queue`)
      .then(res => res.json())
      .then(applyQueue)
  }, [])

  /* =========================
     SONG META
  ========================= */

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

  /* =========================
     STREAM
  ========================= */
  const getStream = async (id) => {
    try {
      if (streamCache.current[id]) return streamCache.current[id]

      const res = await fetch(`${API_BASE}/songs/${id}/stream`)
      if (!res.ok) throw new Error()

      const data = await res.json()

      streamCache.current[id] = data.stream_url
      return data.stream_url

    } catch {
      return null // 🔥 安全
    }
  }

  /* =========================
     CURRENT
  ========================= */

  useEffect(() => {

    if (!currentId) return

    let cancelled = false

    const load = async () => {

      const id = currentId

      const meta = await getSongMeta(id)

      let stream =
        nextCache.current[id] ||
        streamCache.current[id]

      if (!stream) {
        stream = await getStream(id)
      }

      if (cancelled || id !== currentId) return // 🔥 追加

      const song = { ...meta, url: stream }
      setCurrent(song)

      const audio = audioRef.current

      if (audio.src !== stream) {
        audio.src = stream
        audio.load()
      }

      if (userInteracted.current || isPlaying){
        audio.play().catch(()=>{})
      }
    }

    load()
    return () => { cancelled = true }

  }, [currentId])

  /* =========================
     QUEUE（軽量ロード）
  ========================= */

  useEffect(() => {

    if (!queueIds.length) {
      setQueue([])
      return
    }

    let cancelled = false
    
    const load = async () => {

      const first = await Promise.all(
        queueIds.slice(0, 20).map(getSongMeta)
      )

      if (cancelled) return
      setQueue([...first])

      const rest = queueIds.slice(20)

      for (let id of rest) {

        if (cancelled) return

        const meta = await getSongMeta(id)

        setQueue(prev => [...prev, meta])

        await new Promise(r => setTimeout(r, 0))
      }
    }

    load()

    return () => { cancelled = true }

  }, [queueIds])

  useEffect(() => {

    if (!queueIds.length) return

    const nextId = queueIds[0]

    if (!nextCache.current[nextId]) {
      getStream(nextId).then(url => {
        nextCache.current[nextId] = url
        streamCache.current[nextId] = url
      })
    }

  }, [queueIds])


  /* =========================
     AUDIO
  ========================= */

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.play().catch(()=>{})
    } else {
      audio.pause()
    }

  }, [isPlaying, current]) // 🔥 current追加

  /* =========================
     PROGRESS
  ========================= */

  useEffect(() => {

    const audio = audioRef.current
    if (!audio) return

    let raf

    const loop = () => {

      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100)
      } else {
        setProgress(0)
      }

      raf = requestAnimationFrame(loop)
    }

    setProgress(0)
    raf = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(raf)

  }, [current])

  /* =========================
     HISTORY
  ========================= */

  useEffect(() => {
    localStorage.setItem("history", JSON.stringify(history))
  }, [history])

  const pushHistory = (song) => {
    setHistory(prev => {
      const next = [...prev, {
        song_id: song.song_id,
        played_at: Date.now()
      }]
      return next.slice(-50)
    })
  }

  useEffect(() => {

    if (!history.length) {
      setHistoryMeta([])
      return
    }

    let cancelled = false

    const load = async () => {

      const arr = []

      for (let h of history) {

        if (cancelled) return

        const meta = await getSongMeta(h.song_id)
        arr.push(meta)

        if (arr.length % 5 === 0) {
          setHistoryMeta([...arr])
          await new Promise(r => setTimeout(r, 0))
        }
      }

      setHistoryMeta(arr)
    }

    load()
    return () => { cancelled = true }

  }, [history])

  /* =========================
     NEXT
  ========================= */

  const nextSong = async () => {

    if (current) pushHistory(current)

    const res = await fetch(`${API_BASE}/queue/next`, {
      method: "POST"
    })

    const data = await res.json()

    // 🔥 repeat all（queue空のとき）
    if ((!data.current || !data.queue?.length) && repeatMode === "all") {
      const restart = await fetch(`${API_BASE}/queue/restart`, {
        method: "POST"
      })
      const restartData = await restart.json()
      applyQueue(restartData)
      return
    }

    setIsPlaying(true)
    applyQueue(data)
  }
  /* =========================
     PREV
  ========================= */

  const prevSong = async () => {

    const res = await fetch(`${API_BASE}/queue/previous`, {
      method: "POST"
    })

    const data = await res.json()

    applyQueue(data)

  }

  /* =========================
     PLAY
  ========================= */

  const playSong = async (song) => {

    const id = song.song_id || song.id

    if (current) pushHistory(current)

    userInteracted.current = true

    const audio = audioRef.current

    let stream = await getStream(id)

    if (!stream) return

    audio.src = stream

    try {
      await audio.play() // 🔥 ここが最重要
    } catch (e) {
      console.warn("play blocked", e)
    }

    setCurrentId(id)
    setIsPlaying(true)

    await fetch(`${API_BASE}/queue/play/${id}`, {
      method: "POST"
    })
      .then(res => res.json())
      .then(applyQueue)
  }

  /* =========================
     SHUFFLE
  ========================= */

  const shuffleQueue = async () => {

    const res = await fetch(`${API_BASE}/queue/shuffle`, {
      method: "POST"
    })

    const data = await res.json()
    applyQueue(data)
  }

  /* =========================
     MENU COMPONENT
  ========================= */

  useEffect(() => {

    const handler = (e) => {
      applyQueue(e.detail)
    }

    window.addEventListener("queueApply", handler)

    return () => {
      window.removeEventListener("queueApply", handler)
    }

  }, [])

  /* =========================
     END
  ========================= */

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const ended = () => {

      const audio = audioRef.current

      if (repeatModeRef.current === "one" && audio) {
        audio.currentTime = 0
        audio.play().catch(()=>{})
        return
      }

      if (current) pushHistory(current)
      nextSong()
    }

    audio.addEventListener("ended", ended)
    return () => audio.removeEventListener("ended", ended)

  }, [current, repeatMode])


  /* =========================
     Queue From 
  ========================= */

  const playFrom = async (endpoint) => {

    if (isStartingRef.current) return
    isStartingRef.current = true

    try {

      userInteracted.current = true

      const res = await fetch(endpoint, { method: "POST" })
      const data = await res.json()

      const firstId = data.current
      if (!firstId) return

      const stream = await getStream(firstId)
      if (!stream) return

      const audio = audioRef.current
      audio.src = stream

      applyQueue(data)

      setCurrentId(firstId)

      await audio.play()

      setIsPlaying(true)


    } catch (e) {
      console.error(e)
    } finally {
      isStartingRef.current = false
    }
  }

  /* =========================
     Media Session
  ========================= */

  const formatArtists = (artists = []) => {
    const main = artists.filter(a => a.role === "main").map(a => a.name)
    const ft = artists.filter(a => a.role === "featuring").map(a => a.name)

    if (ft.length > 0) {
      return `${main.join(", ")} ft. ${ft.join(", ")}`
    }

    return main.join(", ")
  }

  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: formatArtists(current.artists),
      artwork: [
        {
          src: current.image || `${window.location.origin}/icon_rock_square.png`,
          sizes: "512x512",
          type: "image/png"
        }
      ]
    })

  }, [current])

  useEffect(() => {
    if (!("mediaSession" in navigator)) return

    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current.play()
      setIsPlaying(true)
    })

    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current.pause()
      setIsPlaying(false)
    })

    navigator.mediaSession.setActionHandler("nexttrack", nextSong)
    navigator.mediaSession.setActionHandler("previoustrack", prevSong)

  }, [])

  
  /* =========================
      PRELOAD NEXT
  ========================= */

  useEffect(() => {

    if (!queueIds.length) return

    const nextId = queueIds[0]

    getStream(nextId).then(url => {

      preloadRef.current.src = url
      preloadRef.current.preload = "auto"

    })

  }, [queueIds])

  return (
    <SongsContext.Provider
      value={{
        currentSong: current,
        queue,
        history,
        historyMeta,
        isPlaying,
        progress,
        playSong,
        nextSong,
        prevSong,
        setIsPlaying,
        shuffleQueue,
        audioRef,
        homeData,
        setHomeData,
        playFrom,
        repeatMode,
        setRepeatMode
      }}
    >
      {children}
    </SongsContext.Provider>
  )
}

export function useSongs() {
  return useContext(SongsContext)
}