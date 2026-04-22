import { createContext, useContext, useEffect, useRef, useState } from "react"
import API_BASE from "../api"

const SongsContext = createContext()

export function SongsProvider({ children }) {

  /* =========================
     🔥 AUDIO（強化）
  ========================= */
  const audioRef = useRef(new Audio()) // ←ここ変更（超重要）

  /* =========================
     STATE（そのまま維持）
  ========================= */
  const [currentId, setCurrentId] = useState(null)
  const [queueIds, setQueueIds] = useState([])
  const [current, setCurrent] = useState(null)
  const [queue, setQueue] = useState([])
  const [history, setHistory] = useState([])
  const [historyMeta, setHistoryMeta] = useState([])

  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [homeData, setHomeData] = useState(null)

  const streamCache = useRef({})
  const songCache = useRef({})
  const playedRef = useRef(null)
  const countedRef = useRef({})
  const userInteracted = useRef(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const songIdAtStart = currentId

    const handleTimeUpdate = () => {
      if (!songIdAtStart) return

      if (
        !countedRef.current[songIdAtStart] &&
        audio.currentTime >= 30
      ) {
        fetch(`${API_BASE}/songs/${songIdAtStart}/play`, {
          method: "POST"
        }).catch(()=>{})

        countedRef.current[songIdAtStart] = true
      }
    }

    const handleEnded = () => {
      if (
        !countedRef.current[songIdAtStart] &&
        songIdAtStart
      ) {
        fetch(`${API_BASE}/songs/${songIdAtStart}/play`, {
          method: "POST"
        }).catch(()=>{})

        countedRef.current[songIdAtStart] = true
      }
    }

    audio.addEventListener("timeupdate", handleTimeUpdate)

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
    }

  }, [currentId])

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
    if (streamCache.current[id]) return streamCache.current[id]

    const res = await fetch(`${API_BASE}/songs/${id}/stream`)
    const data = await res.json()

    streamCache.current[id] = data.stream_url
    return data.stream_url
  }

  /* =========================
     🔥 QUEUE（サーバー同期）
  ========================= */
  const loadQueue = async () => {
    try {
      const res = await fetch(`${API_BASE}/queue`)
      const data = await res.json()

      // 🔥 current変わった時だけ更新
      if (data.current !== currentId) {
        setCurrentId(data.current || null)
      }

      setQueueIds(data.queue || [])
    } catch (e) {
      console.error("queue load error", e)
    }
  }

  /* =========================
     INIT
  ========================= */
  useEffect(() => {
    loadQueue()

    // 🔥 スマホ対策（audio unlock）
    const unlock = () => {
      const a = audioRef.current
      a.play().then(() => a.pause()).catch(() => {})
      document.removeEventListener("click", unlock)
    }

    document.addEventListener("click", unlock)

  }, [])

  /* =========================
     CURRENT LOAD
  ========================= */
  useEffect(() => {

    if (!currentId) return

    let cancelled = false

    const load = async () => {

      const [meta, stream] = await Promise.all([
        getSongMeta(currentId),
        getStream(currentId)
      ])

      if (cancelled) return

      const song = { ...meta, url: stream }

      setCurrent(song)

      const audio = audioRef.current

      if (!audio.src || !audio.src.includes(stream)) {
        audio.src = stream
      }

      audio.play().catch(() => {})

    }

    load()
    return () => { cancelled = true }
    

  }, [currentId])

  /* =========================
     QUEUE LOAD（軽量）
  ========================= */
  useEffect(() => {

    if (!queueIds.length) {
      setQueue([])
      return
    }

    let cancelled = false

    const load = async () => {

      const arr = []

      // 🔥 ① 最初の20曲 → 優先ロード
      const priority = queueIds.slice(0, 20)

      const firstBatch = await Promise.all(
        priority.map(id => getSongMeta(id))
      )

      if (cancelled) return

      setQueue(firstBatch)

      // 🔥 ② 残りはバックグラウンド
      const rest = queueIds.slice(20)

      for (let i = 0; i < rest.length; i++) {

        if (cancelled) return

        const meta = await getSongMeta(rest[i])
        arr.push(meta)

        // 🔥 少しずつ反映（軽量）
        if (i % 5 === 0) {
          setQueue(prev => [...prev, ...arr])
          arr.length = 0
        }

        // 🔥 UIに処理を返す（超重要）
        await new Promise(r => setTimeout(r, 0))
      }

      setQueue(prev => [...prev, ...arr])
    }

    load()

    return () => { cancelled = true }

  }, [queueIds])


  /* =========================
     AUDIO CONTROL
  ========================= */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    isPlaying ? audio.play().catch(() => {}) : audio.pause()

  }, [isPlaying])

  /* =========================
     🔥 NEXT（サーバー基準）
  ========================= */
  const nextSong = async () => {

    if (current) {
      setHistory(prev => {
        const next = [
          ...prev,
          {
            song_id: current.song_id,
            played_at: Date.now()
          }
        ]

        return next.slice(-50) // 制限
      })
    }

    try {
      const res = await fetch(`${API_BASE}/queue/next`, {
        method: "POST"
      })

      const data = await res.json()

      if (data.song_id) {
        setCurrentId(data.song_id)
        setIsPlaying(true)

        if(data.queue){
          setQueueIds(data.queue)
        }else{
          loadQueue() // 変更：サーバーから新しいキューを取得
        }
      }

    } catch (e) {
      console.error(e)
    }


  }

  /* =========================
     PREV（サーバー）
  ========================= */
  const prevSong = () => {

    setHistory(prev => {

      if (!prev.length) return prev

      const last = prev[prev.length - 1]

      setCurrentId(last.song_id)

      return prev.slice(0, -1)
    })
  }

  /* =========================
     PLAY
  ========================= */
  const playSong = async (song) => {

    const id = song.song_id || song.id

    // 🔥 currentをhistoryへ（軽量版）
    if (current) {
      setHistory(prev => {
        const next = [
          ...prev,
          {
            song_id: current.song_id,
            played_at: Date.now()
          }
        ]
        return next.slice(-50)
      })
    }

    // 🔥 先にUIを確定させる
    setCurrentId(id)
    userInteracted.current = true
    setIsPlaying(true)

    // 🔥 後でサーバー同期（遅れてOK）
    fetch(`${API_BASE}/queue/play/${id}`, {
      method: "POST"
    }).catch(() => {})

    // ❌ loadQueueは消す（これが原因）
  }

  /* =========================
     SHUFFLE
  ========================= */
  const shuffleQueue = async () => {

    await fetch(`${API_BASE}/queue/shuffle`, {
      method: "POST"
    })

    loadQueue()
  }

  /* =========================
     🔥 END（最重要）
  ========================= */
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => nextSong()

    audio.addEventListener("ended", handleEnded)
    return () => audio.removeEventListener("ended", handleEnded)

  }, [])

  /* =========================
     PROGRESS
  ========================= */
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

    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)

  }, [current])

  /* =========================
     HISTORY
  ========================= */
  useEffect(() => {

    if (!history.length) {
      setHistoryMeta([])
      return
    }

    let cancelled = false

    const load = async () => {

      const arr = []

      const list = [...history]

      for (let i = 0; i < list.length; i++) {

        if (cancelled) return

        const meta = await getSongMeta(list[i].song_id)

        arr.push(meta)

        // 🔥 軽量逐次反映（UI止めない）
        if (i % 5 === 0) {
          setHistoryMeta(prev => [...arr])
          await new Promise(r => setTimeout(r, 0))
        }
      }

      setHistoryMeta(arr)
    }

    load()

    return () => { cancelled = true }

  }, [history])



  /* =========================
     QUEUE UPDATE
  ========================= */
  useEffect(() => {

    const handler = () => loadQueue()

    window.addEventListener("queueUpdated", handler)
    return () => window.removeEventListener("queueUpdated", handler)

  }, [])


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
      }}
    >
      {children}
    </SongsContext.Provider>
  )
}

export function useSongs() {
  return useContext(SongsContext)
}