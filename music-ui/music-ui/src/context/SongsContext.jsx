import { createContext, useContext, useEffect, useRef, useState } from "react"
import API_BASE, { authfetch} from "../api"

import {
  debugStart,
  debugProgress,
  debugError,
  replaceWithComplete,
  DEBUG_PROGRESS,
  DEBUG_ERROR,
  getAudioDebugDetails,
  getAudioDebugState
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
        id,
        null,
        session
      )

      throw e

    }
  }

  
  /* =========================
    PAUSE DEBUG
  ========================= */

  const pauseAudio = (reason) => {

    const audio = audioRef.current

    if (!audio) return

    const session =
      playbackSessionRef.current

    debugProgress(
      session,
      DEBUG_PROGRESS.PLAYBACK.PLAY_PAUSE_REQUEST,
      {
        reason,

        currentId:
          currentIdRef.current,

        generation:
          playbackGenerationRef.current,

        paused:
          audio.paused,

        ended:
          audio.ended,

        readyState:
          audio.readyState,

        networkState:
          audio.networkState,

        currentTime:
          Number.isFinite(audio.currentTime)
            ? Number(audio.currentTime.toFixed(2))
            : null,

        duration:
          Number.isFinite(audio.duration)
            ? Number(audio.duration.toFixed(2))
            : null
      }
    )

    audio.pause()
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
        id,
        null,
        session
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
        id,
        {
          generation,
          loadId: myLoadId
        }
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

        debugProgress(
          session,
          DEBUG_PROGRESS.PLAYBACK.SOURCE_CHECK,
          {
            ...getAudioDebugState(audio),

            generation,
            loadId: myLoadId,
            currentId: id,

            streamExists: !!stream,

            streamType:
              typeof stream,

            streamLength:
              typeof stream === "string"
                ? stream.length
                : null
          }
        )

        if (audio.src !== stream) {


          pauseAudio("before src change")
          audio.currentTime = 0
          audio.src = stream

          debugProgress(
            session,
            DEBUG_PROGRESS.PLAYBACK.AUDIO_SRC_SET,
            {
              generation,

              loadId: myLoadId,

              currentId: id,

              src:
                audio.src
                  ? audio.src.split("?")[0]
                  : null,

              currentSrc:
                audio.currentSrc
                  ? audio.currentSrc.split("?")[0]
                  : null,

              readyState:
                audio.readyState,

              networkState:
                audio.networkState,

              paused:
                audio.paused,

              ended:
                audio.ended,

              mediaErrorCode:
                audio.error?.code ?? null,

              mediaErrorMessage:
                audio.error?.message ?? null
            }
          )

          audio.load()

          debugProgress(
            session,
            DEBUG_PROGRESS.PLAYBACK.AUDIO_LOAD,
            {
              generation,

              loadId: myLoadId,

              currentId: id,

              src:
                audio.src
                  ? audio.src.split("?")[0]
                  : null,

              currentSrc:
                audio.currentSrc
                  ? audio.currentSrc.split("?")[0]
                  : null,

              readyState:
                audio.readyState,

              networkState:
                audio.networkState,

              paused:
                audio.paused,

              ended:
                audio.ended,

              mediaErrorCode:
                audio.error?.code ?? null,

              mediaErrorMessage:
                audio.error?.message ?? null
            }
          )

          const loadResult = await Promise.race([
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

          if (loadResult === "timeout") {

            debugError(
              "PLAYBACK",
              DEBUG_ERROR.PLAYBACK.AUDIO,
              new Error("canplay timeout"),
              id,
              {
                generation,
                loadId: myLoadId,
                currentId: id,
                waitResult: "timeout",
                readyState: audio.readyState,
                networkState: audio.networkState,
                paused: audio.paused,
                mediaErrorCode:
                  audio.error?.code ?? null,
                mediaErrorMessage:
                  audio.error?.message ?? null
              },
              session,
              audio
            )

            setIsPlaying(false)
            return

          }
  
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

          const playDetails = {

            reason: "currentId effect",

            generation,

            currentId: id,

            paused:
              audio.paused,

            ended:
              audio.ended,

            readyState:
              audio.readyState,

            networkState:
              audio.networkState,

            currentTime:
              Number.isFinite(audio.currentTime)
                ? Number(
                    audio.currentTime.toFixed(2)
                  )
                : null,

            duration:
              Number.isFinite(audio.duration)
                ? Number(
                    audio.duration.toFixed(2)
                  )
                : null,

            mediaErrorCode:
              audio.error?.code ?? null,

            mediaErrorMessage:
              audio.error?.message ?? null
          }

          debugProgress(
            session,
            DEBUG_PROGRESS.PLAYBACK.PLAY_REQUEST,
            playDetails
          )

          try {

            await audio.play()

            /*
            * play() Promise 成功
            */

            debugProgress(
              session,
              DEBUG_PROGRESS.PLAYBACK.PLAY_PROMISE_RESOLVED,
              {
                ...playDetails,

                paused:
                  audio.paused,

                readyState:
                  audio.readyState,

                networkState:
                  audio.networkState,

                currentTime:
                  Number.isFinite(audio.currentTime)
                    ? Number(
                        audio.currentTime.toFixed(2)
                      )
                    : null
              }
            )

            /*
            * 実際に play() が成功した
            */

            debugProgress(
              session,
              DEBUG_PROGRESS.PLAYBACK.PLAY_START
            )

            setIsPlaying(true)

          } catch (e) {

            /*
            * play() Promise 失敗
            */

            debugProgress(
              session,
              DEBUG_PROGRESS.PLAYBACK.PLAY_PROMISE_REJECTED,
              {
                ...playDetails,

                errorName:
                  e?.name || null,

                errorMessage:
                  e?.message || String(e),

                paused:
                  audio.paused,

                ended:
                  audio.ended,

                readyState:
                  audio.readyState,

                networkState:
                  audio.networkState,

                currentTime:
                  Number.isFinite(audio.currentTime)
                    ? Number(
                        audio.currentTime.toFixed(2)
                      )
                    : null,

                duration:
                  Number.isFinite(audio.duration)
                    ? Number(
                        audio.duration.toFixed(2)
                      )
                    : null,

                mediaErrorCode:
                  audio.error?.code ?? null,

                mediaErrorMessage:
                  audio.error?.message ?? null
              }
            )

            /*
            * PLAY ERROR
            */

            debugError(
              "PLAYBACK",
              DEBUG_ERROR.PLAYBACK.PLAY,
              e,
              id,
              {
                ...playDetails,

                audio:
                  getAudioDebugDetails(audio),

                errorName:
                  e?.name || null,

                errorMessage:
                  e?.message || String(e)
              },
              session,
              audio
            )

            setIsPlaying(false)

          }
        }
      } catch (e) {

        debugError(
          "PLAYBACK",
          DEBUG_ERROR.PLAYBACK.AUDIO,
          e,
          id,
          {
            generation,
            loadId: myLoadId,
            errorName:
              e?.name || null,
            errorMessage:
              e?.message || String(e),
            currentId:
              currentIdRef.current
          },
          session,
          audioRef.current
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

      if (!audio.paused) return

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
              details,
              session
            )

            setIsPlaying(false)

          })

    } else {

      if (audio.paused) return

      pauseAudio("isPlaying=false effect")

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

      const getRanges = range => {

        try {

          const result = []

          for (
            let i = 0;
            i < range.length;
            i++
          ) {

            result.push({

              start:
                Number(
                  range.start(i).toFixed(2)
                ),

              end:
                Number(
                  range.end(i).toFixed(2)
                )

            })

          }

          return result

        } catch {

          return []

        }

      }


      return {

        /* =====================
          MEDIA STATE
        ===================== */

        readyState:
          audio.readyState,

        networkState:
          audio.networkState,

        paused:
          audio.paused,

        ended:
          audio.ended,

        seeking:
          audio.seeking,

        autoplaying:
          audio.autoplay,

        /* =====================
          POSITION
        ===================== */

        currentTime:
          Number.isFinite(audio.currentTime)
            ? Number(
                audio.currentTime.toFixed(2)
              )
            : null,

        duration:
          Number.isFinite(audio.duration)
            ? Number(
                audio.duration.toFixed(2)
              )
            : null,

        /* =====================
          BUFFER
        ===================== */

        buffered:
          getRanges(audio.buffered),

        seekable:
          getRanges(audio.seekable),

        /* =====================
          ERROR
        ===================== */

        errorCode:
          mediaError?.code ?? null,

        errorMessage:
          mediaError?.message ?? null,

        /* =====================
          SOURCE
        ===================== */

        srcExists:
          !!audio.src,

        src:
          audio.src
            ? audio.src.split("?")[0]
            : null,

        currentSrc:
          audio.currentSrc
            ? audio.currentSrc.split("?")[0]
            : null,

        /* =====================
          AUDIO CONFIG
        ===================== */

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

      const queueSession =
        queueSessionRef.current

      if (
        queueSession &&
        queueSession.details?.expectedSongId ===
          currentIdRef.current
      ) {

        debugProgress(
          queueSession,
          DEBUG_PROGRESS.QUEUE.FIRST_PLAY,
          {
            songId: currentIdRef.current
          }
        )

        replaceWithComplete(
          queueSession,
          DEBUG_PROGRESS.QUEUE.COMPLETE
        )

        queueSessionRef.current = null
      }
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

    const onEnded = () => {

      const session = getSession()

      debugProgress(
        session,
        DEBUG_PROGRESS.PLAYBACK.ENDED,
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
        details,
        session
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
      "ended",
      onEnded
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
        "ended",
        onEnded
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

            const session =
              playbackSessionRef.current

            debugError(
              "PLAYBACK",
              DEBUG_ERROR.PLAYBACK.HALF,
              e,
              currentId,
              {
                currentId,

                currentTime:
                  Number.isFinite(audio.currentTime)
                    ? Number(
                        audio.currentTime.toFixed(2)
                      )
                    : null,

                duration:
                  Number.isFinite(audio.duration)
                    ? Number(
                        audio.duration.toFixed(2)
                      )
                    : null,

                readyState:
                  audio.readyState,

                networkState:
                  audio.networkState
              },
              session
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

      session.details = {
        ...(session.details || {}),
        generation,
        ignoreRepeatOne,
        expectedSongId:
          data.current ?? currentIdRef.current
      }

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
            currentIdRef.current,
            {
              reason: "nextSong restart",

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
                  ? Number(
                      audio.currentTime.toFixed(2)
                    )
                  : null,

              duration:
                Number.isFinite(audio.duration)
                  ? Number(
                      audio.duration.toFixed(2)
                    )
                  : null,

              mediaErrorCode:
                audio.error?.code ?? null,

              mediaErrorMessage:
                audio.error?.message ?? null
            },
            session
          )

          debugError(
            "QUEUE",
            DEBUG_ERROR.QUEUE.RESTART_PLAY,
            e,
            currentIdRef.current,
            {
              reason: "nextSong restart"
            },
            session,
            audio
          )

          queueSessionRef.current = null

          setIsPlaying(false)

          return
        }

        return
      }

      applyQueue(data, "NEXT")
      
      if(!data.current){

        const audio = audioRef.current
        
        pauseAudio("no current after next")
        audio.currentTime = 0

        setIsPlaying(false)

        replaceWithComplete(
          session,
          DEBUG_PROGRESS.QUEUE.COMPLETE
        )

        queueSessionRef.current = null

        return
      }

      return

    } catch (e) {

      debugError(
        "QUEUE",
        DEBUG_ERROR.QUEUE.REQUEST,
        e,
        currentIdRef.current,
        {
          generation,

          errorName:
            e?.name || null,

          errorMessage:
            e?.message || String(e)
        },
        session
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
        "previous",
        null,
        null
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

      pauseAudio("playSong before queue apply")

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
        id,
        {
          errorName:
            e?.name || null,

          errorMessage:
            e?.message || String(e)
        },
        session
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
        "queue",
        {
          errorName:
            e?.name || null,

          errorMessage:
            e?.message || String(e)
        },
        session
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

      if (
        session &&
        playbackSongIdRef.current === endedSongId
      ) {

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

    const session =
      debugStart(
        "PLAY_FROM",
        endpoint
      )

    debugProgress(
      session,
      DEBUG_PROGRESS.PLAY_ACTION.REQUEST,
      {
        endpoint
      }
    )

    try {

      userInteracted.current = true

      const res = await authfetch(
        endpoint.replace(API_BASE, ""),
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

      const firstId = data.current

      if (!firstId) {
        throw new Error(
          "playFrom response has no current"
        )
      }

      applyQueue(data, "PLAY_FROM")

      setProgress(0)

      replaceWithComplete(
        session,
        DEBUG_PROGRESS.PLAY_ACTION.COMPLETE
      )

    } catch (e) {

      debugError(
        "PLAY_FROM",
        DEBUG_ERROR.PLAY_FROM.REQUEST,
        e,
        endpoint,
        {
          errorName:
            e?.name || null,

          errorMessage:
            e?.message || String(e)
        },
        session
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

    navigator.mediaSession.setActionHandler(
      "play",
      async () => {

        const audio = audioRef.current

        if (!audio) return

        const session =
          playbackSessionRef.current

        debugProgress(
          session,
          DEBUG_PROGRESS.PLAYBACK.PLAY_REQUEST, 
          {
            ...getAudioDebugState(audio),
            reason: "mediaSession play",

            currentId:
              currentIdRef.current,

            readyState:
              audio.readyState,

            networkState:
              audio.networkState,

            paused:
              audio.paused,

            ended:
              audio.ended
          }
        )

        try {

          await audio.play()

          debugProgress(
            session,
            DEBUG_PROGRESS.PLAYBACK.PLAY_PROMISE_RESOLVED,
            {
              reason: "mediaSession play"
            }
          )

          setIsPlaying(true)

        } catch (e) {

          debugProgress(
            session,
            DEBUG_PROGRESS.PLAYBACK.PLAY_PROMISE_REJECTED,
            {
              reason: "mediaSession play",

              errorName:
                e?.name || null,

              errorMessage:
                e?.message || String(e)
            }
          )

          debugError(
            "PLAYBACK",
            DEBUG_ERROR.PLAYBACK.PLAY,
            e,
            currentIdRef.current,
            null,
            session
          )

          setIsPlaying(false)

        }

      }
    )

    navigator.mediaSession.setActionHandler("pause", () => {
      pauseAudio("mediaSession pause")
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