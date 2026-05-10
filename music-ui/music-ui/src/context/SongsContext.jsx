import { createContext, useContext, useEffect, useRef, useState } from "react"
import API_BASE, {
  authfetch
} from "../api"

const SongsContext = createContext()


export function SongsProvider({ children }) {

  const userId =
    localStorage.getItem("user_id")

  const HOME_CACHE_KEY =
    `homeCache_${userId}`

  const [homeData, setHomeData] = useState(() => {
    try {
      const saved =
        localStorage.getItem(HOME_CACHE_KEY)
      return saved
        ? JSON.parse(saved)
        : null
    } catch {

      return null

    }

  })
  const audioRef = useRef(null)
  const [currentId, setCurrentId] = useState(null)
  const currentIdRef = useRef(null)
  const countedRef = useRef(false)
  const [queueIds, setQueueIds] = useState([])
  const [current, setCurrent] = useState(null)
  const [queue, setQueue] = useState([])
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
  const changingTrackRef = useRef(false)

  
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

    if (!HOME_CACHE_KEY) return

    if (homeData) {

      localStorage.setItem(
        HOME_CACHE_KEY,
        JSON.stringify(homeData)
      )

    }

  }, [homeData, HOME_CACHE_KEY])

  useEffect(() => {

    const handler = () => {

      localStorage.removeItem(HOME_CACHE_KEY)

      setHomeData(null)

    }

    window.addEventListener("homeUpdated", handler)

    return () => {
      window.removeEventListener("homeUpdated", handler)
    }

  }, [])

  /* =========================
    HISTORY INIT
  ========================= */

  const loadHistory = async () => {

    try {

      const res = await authfetch("/history")
      const data = await res.json()

      setHistoryMeta(data)

    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadHistory()
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
    authfetch("/queue")
      .then(res => res.json())
      .then(applyQueue)
  }, [])

  /* =========================
     SONG META
  ========================= */

  const getSongMeta = async (id) => {

    if (songCache.current[id]) return songCache.current[id]

    const res = await authfetch(`/songs/${id}`)
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

      const res = await authfetch(`/songs/${id}/stream`)
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

      if (cancelled || id !== currentIdRef.current) return

      const song = { ...meta, url: stream }
      setCurrent(song)

      const audio = audioRef.current

      if (audio.src !== stream) {

        audio.src = stream
        audio.load()

        await new Promise((resolve) => {

          if (audio.readyState >= 3) {
            resolve()
            return
          }

          const handler = () => {
            audio.removeEventListener("canplay", handler)
            resolve()
          }

          audio.addEventListener("canplay", handler)

          if (cancelled) {
            audio.removeEventListener("canplay", handler)
          }

        })
        
      }

      if (userInteracted.current) {

        try {
          await audio.play()
        } catch (e) {
          console.error(e)
        }
      }
    }

    load()
    return () => { cancelled = true }

  }, [currentId])

  useEffect(() => {
    countedRef.current = false
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

  }, [isPlaying, current]) 

  /* =========================
     PROGRESS
  ========================= */

  useEffect(() => {

    const audio = audioRef.current
    if (!audio) return

    let raf

    const loop = () => {

      if (audio.duration) {
        const percent =
          (audio.currentTime / audio.duration) * 100

        setProgress(percent)

        if (
          !countedRef.current &&
          currentId &&
          audio.duration > 0 &&
          percent >= 50
        ) {

          countedRef.current = true

        }
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
     NEXT
  ========================= */

  const nextSong = async ({
    ignoreRepeatOne = false
  } = {}) => {

    const res = await authfetch(
      `/queue/next?ignore_repeat_one=${ignoreRepeatOne}`, 
      {
        method: "POST"
      }
    )

    const data = await res.json()


    if (data.restart) {

      const audio = audioRef.current

      audio.currentTime = 0

      try {
        await audio.play()
      } catch {}

      setIsPlaying(true)

      return
    }

    applyQueue(data)

    setIsPlaying(!!data.current)

  }


  /* =========================
     PREV
  ========================= */

  const prevSong = async () => {

    const res = await authfetch("/queue/previous", {
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

    userInteracted.current = true

    const data = await authfetch(
      `/queue/play/${id}`,
      {
        method: "POST"
      }
    ).then(r => r.json())

    applyQueue(data)

    setIsPlaying(true)
  }

  /* =========================
     SHUFFLE
  ========================= */

  const shuffleQueue = async () => {

    const res = await authfetch("/queue/shuffle", {
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

    const ended = async () => {

      // 二重実行防止
      if (changingTrackRef.current) return

      changingTrackRef.current = true

      try {

        const finishedId = currentIdRef.current

          // history追加
          if (countedRef.current && finishedId) {

            countedRef.current = false

            try {

              await authfetch(`/songs/${finishedId}/play`, {
                method: "POST"
              })

              await loadHistory()

            } catch (e) {
              console.error(e)
            }
          }

        await nextSong()

      } finally {

        // 少し待つ（超重要）
        setTimeout(() => {
          changingTrackRef.current = false
        }, 300)

      }
    }

    audio.addEventListener("ended", ended)
    return () => audio.removeEventListener("ended", ended)

  }, [])


  const changeRepeatMode = async (mode) => {

    setRepeatMode(mode)

    try {

      await authfetch(`/queue/mode?loop=${mode}`, {
        method: "POST"
      })

    } catch (e) {
      console.error(e)
    }
  }


  useEffect(() =>{
    currentIdRef.current = currentId
  }, [currentId])


  /* =========================
     Play From 
  ========================= */

  const playFrom = async (endpoint) => {

    if (isStartingRef.current) return
    isStartingRef.current = true

    try {

      userInteracted.current = true

      const res = await authfetch(
        endpoint.replace(API_BASE,""),
        { 
          method: "POST" 
        }
      )
      const data = await res.json()

      const firstId = data.current
      if (!firstId) return

      applyQueue(data)

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

    navigator.mediaSession.setActionHandler(
      "nexttrack",
      async () => {

        if (changingTrackRef.current) return

        changingTrackRef.current = true

        try {

          await nextSong({
            ignoreRepeatOne: true
          })

        } finally {

          setTimeout(() => {
            changingTrackRef.current = false
          }, 300)

        }
      }
    )

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


  useEffect(() => {

    authfetch(`/queue/mode`)
      .then(r => r.json())
      .then(data => {
        setRepeatMode(data.loop)
      })

  }, [])


  return (
    <SongsContext.Provider
      value={{
        currentSong: current,
        queue,
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
        historyMeta,
        playFrom,
        repeatMode,
        setRepeatMode: changeRepeatMode
      }}
    >
      {children}
    </SongsContext.Provider>
  )
}

export function useSongs() {
  return useContext(SongsContext)
}