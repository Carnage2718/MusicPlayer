import { useEffect, useMemo, useState } from "react"
import "./LoginScreen.css"
import API_BASE from "../api"

export default function LoginScreen(){

  const [id,setId] = useState("")
  const [pass,setPass] = useState("")
  const [covers,setCovers] = useState([])

  // =========================
  // COVER LOAD
  // =========================

  useEffect(()=>{

    const load = async ()=>{

      try{

        const res = await fetch(
          `${API_BASE}/songs/limit/100`
        )

        const data = await res.json()

        setCovers(data)

      }catch(e){
        console.error(e)
      }
    }

    load()

  },[])

  // =========================
  // DOUBLE LIST
  // seamless loop
  // =========================

  const rows = useMemo(()=>{

    if(!covers.length) return []

    const perRow = 16
    const arr = []

    for(let i=0;i<13;i++){

      const start =
        (i * perRow) % covers.length

      const row = Array.from(
        { length: perRow },
        (_, j) =>
          covers[
            (start + j) % covers.length
          ]
      )

      arr.push([
        ...row,
        ...row,
        ...row
      ])
    }

    return arr

  },[covers])

  // =========================
  // LOGIN
  // =========================

  const handleLogin = async ()=>{

    try{

      const res = await fetch(
        `${API_BASE}/auth/login`,
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json"
          },
          body:JSON.stringify({
            login_id:id,
            password:pass
          })
        }
      )

      if(!res.ok){
        alert("ログイン失敗")
        return
      }

      const data = await res.json()

      localStorage.setItem("token",data.token)
      localStorage.setItem("user_id",data.user_id)

      window.location.reload()

    }catch(e){
      console.error(e)
      alert("接続エラー")
    }
  }

  return(

    <div className="login-screen">

      {/* BG */}

      <div className="cover-flow-wrap">

        <div className="cover-wall">

          {rows.map((row,rowIndex)=>(

            <div
              className={
                `cover-row ${
                  rowIndex % 2 === 0
                    ? "left-flow"
                    : "right-flow"
                }`
              }
              key={rowIndex}
            >

              {row.map((song,i)=>(

                <div
                  className="flow-cover"
                  key={`${rowIndex}-${i}`}
                >
                  <img
                    src={song.image}
                    alt=""
                    loading="lazy"
                  />
                </div>

              ))}

            </div>

          ))}

        </div>

      </div>
      {/* glow */}

      <div className="bg-glow"/>

      {/* brand */}

      <div className="login-brand">

        <img
          src="/icon_rock_square.png"
          alt=""
          className="brand-logo"
        />

        <h1>Music Player</h1>

        <p>NO MUSIC NO LIFE</p>

      </div>

      {/* form */}

      <div className="login-box">

        <input
          placeholder="ログインID"
          value={id}
          onChange={e=>setId(e.target.value)}
        />

        <input
          type="password"
          placeholder="パスワード"
          value={pass}
          onChange={e=>setPass(e.target.value)}
        />

        <button onClick={handleLogin}>
          ログイン
        </button>

        <p className="login-note">
          ベータテスト用IDのみ利用可能
        </p>

      </div>

    </div>
  )
}