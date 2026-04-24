import { useState, useEffect, useRef } from "react"
import API_BASE from "../api"
import AppHeader from "../components/AppHeader"
import "./CreateAlbumScreen.css"
import { Music } from "lucide-react"

export default function CreateAlbumScreen({ onBack }){

  const [name,setName] = useState("")
  const [artists,setArtists] = useState([])
  const [songQuery,setSongQuery] = useState("")
  const [activeInput,setActiveInput] = useState("")
  const [trackNumber,setTrackNumber] = useState("")
  const [trackError,setTrackError] = useState("")
  const [artistInput, setArtistInput] = useState("")

  const [albumResults,setAlbumResults] = useState([])
  const [artistResults,setArtistResults] = useState([])
  const [songResults,setSongResults] = useState([])

  const [tracks,setTracks] = useState([])
  const [existingTracks,setExistingTracks] = useState([])

  const [selectedAlbumImage,setSelectedAlbumImage] = useState(null)
  const [selectedSong,setSelectedSong] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [coverUrl, setCoverUrl] = useState(null)
  const [highlightIndex,setHighlightIndex] = useState(0)

  const albumRef = useRef()
  const artistRef = useRef()
  const songRef = useRef()
  const trackRef = useRef()
  const fileRef = useRef()
  const wrapperRef = useRef()

  const [isCreating,setIsCreating] = useState(false)

  /* =========================
    key control
  ========================= */

  useEffect(()=>{
    const handlePaste = (e)=>{
      const items = e.clipboardData?.items
      if(!items) return

      for(let item of items){
        if(item.type.startsWith("image/")){
          const file = item.getAsFile()

          setCoverFile(file)
          setSelectedAlbumImage(URL.createObjectURL(file))
          break
        }
      }
    }

    window.addEventListener("paste", handlePaste)
    return ()=>window.removeEventListener("paste", handlePaste)
  },[])

  const handleDrop = (e) => {
    e.preventDefault()

    const file = e.dataTransfer.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) return

    setCoverFile(file)
    setSelectedAlbumImage(URL.createObjectURL(file))
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const handleKey = (e, list, onSelect, nextRef)=>{

    if(!list.length) return

    if(e.key === "Tab"){
      e.preventDefault()
      setHighlightIndex((prev)=> (prev+1) % list.length)
    }

    if(e.key === "Enter"){
      e.preventDefault()
      onSelect(list[highlightIndex] || list[0])

      setHighlightIndex(0)

      setActiveInput("")

      if(nextRef){
        setTimeout(()=> nextRef.current?.focus(), 0)
      }
    }
  }

  /* =========================
     UTIL
  ========================= */

  const isDuplicateTrackNumber = (num)=>{

    const all = [
      ...tracks.map(t=>t.track_number),
      ...existingTracks.map(t=>t.track_number)
    ]

    return all.includes(num)
  }

  const isValidTrackNumber = ()=>{
    if(!trackNumber) return false

    const num = Number(trackNumber)
    if(isNaN(num)) return false

    if(isDuplicateTrackNumber(num)) return false

    return true
  }

  const uploadCover = async () => {

    if(!coverFile) return null

    const formData = new FormData()
    formData.append("file", coverFile)

    const res = await fetch(`${API_BASE}/upload/cover`, {
      method: "POST",
      body: formData
    })

    const data = await res.json()

    setCoverUrl(data.url) // 🔥 key保存

    return data.url
  }

  /* =========================
     ADD TRACK
  ========================= */

  const handleAddTrack = ()=>{
    if(!selectedSong || !isValidTrackNumber()) return

    const num = Number(trackNumber)

    setTracks([
      ...tracks,
      {
        song_id: selectedSong.id,
        title: selectedSong.title,
        track_number: num
      }
    ])

    setSelectedSong(null)
    setSongQuery("")
    setTrackNumber("")
    setSongResults([])

    setTimeout(()=> {
      songRef.current?.focus()
    },0)
  }

  const canAdd = selectedSong && isValidTrackNumber()

  /* =========================
     REMOVE TRACK
  ========================= */

  const removeTrack = (index)=>{
    const updated = [...tracks]
    updated.splice(index,1)
    setTracks(updated)
  }

  /* =========================
     SEARCH
  ========================= */

  useEffect(()=>{
    if(name){
      fetch(`${API_BASE}/search/album?q=${name}`)
        .then(r=>r.json())
        .then(setAlbumResults)
    } else setAlbumResults([])
  },[name])

  const getLastQuery = (input) => {
    const split = input.split(/,|ft\./i)
    return split[split.length - 1].trim()
  }

  useEffect(()=>{

    const query = getLastQuery(artistInput)

    if(query.trim().length > 0){
      fetch(`${API_BASE}/search/artist?q=${query}`)
        .then(r=>r.json())
        .then(setArtistResults)
    }else{
      setArtistResults([])
    }

  },[artistInput])

  useEffect(()=>{
    if(songQuery){

      let url = `${API_BASE}/search/song/artist?q=${songQuery}`

      if (artists.length > 0){
        const names = artists.map(a => a.name).join(",")
        url += `&artist=${encodeURIComponent(names)}`
      }

      fetch(url)
        .then(r=>r.json())
        .then(setSongResults)
    } else setSongResults([])
  },[songQuery, artists])

  useEffect(()=>{
    const handleClickOutside = (e)=>{
      if(!wrapperRef.current?.contains(e.target)){
        setActiveInput("")
      }
    }

    window.addEventListener("click", handleClickOutside)

    return ()=>window.removeEventListener("click", handleClickOutside)

  },[])

  /* =========================
     SELECT
  ========================= */

  const selectAlbum = (a)=>{
    setName(a.name)
    setAlbumResults([])

    fetch(`${API_BASE}/albums/${a.id}`)
      .then(r=>r.json())
      .then(data=>{
        setExistingTracks(data.songs || [])
        setSelectedAlbumImage(data.image)

        const artists = data.artists || []
        setArtists(artists)

        const main = artists.filter(a=>a.role==="main").map(a=>a.name)
        const ft = artists.filter(a=>a.role==="featuring").map(a=>a.name)

        const formatted =
          ft.length > 0
            ? `${main.join(", ")} ft. ${ft.join(", ")}`
            : main.join(", ")

        setArtistInput(formatted)
      })

    // 🔥 ここ追加（超重要）
    setActiveInput("")
    setArtistResults([])

    setTimeout(()=> songRef.current?.focus(), 0)
  }

  const selectArtist = (a) => {

    setArtists(prev => {

      if(prev.find(x => x.id === a.id)) return prev

      const lower = artistInput.toLowerCase()
      const isFt = /ft\.\s*[^,]*$/i.test(artistInput)
      
      return [
        ...prev,
        { ...a, role: isFt ? "featuring" : "main" }
      ]
    })

    setArtistInput(prev => {
      const split = prev.split(/,|ft\./i)
      const last = split[split.length - 1]

      const trimmedLast = last.trimStart()
      const spacePart = last.slice(0, last.length - trimmedLast.length)

      return prev.slice(0, prev.length - last.length) + spacePart + a.name
    })
    setArtistResults([])
  }

  const selectSong = (s)=>{
    setSongQuery(s.title)
    setSelectedSong(s)
    setSongResults([])
    setActiveInput("")
  }



  /* =========================
     CREATE
  ========================= */

  const buildTracksForSubmit = ()=>{
    let finalTracks = [...tracks]

    if(selectedSong && isValidTrackNumber()){
      finalTracks.push({
        song_id: selectedSong.id,
        title: selectedSong.title,
        track_number: Number(trackNumber)
      })
    }

    return finalTracks
  }

  const createAlbum = async ()=>{

    if(isCreating) return
    setIsCreating(true)

    try{

      let uploadedCover = coverUrl

      if(!uploadedCover && coverFile){
        uploadedCover = await uploadCover()
      }

      const finalTracks = buildTracksForSubmit()

      const finalArtists =
        artists.length > 0
          ? artists
          : artistInput.trim()
            ? [{ name: artistInput.trim(), role: "main" }]
            : []

      if(finalArtists.length === 0){
        alert("Artistを入力してください")
        setIsCreating(false)
        return
      }

      const formattedArtists = finalArtists.map(a => ({
        id: a.id || null,
        name: a.name,
        role: a.role === "featuring" ? "featuring" : "main"
      }))

      const res = await fetch(`${API_BASE}/albums`,{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body: JSON.stringify({
          name,
          artists: formattedArtists,
          cover_url: uploadedCover || null,
          release_date: null,
          tracks: finalTracks
        })
      })

      if(!res.ok){
        console.error("album create error:", await res.text())
        return
      }

      const data = await res.json()

      if(uploadedCover && data.album_id){
        const res2 = await fetch(`${API_BASE}/upload/cover/assign/album`,{
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body: JSON.stringify({
            album_id: data.album_id,
            cover_url: uploadedCover
          })
        })

        if(!res2.ok){
          console.error("assign error:", await res2.text())
        }
      }

      console.log("SEND DATA:", {
        name,
        artists: formattedArtists,
        tracks: finalTracks,
        cover_url: uploadedCover
      })

      onBack()

    }finally{
      setIsCreating(false)
    }
  }

  return(
    <div className="screen" ref={wrapperRef}>

      <AppHeader title="Create Album" onBack={onBack}/>

      <div className="create-form">

        {/* ===== HEADER ===== */}
        <div className="create-album-hero">

          <div className="create-album-form">

            <div className="input-group">
              <input
                ref={albumRef}
                placeholder="Album name"
                value={name}
                onChange={e=>{
                  setName(e.target.value)
                  setActiveInput("album")
                }}
                onKeyDown={(e)=>handleKey(e, albumResults,selectAlbum, artistRef)}
              />

              {activeInput==="album" && albumResults.length > 0 && (
                <div className="dropdown">
                  {albumResults.map((a,i)=>(
                    <div 
                      key={a.id} 
                      className={i === highlightIndex ? "create-album-active" : ""}
                      onClick={()=>selectAlbum(a)}
                    >
                      {a.name} - {a.artist}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="input-group">
              <input
                ref={artistRef}
                placeholder="Artist name"
                value={artistInput}
                onChange={e=>{
                  setArtistInput(e.target.value)
                  setActiveInput("artist")
                }}
                onKeyDown={(e)=>handleKey(e, artistResults, selectArtist, songRef)}
              />

              {activeInput==="artist" && artistResults.length > 0 && (
                <div className="dropdown">
                  {artistResults.map((a,i)=>(
                    <div 
                      key={a.id}
                      className={i === highlightIndex ? "create-album-active" : ""}
                      onClick={()=>selectArtist(a)}
                    >
                      {a.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ===== SONG ===== */}

            <div className="input-group">
              <input
                ref={songRef}
                placeholder="Song"
                value={songQuery}
                onChange={e=>{
                  setSongQuery(e.target.value)
                  setActiveInput("song")
                }}
                onKeyDown={(e)=>handleKey(e, songResults, selectSong, trackRef)}
              />

              {activeInput==="song" && songResults.length > 0 && (
                <div className="dropdown">
                  {songResults.map((s,i)=>(
                    <div 
                      key={s.id} 
                      className={i === highlightIndex ? "create-album-active" : ""}
                      onClick={()=>selectSong(s)}
                    >
                      {s.title}
                      {s.artists?.length > 1 && (
                        <span className="feat">
                          {" "}ft. {s.artists.slice(1).join(", ")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="left-action">
              <input
                ref={trackRef}
                className="track-input"
                placeholder="#"
                value={trackNumber}
                onChange={e=>setTrackNumber(e.target.value)}
                onKeyDown={(e)=>{
                  if(e.key === "Enter"){
                    e.preventDefault()
                    handleAddTrack()
                  }
                }}

              />

              <button 
              className="add-btn" 
              onClick={handleAddTrack} 
              disabled={!canAdd}
              style={{
                background: canAdd ? "#1db954" : "#555",
                cursor: canAdd ? "pointer" : "not-allowed"
              }}
            >
                ADD
              </button>
            </div>

          </div>

          <div className="right-side">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{display:"none"}}
              id="cover-upload"
              onChange={(e)=>{
                const file = e.target.files[0]
                if(file){
                  setCoverFile(file)
                  setSelectedAlbumImage(URL.createObjectURL(file))
                }
              }}
            />  

            <div 
              className="create-album-artwork-wrap"
              onClick={()=>fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              {selectedAlbumImage ? (
                <img 
                  src={selectedAlbumImage}
                  className="create-album-artwork"
                />
              ) : (
                <div className="create-album-artwork-placeholder">
                  <Music 
                    size={50}
                    color="#1db954"
                  />
              </div>
              )}
            </div>
              
            <button 
              className="submit-btn" 
              onClick={createAlbum}
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
        
        <div className="whole-track">
          {/* ===== TRACK LIST ===== */}
          <div className="track-list">
            {tracks.map((t,i)=>(
              <div key={i} className="track-item">
                <span>#{t.track_number ?? "-"} - {t.title}</span>
                <div
                  onClick={()=>removeTrack(i)}
                  className="album-song-delete">
                  ✕
                </div>
              </div>
            ))}
          </div>

          {/* ===== EXISTING ===== */}
          {existingTracks.length > 0 && (
            <div className="existing">
              <h4>Existing Tracks</h4>
              {existingTracks.map(t=>(
                <div key={t.song_id}>
                  #{t.track_number ?? "-"} - {t.title}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}