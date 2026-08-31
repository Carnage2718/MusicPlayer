import { createContext, useContext, useEffect, useRef, useState } from "react"
import API_BASE, {
  authfetch
} from "../api"
import {
  debugStart,
  debugProgress,
  debugError,
  replaceWithComplete,
  DEBUG_PROGRESS,
  DEBUG_ERROR
} from "../utils/DebugLogger"


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

      if (!saved) return null

      const parsed = JSON.parse(saved)

      const SIX_HOURS =
        6 * 60 * 60 * 1000

      if (
        Date.now() - parsed.timestamp >
        SIX_HOURS
      ) {

        localStorage.removeItem(HOME_CACHE_KEY)

        return null
      }

      return parsed.data

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
  const queueLoadIdRef = useRef(0)
  const userInteracted = useRef(false)
  const preloadRef = useRef(new Audio())
  const isStartingRef = useRef(false)
  const [repeatMode, setRepeatMode] = useState("none")
  const changingTrackRef = useRef(false)
  const loadSongIdRef = useRef(0)

  const playbackSessionRef = useRef(null)
  const queueSessionRef = useRef(null)

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
        JSON.stringify({
          timestamp: Date.now(),
          data: homeData
        })
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
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])


  /* =========================
     QUEUE APPLY（最重要）
  ========================= */

  const applyQueue = (data, source = "unknown") => {

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
      .then(data => {

        applyQueue(data,"INIT")

        if (data.current) {
          userInteracted.current = true
          setIsPlaying(true)
        }
      })

  }, [])

  /* =========================
     SONG META
  ========================= */

  const getSongMeta = async (id) => {

    if (songCache.current[id]) {
      return songCache.current[id]
    }

    try{

      const res = 
        await authfetch(`/songs/${id}`)
      
        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status}`
          )
        }
      const data = 
        await res.json()

      const song = {
        song_id: id,
        title: data.title,
        artists: data.artists,
        image: data.cover,
        url: null
      }

      songCache.current[id] = song
      return song
    } catch (e) {

      debugError(
        "PLAYBACK",
        DEBUG_ERROR.PLAYBACK.META,
        e,
        id
      )

      throw e

    }
  }

  /* =========================
     STREAM
  ========================= */
  const getStream = async (id) => {

    if (streamCache.current[id]) {
      return streamCache.current[id]
    }

    try {

      const res =
        await authfetch(`/songs/${id}/stream`)

      if (!res.ok) {

        throw new Error(
          `HTTP ${res.status}`
        )

      }

      const data =
        await res.json()

      if (!data.stream_url) {

        throw new Error(
          "stream_url missing"
        )

      }

      streamCache.current[id] =
        data.stream_url

      return data.stream_url

    } catch (e) {

      debugError(
        "PLAYBACK",
        DEBUG_ERROR.PLAYBACK.STREAM,
        e,
        id
      )

      throw e

    }

  }

  /* =========================
     CURRENT
  ========================= */

  useEffect(() => {

    if (!currentId) {
      setCurrent(null)
      setProgress(0)
      return
    }
    setProgress(0)

    currentIdRef.current = currentId

    let cancelled = false

    const myLoadId= ++loadSongIdRef.current
    
    const load = async () => {

      const id = currentId

      const session = 
        debugStart("PLAYBACK", id)

      playbackSessionRef.current = session

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.LOADING
      )

      try {
        const meta = await getSongMeta(id)

        let stream =
          nextCache.current[id] ||
          streamCache.current[id]

        if (!stream) {
          stream = await getStream(id)
        }

        if (!stream) {

          throw new Error(
            "stream url unavailable"
          )
        }

        if (cancelled || id !== currentIdRef.current) {
          return
        }

        const audio = audioRef.current

        if (audio.src !== stream) {


          audio.pause()
          audio.currentTime = 0
          audio.src = stream
          audio.load()

          await Promise.race([
            new Promise(resolve => {

              if (audio.readyState >= 3) {
                resolve()
                return
              }

              const handler = () => {
                audio.removeEventListener("canplay", handler)
                resolve()
              }

              audio.addEventListener("canplay", handler)

            }),

            new Promise(resolve =>
              setTimeout(resolve, 5000)
            )
          ])
  
        }

        const song = { ...meta, url: stream }
        setCurrent(song)

        if (
          cancelled ||
          myLoadId !== loadSongIdRef.current
        ){
          return
        }

        if (userInteracted.current) {

          try {
            await audio.play()

            debugProgress(
              playbackSessionRef.current,
              DEBUG_PROGRESS.PLAYBACK.PLAY_START
            )
            setIsPlaying(true)

          } catch (e) {

            debugError(
              "PLAYBACK",
              DEBUG_ERROR.PLAYBACK.PLAY,
              e,
              id
            )

            setIsPlaying(false)

          }
        }
      } catch (e) {

        debugError(
          "PLAYBACK",
          DEBUG_ERROR.PLAYBACK.META,
          e,
          id
        )
        setIsPlaying(false)
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

    queueLoadIdRef.current += 1

    const loadId = queueLoadIdRef.current

    if (!queueIds.length) {
      setQueue([])
      return
    }

    const load = async () => {

      const first = await Promise.all(
        queueIds.slice(0, 20).map(getSongMeta)
      )

      if (loadId !== queueLoadIdRef.current) return

      setQueue(first)

      const rest = queueIds.slice(20)

      for (let id of rest) {

        // 🔥 毎回チェック
        if (loadId !== queueLoadIdRef.current) {
          return
        }

        const meta = await getSongMeta(id)

        // 🔥 await後もチェック
        if (loadId !== queueLoadIdRef.current) {
          return
        }

        setQueue(prev => [...prev, meta])

        await new Promise(r => setTimeout(r, 0))
      }
    }

    load()

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

      audio.play()
        .catch(e => {
          setIsPlaying(false)
        })

    } else {
      audio.pause()
    }

  }, [isPlaying])

  /* =========================
     PROGRESS
  ========================= */

  useEffect(() => {

    const audio = audioRef.current
    if (!audio) return

    const onTimeUpdate = () => {

      if (audio.duration) {
        const percent =
          (audio.currentTime / audio.duration) * 100

        setProgress(percent)

        if (
          !countedRef.current &&
          currentId &&
          percent >= 50
        ) {

          countedRef.current = true

          debugProgress(
            playbackSessionRef.current,
            DEBUG_PROGRESS.PLAYBACK.HALF
          )

          authfetch(
            `/songs/${currentId}/play`,
            { method:"POST" }
          )
          .then(loadHistory)
          .catch(e => {
            debugError(
              "PLAYBACK",
              DEBUG_ERROR.PLAYBACK.HALF,
              e,
              currentId
            )
          })

        }

      } else {

        setProgress(0)

      }
    }

    audio.addEventListener(
      "timeupdate",
      onTimeUpdate
    )

    return () => {

      audio.removeEventListener(
        "timeupdate",
        onTimeUpdate
      )

    }

  }, [currentId])

  /* =========================
     NEXT
  ========================= */

  const nextSong = async ({
    ignoreRepeatOne = false
  } = {}) => {

    const session =
      debugStart(
        "QUEUE",
        currentIdRef.current
      )

    queueSessionRef.current = session

    debugProgress(
      session,
      DEBUG_PROGRESS.QUEUE.REQUEST
    )

    try {

      const res =  await authfetch(
        `/queue/next?ignore_repeat_one=${ignoreRepeatOne}`, 
        {
          method: "POST"
        }
      )

      if (!res.ok) {

        throw new Error(
          `HTTP ${res.status}`
        )
      }

      debugProgress(
        session,
        DEBUG_PROGRESS.QUEUE.RESPONSE
      )

      const data = await res.json()

      if (data.restart) {

        const audio = audioRef.current

        audio.currentTime = 0

        try {
          await audio.play()

          setIsPlaying(true)

        } catch (e) {

          debugError(
            "PLAYBACK",
            DEBUG_ERROR.PLAYBACK.PLAY,
            e,
            currentIdRef.current
          )

          setIsPlaying(false)
        }

        replaceWithComplete(
          session,
          DEBUG_PROGRESS.QUEUE.COMPLETE
        )

        queueSessionRef.current = null

        return
      }

      applyQueue(data, "NEXT")

      debugProgress(
        session,
        DEBUG_PROGRESS.QUEUE.APPLY
      )
      
      if(!data.current){

        const audio = audioRef.current
        
        audio.pause()
        audio.currentTime = 0

        setIsPlaying(false)

        replaceWithComplete(
          session,
          DEBUG_PROGRESS.QUEUE.COMPLETE
        )

        queueSessionRef.current = null

        return
      }

      replaceWithComplete(
        session,
        DEBUG_PROGRESS.QUEUE.COMPLETE
      )

      queueSessionRef.current = null

    } catch (e) {

      debugError(
        "QUEUE",
        DEBUG_ERROR.QUEUE.REQUEST,
        e,
        currentIdRef.current
      )

      queueSessionRef.current = null

    }
      

  }


  /* =========================
     PREV
  ========================= */

  const prevSong = async () => {

    try{

      const res = await authfetch("/queue/previous", {
        method: "POST"
      })

      const data = await res.json()

      applyQueue(data, "PREV")

    } catch (e) {

      debugError(
        "QUEUE",
        DEBUG_ERROR.QUEUE.REQUEST,
        e,
        "previous"
      )
    }
  }

  /* =========================
     PLAY
  ========================= */

  const playSong = async (song) => {

    const id = song.song_id || song.id

    const session =
      debugStart(
        "PLAY_ACTION",
        id
      )

    debugProgress(
      session,
      DEBUG_PROGRESS.PLAY_ACTION.REQUEST
    )

    try {

      userInteracted.current = true

      const res = await authfetch(
        `/queue/play/${id}`,
        {
          method: "POST"
        }
      )

      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status}`
        )
      }

      const data = await res.json()

      audioRef.current.pause()

      applyQueue(data, "PLAY_SONG")

      setProgress(0)

      if (data.current){
        setCurrent({
          song_id:data.current,
          title:"Loading...",
          artists: [],
          image: null
        })
      }

      replaceWithComplete(
        session,
        DEBUG_PROGRESS.PLAY_ACTION.COMPLETE
      )
    } catch (e) {

      debugError(
        "PLAY_ACTION",
        DEBUG_ERROR.PLAY_ACTION.REQUEST,
        e,
        id
      )
    }
  }

  /* =========================
     SHUFFLE
  ========================= */

  const shuffleQueue = async () => {

    const session =
    debugStart(
      "SHUFFLE",
      "queue"
    )

    debugProgress(
      session,
      DEBUG_PROGRESS.SHUFFLE.REQUEST
    )

    try{
      const res = await authfetch("/queue/shuffle", {
        method: "POST"
      })

      if (!res.ok) {
        throw new Error(
          `HTTP ${res.status}`
        )
      }

      const data = await res.json()

      applyQueue(data, "SHUFFLE")

      replaceWithComplete(
        session,
        DEBUG_PROGRESS.SHUFFLE.COMPLETE
      )
    } catch (e) {

      debugError(
        "SHUFFLE",
        DEBUG_ERROR.SHUFFLE.REQUEST,
        e,
        "queue"
      )
    }
  }

  /* =========================
     MENU COMPONENT
  ========================= */

  useEffect(() => {

    const handler = (e) => {
      applyQueue(e.detail, "QUEUE_EVENT")
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

      if (changingTrackRef.current) return

      replaceWithComplete(
        playbackSessionRef.current,
        DEBUG_PROGRESS.PLAYBACK.COMPLETE
      )

      playbackSessionRef.current = null

      changingTrackRef.current = true

      try {

        await nextSong()

      } finally {

        setTimeout(() => {
          changingTrackRef.current = false
        }, 300)

      }
    }

    audio.addEventListener("ended",ended)

    return () => audio.removeEventListener("ended", ended)

  }, [])


  const changeRepeatMode = async (mode) => {

    setRepeatMode(mode)

    try {

      await authfetch(`/queue/mode?loop=${mode}`, {
        method: "POST"
      })

    } catch (e) {
    }
  }


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

      applyQueue(data, "PLAY_FROM")
      setProgress(0)

    } catch (e) {

      debugError(
        "QUEUE",
        DEBUG_ERROR.PLAY_FROM.REQUEST,
        e,
        endpoint
      )

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

    const audio = audioRef.current

    if (!audio) return

    if (!("mediaSession" in navigator)) return

    const onPlay = () => {
      navigator.mediaSession.playbackState = "playing"
    }

    const onPause = () => {
      navigator.mediaSession.playbackState = "paused"
    }

    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)

    return () => {

      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)

    }

  }, [])

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