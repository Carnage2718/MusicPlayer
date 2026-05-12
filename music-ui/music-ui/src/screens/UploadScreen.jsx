import { useState, useEffect } from "react"
import AppHeader from "../components/AppHeader"
import "./UploadScreen.css"
import API_BASE from "../api"
import SongCard from "../components/SongCard"

export default function UploadScreen({
  onSelectSong,
  onOpenArtist
}){
  return(
    <div className="screen">
      <AppHeader title="Upload"/>
      <UploadFlow
        onSelectSong={onSelectSong}
        onOpenArtist={onOpenArtist}
      />
    </div>
  )
}

function UploadFlow({
  onSelectSong,
  onOpenArtist
}){

  const [mode,setMode] = useState("cover")
  const [selected,setSelected] = useState(null)
  const [preview,setPreview] = useState(null)
  const [coverUrl,setCoverUrl] = useState(null)

  return(
    <div className="upload-container">

      {/* 🔥 タブ */}
      <div className="mode-switch">
        <button
          className={mode==="cover" ? "active" : ""}
          onClick={()=>setMode("cover")}
        >
          Cover
        </button>

        <button
          className={mode==="song" ? "active" : ""}
          onClick={()=>setMode("song")}
        >
          Song
        </button>
      </div>

      {mode==="cover" && 
        <CoverFlow
          preview={preview}
          setPreview={setPreview}
          coverUrl={coverUrl}
          setCoverUrl={setCoverUrl}
          selected={selected}
          setSelected={setSelected}
        />
      }
      {mode==="song" && (
        <SongUpload
          onSelectSong={onSelectSong}
          onOpenArtist={onOpenArtist}
        />
      )}

    </div>
  )
}

/* =========================
   COVER FLOW
========================= */

function CoverFlow({
  preview, 
  setPreview,
  coverUrl, 
  setCoverUrl,
  selected,
  setSelected
}){

  const [file,setFile] = useState(null)
  const [loading,setLoading] = useState(false)
  const [animate,setAnimate] = useState(false)
  const [isDragging, setISDragging] = useState(false)

  useEffect(()=>{
    const handlePaste = (e)=>{
      const items = e.clipboardData?.items
      if(!items) return

      for(let item of items){
        if(item.type.startsWith("image/")){
          const file = item.getAsFile()

          setFile(file)
          setPreview(URL.createObjectURL(file))
          break
        }
      }
    }

    window.addEventListener("paste", handlePaste)
    return ()=>window.removeEventListener("paste", handlePaste)
  },[])

  const handleDrop = (e)=>{
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if(!file || !file.type.startsWith("image/")) return

    setFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleDragOver = (e)=>{
    e.preventDefault()
  }

  const handleDragEnter = (e)=>{
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e)=>{
    e.preventDefault()
    setIsDragging(false)
  }

  const handleFile = (e)=>{
    const f = e.target.files[0]
    if(!f) return

    setCoverUrl(null)

    // 🔥 アニメーションON
    setAnimate(true)

    setTimeout(()=>{
      setFile(f)
      setPreview(URL.createObjectURL(f))
      setAnimate(false)
    },150)
  }

  const upload = async()=>{

    if(!file) return alert("cover選択してください")

    setLoading(true)

    const form = new FormData()
    form.append("file",file)

    try{
      const res = await fetch(`${API_BASE}/upload/cover`,{
        method:"POST",
        body:form
      })

      const data = await res.json()
      console.log("COVER:", data)

      // 🔥 安全処理
      if((data.status==="ok" || data.status==="duplicate") && data.url){
        setCoverUrl(data.url)

        return
      }

      alert(data.error || "upload failed")

    }catch(e){
      console.error(e)
      alert("network error")
    }finally{
      setLoading(false)
    }
  }

  
  const toFullUrl = (key)=>{
    if(!key) return null
    if(typeof key === "string" && key.startsWith("http")) return key
    return `${API_BASE}/${key}`
  }

  const resetAll = ()=>{
    setFile(null)
    setPreview(null)
    setCoverUrl(null)
    setSelected(null)
  }

  return(
    <>
      <div 
        className={`cover-upload ${isDragging ? "dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <label>

          {selected?.oldCover ? (

            <div className="cover-compare">
              <img src={toFullUrl(selected.oldCover)} className="cover-large"/>
              <div className="arrow">→</div>
              <img src={preview} className="cover-large new"/>
            </div>

          ) : preview ? (

            <img src={preview} className="cover-preview"/>

          ) : (

            <div className="cover-upload-placeholder">+ Cover</div>

          )}

          {/* 🔥 これが必要 */}
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFile} 
            hidden
          />

        </label>
      </div>      

      {preview && !coverUrl && (
        <button className="confirm-btn" onClick={upload}>
          {loading ? "Uploading..." : "Upload Cover"}
        </button>
      )}

      {coverUrl &&(
        <SearchUI 
          coverUrl={coverUrl} 
          previewUrl={preview} 
          onDone={resetAll} 
          setSelected={setSelected}
          selected={selected}
        />

      )}
    </>
  )
}

/* =========================
   SEARCH + ASSIGN
========================= */

function SearchUI({coverUrl, previewUrl, onDone, setSelected,selected}){

  const [query,setQuery] = useState("")
  const [data,setData] = useState(null)
  const [isApplying,setIsApplying] = useState(false)

  useEffect(()=>{

    if(!query){
      setData(null)
      return
    }

    const controller = new AbortController()

    const t = setTimeout(async()=>{
      try{
        const res = await fetch(`${API_BASE}/search?q=${query}`,{
          signal: controller.signal
        })
        const d = await res.json()
        setData(d)
      }catch(e){
        if(e.name !== "AbortError"){
          console.error(e)
        }
      }
    },150)

    return ()=>{
      clearTimeout(t)
      controller.abort()
    }

  },[query])

  const reset = ()=>{
    setQuery("")
    setSelected(null)
    setData(null)

  }

  const selectItem = (item,type,label)=>{

    const old = item.cover_url ?? item.image_url ?? null

    setSelected({
      id: item.id,
      type,
      label,
      oldCover: old
    })

    setQuery(label)
  }

  const assign = async()=>{

    if(!selected || !selected.id || isApplying) return

    setIsApplying(true)

    try{
      await fetch(`${API_BASE}/upload/cover/assign/${selected.type}`,{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({
          [`${selected.type}_id`]: selected.id,
          cover_url: coverUrl
        })
      })

      onDone()

    }finally{
      setIsApplying(false)
    }
  }


  return(
    <div className="search-container">
      <div className="search-block">

        {/* 🔥 入力エリア */}
        <div className="search-input-wrap">

          <input
            className="search-input"
            placeholder="Search..."
            value={query}
            onChange={(e)=>setQuery(e.target.value)}
          />

          {query && (
            <div className="clear-btn" onClick={reset}>
              ×
            </div>
          )}
        </div>

        {/* 🔥 右下エリア */}
        <div className="search-actions">

          {selected?.id && (
            <div className="selected-type">
              {selected.type}
            </div>
          )}

          <button
            className="confirm-btn"
            onClick={assign}
            disabled={!selected?.id || isApplying}
          >
            {isApplying ? "Applying..." : "Apply"}
          </button>

        </div>

      </div>

      {data && ["songs","playlists","artists"].map(section=>(
        data[section]?.length>0 && (
          <Section key={section} title={section}>
            {data[section].map(i=>(
              <Item
                key={i.id}
                title={i.title || i.name}
                subtitle={i.artists}
                onClick={()=>selectItem(i,section.slice(0,-1),i.title||i.name)}
                isActive={selected?.id===i.id}
              />
            ))}
          </Section>
        )
      ))}
    </div>
  )
}

function Section({title,children}){
  return(
    <div className="section">
      <div className="section-title">{title}</div>
      {children}
    </div>
  )
}

function Item({title,subtitle,onClick,isActive}){
  return(
    <div className={`item ${isActive ? "active-item" : ""}`} onClick={onClick}>
      <div className="item-title">{title}</div>
      {subtitle && <div className="item-sub">{subtitle}</div>}
    </div>
  )
}



/* =========================
   SONG UPLOAD
========================= */

function SongUpload({
  onOpenArtist,
  onSelectSong
}){

  const [files,setFiles] = useState([])
  const [loading,setLoading] = useState(false)
  const [progress,setProgress] = useState(0)
  const [total,setTotal] = useState(0)
  const [result,setResult] = useState([])
  const [recent,setRecent] = useState([])
  const [uploadedSongs,setUploadedSongs] = useState([])
  const [genres,setGenres] = useState([])
  const [selectedGenres,setSelectedGenres] = useState({})

  useEffect(()=>{
    const fetchRecent = async ()=>{
      try{
        const res = await fetch(`${API_BASE}/songs/recent`)
        const data = await res.json()
        setRecent(data)
      }catch(e){
        console.error(e)
      }
    }
    fetchRecent()
  },[])

  useEffect(() => {

    fetch(`${API_BASE}/genres`)
      .then(r => r.json())
      .then(setGenres)

  }, [])

  const handleFiles = (e)=>{
    const f = Array.from(e.target.files || [])
    setFiles(f)
    setTotal(f.length)
    setResult([])
    setProgress(0)
  }

  const handleDropSongs = (e)=>{
    e.preventDefault()

    const dropped = Array.from(e.dataTransfer.files || [])

    const valid = dropped.filter(f =>
      f.type.startsWith("audio/") || f.type.startsWith("video/")
    )

    if(valid.length === 0) return

    setFiles(valid)
    setTotal(valid.length)
    setResult([])
    setProgress(0)
  }

  const handleDragOverSongs = (e)=>{
    e.preventDefault()
  }

  const upload = async()=>{

    if(files.length === 0) return

    setLoading(true)

    for(let i=0;i<files.length;i++){

      const file = files[i]

      const form = new FormData()
      form.append("file",file)

      try{
        const res = await fetch(`${API_BASE}/upload/song`,{
          method:"POST",
          body:form
        })

        const data = await res.json()

        if(data.status==="ok" && data.song){
          
          setUploadedSongs(prev => [
            data.song,
            ...prev
          ])

        }

      }catch(e){
        console.error(e)
      }

      setProgress(i+1)
    }


    setLoading(false)
  }

  const toggleGenre = (songId, genreId)=>{

    setSelectedGenres(prev => {

      const current = prev[songId] || []

      const updated = current.includes(genreId)
        ? current.filter(id => id !== genreId)
        : [...current, genreId]

      return {
        ...prev,
        [songId]: updated
      }

    })

  }

  const confirmUploads = async()=>{

    try{

      for(const song of uploadedSongs){

        const genre_ids =
          selectedGenres[song.id] || []

        await fetch(
          `${API_BASE}/upload/song/${song.id}/genres`,
          {
            method:"POST",
            headers:{
              "Content-Type":"application/json"
            },
            body:JSON.stringify({
              genre_ids
            })
          }
        )

      }

      // 🔥 recent再取得
      const res = await fetch(`${API_BASE}/songs/recent`)
      const data = await res.json()

      setRecent(data)

      setUploadedSongs([])
      setSelectedGenres({})

      setFiles([])
      setProgress(0)
      setTotal(0)

    }catch(e){
      console.error(e)
    }

  }

  const reset = ()=>{
    setFiles([])
    setProgress(0)
    setTotal(0)
    setResult([])
    setUploadedSongs([])
  }

  return(
    <div className="song-upload-modern">

      {/* 🔥 複数選択 */}
      <label 
        className="song-drop"
        onDrop={handleDropSongs}
        onDragOver={handleDragOverSongs}
      >
        {files.length > 0 
          ? `${files.length} files selected`
          : "Drop or Select Songs"
        }

        <input 
          type="file" 
          accept=".m4a, audio/*, video/*"
          multiple
          onChange={handleFiles}
          hidden
        />
      </label>

      {/* 🔥 ボタン */}
      <button 
        className="confirm-btn"
        onClick={upload}
        disabled={files.length===0 || loading}
      >
        {loading 
          ? `Uploading ${progress}/${total}` 
          : "Upload"
        }
      </button>

      {/* 🔥 アップロード結果 */}

        {uploadedSongs.length > 0 && (

        <section className="upload-results">

          <div className="upload-section-title">
            Results
          </div>

          {uploadedSongs.map(song => (

            <div
              key={song.id}
              className="upload-result-card"
            >

              <SongCard
                song={song}
                onSelectSong={onSelectSong}
                onOpenArtist={onOpenArtist}
              />

              <div className="song-genre-block">

                <div className="song-genre-title">
                  Genres
                </div>

                <div className="genre-selector">

                  {genres.map(genre => {

                    const active =
                      selectedGenres[song.id]?.includes(genre.id)

                    return (

                      <button
                        key={genre.id}
                        className={`genre-chip ${active ? "active" : ""}`}
                        onClick={() =>
                          toggleGenre(song.id, genre.id)
                        }
                      >
                        {genre.name}
                      </button>

                    )

                  })}

                </div>

              </div>

            </div>

          ))}

          <div className="upload-footer">

            <div className="upload-ready-count">
              {uploadedSongs.length} songs ready
            </div>

            <button
              className="upload-confirm-btn"
              onClick={confirmUploads}
            >
              Confirm
            </button>

          </div>

        </section>
      )}

      <div className="upload-section-title">
        Recent
      </div>

      {recent.map(song => (
        <SongCard 
          key={`recent-${song.id}`}
          song={{
            id: song.id,
            title: song.title,
            main: song.main,
            ft: song.ft,
            artists: song.artists,
            image: song.cover_url || song.image
          }}
          onSelectSong={onSelectSong}
          onOpenArtist={onOpenArtist}
        />
      ))}

    </div>
  )
}
