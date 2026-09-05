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
  const playbackSongIdRef = useRef(null)
  const playbackGenerationRef = useRef(0)
  const queueGenerationRef = useRef(0)

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

    const previousCurrent = currentIdRef.current
    const nextCurrent = data.current

    if (
      queueSessionRef.current &&
      nextCurrent !== undefined
    ) {

      debugProgress(
        queueSessionRef.current,
        DEBUG_PROGRESS.QUEUE.UPDATE
      )
    }

    if (data.current !== undefined) {
      if (data.current !== currentIdRef.current) {
        setCurrentId(data.current)
      }
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

  const getSongMeta = async (id, session = null) => {

    if (songCache.current[id]) {

      if (session) {

        debugProgress(
          session,
          DEBUG_PROGRESS.PLAYBACK.META_CACHE_HIT
        )
      }

      return songCache.current[id]
    }

    if (session) {

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.META_REQUEST
      )
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

      if (session) {

        debugProgress(
          session,
          DEBUG_PROGRESS.PLAYBACK.META_LOADED
        )

      }
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
  const getStream = async (id, session = null) => {

    if (streamCache.current[id]) {

      if (session) {

        debugProgress(
          session,
          DEBUG_PROGRESS.PLAYBACK.STREAM_CACHE_HIT
        )

      }

      return streamCache.current[id]
    }

    if (session) {

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.STREAM_REQUEST
      )
    }

    try {

      const res =
        await authfetch(`/songs/${id}/stream`)

      if (!res.ok) {

        throw new Error(
          `HTTP ${res.status}`
        )

      }

      if (session) {
        debugProgress(
          session,
          DEBUG_PROGRESS.PLAYBACK.STREAM_RESPONSE
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

      if (session) {

        debugProgress(
          session,
          DEBUG_PROGRESS.PLAYBACK.STREAM_LOADED
        )
      }
      
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

    const id = currentId

    if (
      playbackSongIdRef.current === id &&
      playbackSessionRef.current
    ) {
      currentIdRef.current = id
      return
    }

    currentIdRef.current = id

    let cancelled = false

    const myLoadId= ++loadSongIdRef.current

    const generation = ++playbackGenerationRef.current

    const session = 
      debugStart(
        "PLAY",
        id
      )

    playbackSessionRef.current =session
    playbackSongIdRef.current = id

    debugProgress(
      session,
      DEBUG_PROGRESS.PLAYBACK.CURRENT
    )
    
    const load = async () => {

      const id = currentId

      try {
        const meta = await getSongMeta(id, session)

        let stream =
          nextCache.current[id] ||
          streamCache.current[id]
        
        if (stream) {

          debugProgress(
            session,
            DEBUG_PROGRESS.PLAYBACK.STREAM_CACHE_HIT
          )
        } else {

          stream = await getStream(
            id,
            session
          )
        }

        if (!stream) {
          stream = await getStream(id, session)
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

          debugProgress(
            session,
            DEBUG_PROGRESS.PLAYBACK.AUDIO_SRC_SET
          )

          audio.load()

          debugProgress(
            session,
            DEBUG_PROGRESS.PLAYBACK.AUDIO_LOAD
          )

          await Promise.race([
            new Promise(resolve => {

              if (audio.readyState >= 3) {
                debugProgress(
                  session,
                  DEBUG_PROGRESS.PLAYBACK.CANPLAY
                )
                resolve("ready")
                return
              }

              const handler = () => {
                audio.removeEventListener("canplay", handler)
                debugProgress(
                  session,
                  DEBUG_PROGRESS.PLAYBACK.CANPLAY
                )
                resolve("canplay")
              }

              audio.addEventListener("canplay", handler)

            }),

            new Promise(resolve => {
              setTimeout(() => {
                resolve("timeout")
              }, 5000)
            })
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
            
            const session =
              playbackSessionRef.current

            await audio.play()

            if (
              session &&
              playbackSessionRef.current ===session
            ) {
              debugProgress(
                playbackSessionRef.current,
                DEBUG_PROGRESS.PLAYBACK.PLAY_START
              )
            }

            setIsPlaying(true)

          } catch (e) {

            const details = {

              readyState: audio.readyState,

              networkState: audio.networkState,

              paused: audio.paused,

              ended: audio.ended,

              currentTime:
                Number.isFinite(audio.currentTime)
                  ? Number(audio.currentTime.toFixed(2))
                  : null,

              duration:
                Number.isFinite(audio.duration)
                  ? Number(audio.duration.toFixed(2))
                  : null,

              mediaErrorCode:
                audio.error?.code ?? null,

              mediaErrorMessage:
                audio.error?.message ?? null
            }

            debugError(
              "PLAYBACK",
              DEBUG_ERROR.PLAYBACK.PLAY,
              e,
              id,
              details
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
        queueIds.slice(0, 20).map(id => getSongMeta(id))
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

          const session =
            playbackSessionRef.current

          const details = {

            readyState:
              audio.readyState,

            networkState:
              audio.networkState,

            paused:
              audio.paused,

            ended:
              audio.ended,

            currentTime:
              Number.isFinite(audio.currentTime)
                ? Number(audio.currentTime.toFixed(2))
                : null,

            duration:
              Number.isFinite(audio.duration)
                ? Number(audio.duration.toFixed(2))
                : null,

            mediaErrorCode:
              audio.error?.code ?? null,

            mediaErrorMessage:
              audio.error?.message ?? null
          }

          debugError(
            "PLAYBACK",
            DEBUG_ERROR.PLAYBACK.PLAY,
            e,
            currentIdRef.current,
            details
          )

          setIsPlaying(false)

        })

    } else {

      audio.pause()

    }

  }, [isPlaying])

  /* =========================
    AUDIO DEBUG EVENTS
  ========================= */

  useEffect(() => {

    const audio = audioRef.current

    if (!audio) return

    const getSession = () => {

      const session =
        playbackSessionRef.current

      return session || null
    }


    const getDetails = () => {

      const mediaError = audio.error

      return {

        readyState: audio.readyState,

        networkState: audio.networkState,

        paused: audio.paused,

        ended: audio.ended,

        currentTime:
          Number.isFinite(audio.currentTime)
            ? Number(audio.currentTime.toFixed(2))
            : null,

        duration:
          Number.isFinite(audio.duration)
            ? Number(audio.duration.toFixed(2))
            : null,

        errorCode:
          mediaError?.code ?? null,

        errorMessage:
          mediaError?.message ?? null,

        srcExists:
          !!audio.src,

        src:
          audio.src
            ? audio.src.split("?")[0]
            : null,

        crossOrigin:
          audio.crossOrigin || null,

        volume:
          audio.volume,

        muted:
          audio.muted,

        playbackRate:
          audio.playbackRate,

        defaultPlaybackRate:
          audio.defaultPlaybackRate
      }
    }

    const onLoadStart = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.LOADSTART,
        getDetails()
      )
    }


    const onLoadedMetadata = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.LOADEDMETADATA,
        getDetails()
      )
    }


    const onLoadedData = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.LOADEDDATA,
        getDetails()
      )
    }


    const onDurationChange = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.DURATIONCHANGE,
        getDetails()
      )
    }


    const onCanPlay = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.CANPLAY,
        getDetails()
      )
    }


    const onCanPlayThrough = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.CANPLAYTHROUGH,
        getDetails()
      )
    }


    const onPlay = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.PLAY_EVENT,
        getDetails()
      )
    }


    const onPlaying = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.PLAYING_EVENT,
        getDetails()
      )
    }


    const onPause = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.PAUSE,
        getDetails()
      )
    }


    const onWaiting = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.WAITING,
        getDetails()
      )
    }


    const onStalled = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.STALLED,
        getDetails()
      )
    }


    const onSuspend = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.SUSPEND,
        getDetails()
      )
    }


    const onSeeking = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.SEEKING,
        getDetails()
      )
    }


    const onSeeked = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.SEEKED,
        getDetails()
      )
    }


    const onAbort = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.ABORT,
        getDetails()
      )
    }


    const onEmptied = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.EMPTIED,
        getDetails()
      )
    }


    const onError = () => {

      const session = getSession()

      const details = getDetails()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.ERROR_EVENT,
        details
      )

      let message =
        details.errorMessage ||
        "Unknown media error"

      if (details.errorCode === 1) {
        message = "MEDIA_ERR_ABORTED"
      }

      if (details.errorCode === 2) {
        message = "MEDIA_ERR_NETWORK"
      }

      if (details.errorCode === 3) {
        message = "MEDIA_ERR_DECODE"
      }

      if (details.errorCode === 4) {
        message = "MEDIA_ERR_SRC_NOT_SUPPORTED"
      }

      const error = new Error(message)

      error.name = "MediaError"

      debugError(
        "PLAYBACK",
        DEBUG_ERROR.PLAYBACK.AUDIO,
        error,
        currentIdRef.current,
        details
      )
    }


    audio.addEventListener(
      "loadstart",
      onLoadStart
    )

    audio.addEventListener(
      "loadedmetadata",
      onLoadedMetadata
    )

    audio.addEventListener(
      "loadeddata",
      onLoadedData
    )

    audio.addEventListener(
      "durationchange",
      onDurationChange
    )

    audio.addEventListener(
      "canplay",
      onCanPlay
    )

    audio.addEventListener(
      "canplaythrough",
      onCanPlayThrough
    )

    audio.addEventListener(
      "play",
      onPlay
    )

    audio.addEventListener(
      "playing",
      onPlaying
    )

    audio.addEventListener(
      "pause",
      onPause
    )

    audio.addEventListener(
      "waiting",
      onWaiting
    )

    audio.addEventListener(
      "stalled",
      onStalled
    )

    audio.addEventListener(
      "suspend",
      onSuspend
    )

    audio.addEventListener(
      "seeking",
      onSeeking
    )

    audio.addEventListener(
      "seeked",
      onSeeked
    )

    audio.addEventListener(
      "abort",
      onAbort
    )

    audio.addEventListener(
      "emptied",
      onEmptied
    )

    audio.addEventListener(
      "error",
      onError
    )


    return () => {

      audio.removeEventListener(
        "loadstart",
        onLoadStart
      )

      audio.removeEventListener(
        "loadedmetadata",
        onLoadedMetadata
      )

      audio.removeEventListener(
        "loadeddata",
        onLoadedData
      )

      audio.removeEventListener(
        "durationchange",
        onDurationChange
      )

      audio.removeEventListener(
        "canplay",
        onCanPlay
      )

      audio.removeEventListener(
        "canplaythrough",
        onCanPlayThrough
      )

      audio.removeEventListener(
        "play",
        onPlay
      )

      audio.removeEventListener(
        "playing",
        onPlaying
      )

      audio.removeEventListener(
        "pause",
        onPause
      )

      audio.removeEventListener(
        "waiting",
        onWaiting
      )

      audio.removeEventListener(
        "stalled",
        onStalled
      )

      audio.removeEventListener(
        "suspend",
        onSuspend
      )

      audio.removeEventListener(
        "seeking",
        onSeeking
      )

      audio.removeEventListener(
        "seeked",
        onSeeked
      )

      audio.removeEventListener(
        "abort",
        onAbort
      )

      audio.removeEventListener(
        "emptied",
        onEmptied
      )

      audio.removeEventListener(
        "error",
        onError
      )

    }

  }, [])

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

          const session =
            playbackSessionRef.current

          if (session) {
            debugProgress(
              playbackSessionRef.current,
              DEBUG_PROGRESS.PLAYBACK.HALF
            )
          } 

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

    const generation = ++queueGenerationRef.current

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

      debugProgress(
        session,
        DEBUG_PROGRESS.QUEUE.GENERATE
      )

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

      debugProgress(
        session,
        DEBUG_PROGRESS.QUEUE.FIRST_PLAY
      )

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

      const session =
        playbackSessionRef.current
      
      const endedSongId =
        playbackSongIdRef.current

      if (session) {

        replaceWithComplete(
          session,
          DEBUG_PROGRESS.PLAYBACK.COMPLETE
        )
      }

      playbackSessionRef.current = null
      playbackSongIdRef.current = null

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