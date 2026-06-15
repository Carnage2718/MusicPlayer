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
        image: initialSong.image,
        artists: initialSong.artists,
        main: initialSong.main,
        ft: initialSong.ft,
        url: initialSong.url
      }]
    : []
  )
  
  const fileRef = useRef()

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
      let uploaded = null

      if(coverFile instanceof File){

        
        const fd = new FormData()
        fd.append("file",coverFile)

        const res = await fetch(`${API_BASE}/upload/cover`,{
          method:"POST",
          body:fd
        })

        const data = await res.json()
        uploaded = data.url
      }

      await authfetch(`/playlists`,{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          name,
          cover_url: uploaded,
          songs: tracks.map(t=>t.song_id)
        })
      })

      onBack()
    }catch(e){
      console.error(e)
    }finally{
      setIsCreating(false)
    }
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

            <input
              placeholder="Playlist name"
              value={name}
              onChange={e=>setName(e.target.value)}
            />

            <button
              className="add-btn"
              onClick={()=>
                setShowSongPicker(true)
              }
            >
              ADD SONG
            </button>

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
              className="submit-btn" 
              onClick={createPlaylist}
              disabled={isCreating}
            >
              {isCreating ? "CREATING..." : "CREATE"}
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
                  image: t.image,
                  artists: t.artists,
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

        onClose={()=>
          setShowSongPicker(false)
        }

        onSelect={(song)=>{

          setTracks(prev=>{

            if(
              prev.some(
                t => t.song_id === song.id
              )
            ){
              return prev
            }

            return [
              ...prev,
              {
                song_id: song.id,
                title: song.title,
                image: song.image,
                main: song.main,
                ft: song.ft,
                artists: song.artists,
                url: song.url
              }
            ]
          })

        }}

      />

    </div>
  )
}