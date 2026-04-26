import { useState, useEffect, useRef } from "react"
import { Play, Shuffle, GripVertical } from "lucide-react"
import AppHeader from "../components/AppHeader"
import "./PlaylistScreen.css"
import SongCard from "../components/SongCard"
import API_BASE from "../api"

export default function PlaylistScreen({
  playlist,
  onSelectSong,
  onOpenArtist
}){

  const [tracks,setTracks] = useState([])
  const [isShuffle, setIsShuffle] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dragIndex, setDragIndex] = useState(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [dragY, setDragY] = useState(0)
  const dragRef = useRef(null)
  const [deleteMode, setDeleteMode] = useState(null)
  const lastTap = useRef(0)

  if(!playlist) return null

  useEffect(()=>{
    if(playlist?.songs){
      setTracks(playlist.songs)
    }
  },[playlist])

  useEffect(()=>{
    if(!playlist) return

    const fetchPlaylist = async ()=>{
      try{
        const res = await fetch(`${API_BASE}/playlists/${playlist.id}`)
        const data = await res.json()

        setTracks(data.songs || [])
      }catch(e){
        console.error(e)
      }
    }

    fetchPlaylist()
  },[playlist])

  useEffect(()=>{
    const timer = setTimeout(()=>{
      if(searchQuery){
        searchSongs(searchQuery)
      }
    },300)

    return ()=>clearTimeout(timer)
  },[searchQuery])

  useEffect(()=>{
    setSelectedIndex(0)
  },[searchResults])

  useEffect(()=>{
    const handleGlobalUp = ()=> handleDrop()

    window.addEventListener("mouseup", handleGlobalUp)
    window.addEventListener("touchend", handleGlobalUp)

    return ()=>{
      window.removeEventListener("mouseup", handleGlobalUp)
      window.removeEventListener("touchend", handleGlobalUp)
    }
  },[dragIndex, hoverIndex])

  useEffect(()=>{
    const el = document.querySelector(".search-results .active")
    el?.scrollIntoView({
      block:"nearest"
    })
  },[selectedIndex])

  useEffect(()=>{

    if(!isDragging) return

    const handleTouchMove = (e)=>{
      e.preventDefault()
    }

    window.addEventListener("touchmove", handleTouchMove, { passive:false })

    return ()=>{
      window.removeEventListener("touchmove", handleTouchMove)
    }

  },[isDragging])

  useEffect(()=>{
    const handleTouchStart = (e)=>{
      if(isDragging){
        e.preventDefault()
      }
    }
    return ()=>{
      window.removeEventListener("touchstart", handleTouchStart)
    }
  },[isDragging])

  useEffect(()=>{
    const up = ()=> handleDrop()

    window.addEventListener("touchend", up)

    return ()=>{
      window.removeEventListener("touchend", up)
    }
  },[dragIndex, hoverIndex])

  const handleKeyDown = async (e)=>{
    if(e.key === "ArrowDown"){
      setSelectedIndex(prev => 
        Math.min(prev + 1, searchResults.length - 1)
      )
    }

    if(e.key === "ArrowUp"){
      setSelectedIndex(prev => 
        Math.max(prev - 1, 0)
      )
    }

    if(e.key === "Enter"){
      if(searchResults[selectedIndex]){
        await addToPlaylist(searchResults[selectedIndex].id)
      }
      e.preventDefault()
    }
  }

  /* =========================
     PLAY ALL
  ========================= */

  const playAll = async () => {

    if (!playlist?.id) return

    await fetch(`${API_BASE}/queue/from_playlist/${playlist.id}?shuffle=${isShuffle}`, {
      method: "POST"
    })

    window.dispatchEvent(new Event("queueUpdated"))
  }

  /* =========================
     SHUFFLE
  ========================= */

  const toggleShuffle = () => {
    setIsShuffle(prev => !prev)
  }

  /* =========================
     ADD SONG
  ========================= */
  const addToPlaylist = async (songId)=>{
    if(isAdding) return // 🔥 多重防止

    setIsAdding(true)

    try{
      await fetch(`${API_BASE}/playlists/${playlist.id}/add?song_id=${songId}`,{
        method:"POST"
      })

      const res = await fetch(`${API_BASE}/playlists/${playlist.id}`)
      const data = await res.json()
      setTracks(data.songs || [])

      // 入力だけリセット
      setSearchQuery("")
      setSelectedIndex(0)

    }catch(e){
      console.error(e)
    }finally{
      setIsAdding(false)
    }
  }

  const searchSongs = async (q)=>{
    const res = await fetch(`${API_BASE}/search/song?q=${q}`)
    const data = await res.json()
    setSearchResults(data)
  }

  /* =========================
     DELETE SONG
  ========================= */
  const removeFromPlaylist = async (songId)=>{
    await fetch(`${API_BASE}/playlists/${playlist.id}/remove?song_id=${songId}`,{
      method:"DELETE"
    })

    const res = await fetch(`${API_BASE}/playlists/${playlist.id}`)
    const data = await res.json()
    setTracks(data.songs || [])

  }

  /* =========================
     REARRANGE
  ========================= */
  const handleDrop = async ()=>{
    if(dragIndex === null) return

    const targetIndex = hoverIndex ?? dragIndex

    const updated = [...tracks]
    const [moved] = updated.splice(dragIndex,1)
    updated.splice(targetIndex,0,moved)

    setTracks(updated)

    // 🔥 保存
    await fetch(`${API_BASE}/playlists/${playlist.id}/reorder`, {
      method:"PUT",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(updated.map(t=>t.id))
    })

    setDragIndex(null)
    setHoverIndex(null)
    setIsDragging(false)
  }

  const handleAutoScroll = (clientY)=>{
    const threshold = 100
    const scrollSpeed = 10

    const top = window.innerHeight

    // 上
    if(clientY < threshold){
      window.scrollBy(0, -scrollSpeed)
    }

    // 下
    if(clientY > top - threshold){
      window.scrollBy(0, scrollSpeed)
    }
  }

  const isBelowHero = (clientY)=>{
    const hero = document.querySelector(".playlist-hero")
    if(!hero) return true

    const rect = hero.getBoundingClientRect()
    return clientY > rect.bottom
  }

  return(
    <div className="screen playlist-container">

      <AppHeader title="Playlist"/>

      {/* =========================
         HERO
      ========================= */}
      <div className="playlist-hero">

        <div className="playlist-cover-wrap">
          {playlist.cover_url ? (
            <img src={playlist.cover_url}/>
          ) : (
            <div className="playlist-cover-placeholder"/>
          )}
        </div>

        <div className="playlist-meta">

          <div className="playlist-name">
            {playlist.name}
          </div>

          <div className="playlist-desc">
            {playlist.description || "No description"}
          </div>

          <div className="playlist-count">
            {tracks.length} songs
          </div>

          <div className="playlist-controls">

            <button
            className="playlist-play"
            onClick={playAll}
            >
              <Play size={16}/>
              Play
            </button>

            <button
              className={`playlist-shuffle ${isShuffle ? "active" : ""}`}
              onClick={toggleShuffle}
            >
              <Shuffle size={16}/>
              Shuffle
            </button>

            <button
              className={`playlist-add ${showAddModal ? "active" : ""}`}
              onClick={()=>{
                if(showAddModal){
                  // 🔥 閉じる
                  setShowAddModal(false)
                  setSearchQuery("")
                  setSearchResults([])
                }else{
                  setShowAddModal(true)
                }
              }}
              disabled={isAdding}
            >
              {isAdding ? "Adding..." : "+ Add"}
            </button>
          </div>
              
          
        </div>

      </div>

      {showAddModal && (
        <div className="add-modal">

           <input
            placeholder="Search songs..."
            value={searchQuery}
            onChange={(e)=>setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="search-results">
            {searchResults.map((song, i)=>(
              <div
                key={song.id}
                className={i === selectedIndex ? "active" : ""}
              >
                <SongCard
                  song={song}
                  onSelectSong={()=>addToPlaylist(song.id)}
                  onOpenArtist={onOpenArtist}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================
         TRACK LIST
      ========================= */}

      <div className="playlist-tracks">


        {tracks.map((t,i)=>(
          <div className="playlist-track-wrapper" key={t.id}>
              
            <div
              key={t.id}
              ref={dragIndex === i ? dragRef : null}
              className={`playlist-track ${
                dragIndex === i ? "dragging" : ""
              } ${
                hoverIndex === i ? "hovered" : ""
              }`}

              style={
                dragIndex === i && isDragging
                  ? {
                      position: "fixed",
                      top: dragY - 40, // 指の位置調整
                      left: 0,
                      right: 0,
                      zIndex: 999,
                      pointerEvents: "none"
                    }
                  : {}
              }
              onMouseMove={(e)=>{
                if(!isDragging) return

                handleAutoScroll(e.clientY)

                const rect = e.currentTarget.getBoundingClientRect()
                const middle = rect.top + rect.height / 2

                if(e.clientY < middle){
                  setHoverIndex(i)
                }else{
                  setHoverIndex(i + 1)
                }
              }}
              onTouchMove={(e)=>{
                if(!isDragging || dragIndex === null) return

                const touch = e.touches[0]
                const y = touch.clientY
                const height = window.innerHeight

                const edgeThreshold = 80 // 上下だけ許可

                // 🔥 中央はスクロール禁止
                if(y > edgeThreshold && y < height - edgeThreshold){
                  e.preventDefault()
                }

                // 位置更新
                if(dragRef.current){
                  dragRef.current.style.top = `${y - 40}px`
                }

                // 🔥 上下だけスクロール
                if(y <= edgeThreshold){
                  window.scrollBy(0, -15)
                }else if(y >= height - edgeThreshold){
                  window.scrollBy(0, 15)
                }

                // hover判定
                const elements = document.elementsFromPoint(
                  touch.clientX,
                  touch.clientY
                )
                const target = elements.find(el =>
                  el.classList?.contains("playlist-track") &&
                  !el.classList.contains("dragging")
                )

                if(target){
                  const nodes = [...document.querySelectorAll(".playlist-track")]
                  const index = nodes.indexOf(target)
                  setHoverIndex(index)
                }
              }}
              onMouseUp={handleDrop}
              onTouchEnd={handleDrop}
            >

              {/* 番号 */}
              <div
                className="track-number"
                onClick={()=>{
                  const now = Date.now()

                  if(now - lastTap.current < 300){
                    // ダブルタップ
                    setDeleteMode(deleteMode === i ? null : i)
                  }

                  lastTap.current = now
                }}
              >
                {i+1}
              </div>

              {/* SongCard */}
              <div className="track-main">

                <SongCard
                  song={{
                    id: t.id,
                    title: t.title,
                    main: t.main,
                    ft: t.ft,
                    artists: t.artists,
                    image: t.image,
                    url: t.url
                  }}
                  onSelectSong={()=>onSelectSong(t, tracks)}
                  onOpenArtist={onOpenArtist}
                />

              </div>

              {/* 右固定 */}
              <div className="track-actions">
                {deleteMode === i ? (
                  <button
                    className="delete-btn"
                    onClick={()=>removeFromPlaylist(t.id)}
                  >
                    ×
                  </button>
                ) : (
                  <GripVertical
                    className="drag"
                    onMouseDown={(e)=>{
                      e.stopPropagation()
                      setDragIndex(i)
                      setIsDragging(true)
                    }}
                    onTouchStart={(e)=>{
                      e.stopPropagation()
                      e.preventDefault()
                      setDeleteMode(null) 
                      setDragIndex(i)
                      setIsDragging(true)
                      setDragY(e.touches[0].clientY)
                    }}
                  />
                )}
              </div>
            </div>

          </div>
        ))}

      </div>

    </div>
  )
}