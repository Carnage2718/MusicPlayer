import { useState, useEffect } from "react"
import AppHeader from "../components/AppHeader"
import "./UploadScreen.css"
import API_BASE from "../api"
import SongCard from "../components/SongCard"

export default function UploadScreen(){
  return(
    <div className="screen">
      <AppHeader title="Upload"/>
      <UploadFlow/>
    </div>
  )
}

function UploadFlow(){

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
      {mode==="song" && <SongUpload/>}

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
      <div className="cover-upload">
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

function SongUpload(){

  const [files,setFiles] = useState([])
  const [loading,setLoading] = useState(false)
  const [progress,setProgress] = useState(0)
  const [total,setTotal] = useState(0)
  const [result,setResult] = useState([])
  const [recent,setRecent] = useState([])

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

  const handleFiles = (e)=>{
    const f = Array.from(e.target.files || [])
    setFiles(f)
    setTotal(f.length)
    setResult([])
    setProgress(0)
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

          // 🔥 1曲ずつ追加（最重要）
          setResult(prev => [data.song, ...prev])
        }

      }catch(e){
        console.error(e)
      }

      setProgress(i+1)
    }

    setTimeout(reset,1500)

    setLoading(false)
  }

  const reset = ()=>{
    setFiles([])
    setProgress(0)
    setTotal(0)
    setResult([])
  }

  return(
    <div className="song-upload-modern">

      {/* 🔥 複数選択 */}
      <label className="song-drop">
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

      {result.length > 0 && (
        <div className="section-title">New Uploads</div>
      )}

      {result.map(song => (
        <SongCard 
          key={`new-${song.id}`}
          song={{
            id: song.id,
            title: song.title,
            artist: song.artists ?? song.artist ?? "Unknown",
            image: song.cover_url || song.image
          }}
        />
      ))}

      <div className="section-title">Recent</div>

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
        />
      ))}

    </div>
  )
}
