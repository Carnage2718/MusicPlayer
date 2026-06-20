import { useState, useEffect, useRef } from "react"
import { Music } from "lucide-react"
import API_BASE, { authfetch }from "../api"
import AppHeader from "../components/AppHeader"
import SongCard from "../components/SongCard"
import SearchPicker from "../components/SearchPicker"
import "./CreatePlaylistScreen.css"

export default function CreatePlaylistScreen({ onBack, initialSong }) {

  const [name,setName] = useState("")
  const [tracks,setTracks] = useState(
    initialSong
    ? [{
        song_id: initialSong.id || initialSong.song_id,
        title: initialSong.title,
        image:
          initialSong.image ||
          initialSong.cover_url ||
          initialSong.cover,
        artists: initialSong.artists,
        main: initialSong.main,
        ft: initialSong.ft,
        url: initialSong.url
      }]
    : []
  )
  
  const fileRef = useRef()
  const [playlistResults,setPlaylistResults] = useState([])
  const [activeInput,setActiveInput] = useState("")
  const [playlistId,setPlaylistId] = useState(null)
  const [originalSongIds,setOriginalSongIds] = useState([])
  const [coverFile,setCoverFile] = useState(null)
  const [coverUrl,setCoverUrl] = useState(null)
  const [isCreating, setIsCreating] = useState(false)

  const [showSongPicker,setShowSongPicker] = useState(false)


  useEffect(()=>{
    const handlePaste = (e)=>{
      const items = e.clipboardData?.items
      if(!items) return

      for(const item of items){
        if(item.type.startsWith("image/")){
          const file = item.getAsFile()

          cropToSquare(file).then((cropped)=>{
            setCoverFile(cropped)
            setCoverUrl(URL.createObjectURL(cropped))
          })

          break
        }
      }
    }

    window.addEventListener("paste", handlePaste)
    return ()=> window.removeEventListener("paste", handlePaste)
  },[])

  useEffect(()=>{

    if(!name.trim()){
      setPlaylistResults([])
      return
    }

    authfetch(
      `/search/playlist?q=${encodeURIComponent(name)}`
    )
    .then(r=>r.json())
    .then(setPlaylistResults)

  },[name])

  const cropToSquare = (file)=>{
    return new Promise((resolve)=>{

      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = ()=>{
        const size = Math.min(img.width, img.height)

        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2

        const canvas = document.createElement("canvas")
        canvas.width = size
        canvas.height = size

        const ctx = canvas.getContext("2d")

        ctx.drawImage(
          img,
          sx, sy, size, size,   // 切り取り
          0, 0, size, size      // 描画
        )

        canvas.toBlob((blob)=>{
          const croppedFile = new File([blob], file.name, {
            type: "image/jpeg"
          })

          resolve(croppedFile)
        }, "image/jpeg", 0.9)
      }

      img.src = url
    })
  }

  const selectPlaylist = async (playlist)=>{

    setPlaylistId(playlist.id)

    setName(playlist.name)

    const res = await authfetch(
      `/playlists/${playlist.id}`
    )

    const data = await res.json()

    setOriginalSongIds(
      (data.songs || []).map(song => song.id)
    )

    setTracks(
      (data.songs || []).map(song => ({
        song_id: song.id,
        title: song.title,
        image: song.image,
        artists: song.artists || [],
        main: song.main,
        ft: song.ft,
        url: song.url
      }))
    )

    setCoverUrl(
      data.cover_url || null
    )

    setPlaylistResults([])
    setActiveInput("")
  }


  /* =========================
     REMOVE
  ========================= */

  const removeSong = (i)=>{
    setTracks(prev =>
      prev.filter((_,index)=> index !== i)
    )
  }

  /* =========================
     CREATE
  ========================= */

  const createPlaylist = async()=>{

    if(isCreating) return

    setIsCreating(true)

    try{

      const songIds = tracks
        .map(t => t.song_id || t.id)
        .filter(Boolean)

      // =====================
      // 既存Playlist更新
      // =====================
      if(playlistId){

        const addedSongs =
          tracks
            .map(t => t.song_id || t.id)
            .filter(id =>
              !originalSongIds.includes(id)
            )

        if(addedSongs.length === 0){
          onBack()
          return
        }

        await authfetch(
          `/playlists/${playlistId}/add/multi`,
          {
            method:"POST",
            headers:{
              "Content-Type":"application/json"
            },
            body:JSON.stringify({
              songs: addedSongs
            })
          }
        )

        onBack()
        return
      }

      // =====================
      // 新規作成
      // =====================

      let uploaded = null

      if(coverFile instanceof File){

        const fd = new FormData()
        fd.append("file",coverFile)

        const res = await fetch(
          `${API_BASE}/upload/cover`,
          {
            method:"POST",
            body:fd
          }
        )

        const data = await res.json()
        uploaded = data.url
      }

      await authfetch(`/playlists`,{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          name,
          cover_url:uploaded,
          songs:songIds
        })
      })

      onBack()

    }catch(e){
      console.error(e)
    }finally{
      setIsCreating(false)
    }
  }
  const handleSelectSong = (song) => {

    const songId = song.song_id || song.id

    setTracks(prev => {

      if(prev.some(t =>
        (t.song_id || t.id) === songId
      )){
        return prev
      }

      return [
        ...prev,
        {
          song_id: songId,
          title: song.title,

          image:
            song.image ||
            song.cover_url ||
            song.cover,

          artists: song.artists || [],
          main: song.main,
          ft: song.ft,
          url: song.url
        }
      ]
    })

  }

  /* =========================
     UI
  ========================= */

  return(
    <div className="screen">

      <AppHeader title="Create Playlist" onBack={onBack}/>

      <div className="create-playlist-form">

        <div className="create-playlist-hero">

          <div className="create-playlist-left">

            <div className="playlist-input-group">

              <input
                placeholder="Playlist name"
                value={name}
                onChange={(e)=>{
                  setName(e.target.value)
                  setActiveInput("playlist")
                  setPlaylistId(null)
                  setOriginalSongIds([])
                }}
              />

              {activeInput === "playlist" &&
              playlistResults.length > 0 && (

                <div className="dropdown">

                  {playlistResults.map(p=>(

                    <div
                      key={p.id}
                      onClick={()=>
                        selectPlaylist(p)
                      }
                    >
                      {p.name}
                    </div>

                  ))}

                </div>

              )}

            </div>

            <div className="create-playlist-actions">

              <button
                className="add-btn" 
                onClick={() => setShowSongPicker(true)}
              >
                ADD SONG
              </button>

              <button
                className="create-playlist-submit-btn phone-btn"
                onClick={createPlaylist}
                disabled={isCreating}
              >
                {isCreating ? (
                  <div className="loading-wrap">
                    <div className="spinner"></div>
                    creating...
                  </div>
                ) : (
                  "CREATE"
                )}
              </button>

            </div>


          </div>



          <div className="create-playlist-right">

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{display:"none"}}
              onChange={(e)=>{
                const f = e.target.files[0]
                if(!f) return

                cropToSquare(f).then((cropped)=>{
                  setCoverFile(cropped)
                  setCoverUrl(URL.createObjectURL(cropped))
                })
              }}
            />

            <div
              className="create-playlist-cover-wrap"
              onClick={()=>fileRef.current?.click()}
            >
              {coverUrl ? (
                <img src={coverUrl}/>
              ) : (
                <div className="create-playlist-placeholder">
                  <Music size={40}/>
                  Auto cover
                </div>
              )}
            </div>

            <button
              className="create-playlist-submit-btn desktop-btn"
              onClick={createPlaylist}
              disabled={isCreating}
            >
              {isCreating ? (
                <div className="loading-wrap">
                  <div className="spinner"></div>
                  creating...
                </div>
              ) : (
                "CREATE"
              )}
            </button>

          </div>

        </div>


        {/* TRACK */}
        <div className="track-list">
          {tracks.map((t,i)=>(
            <div key={`track-${t.song_id}-${i}`} className="track-item">
              <SongCard
                song={{
                  id: t.song_id,
                  title: t.title,

                  image:
                    t.image ||
                    t.cover_url ||
                    t.cover,

                  artists: t.artists || [],

                  main: t.main,
                  ft: t.ft,

                  url: t.url
                }}
                showMenu={false}
              />  

              <button
                className="track-remove"
               onClick={()=>removeSong(i)}
              >
                ✕
              </button>

            </div>

          ))}

        </div>

      </div>

      <SearchPicker
        open={showSongPicker}
        type="song"
        title="Add Song"
        onSelect={handleSelectSong}
        onClose={()=>setShowSongPicker(false)}
      />

    </div>
  )
}