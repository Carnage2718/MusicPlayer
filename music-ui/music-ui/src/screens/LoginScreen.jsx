import { useEffect, useRef, useState } from "react"
import "./LoginScreen.css"

export default function LoginScreen(){

  const canvasRef = useRef(null)

  const [id,setId] = useState("")
  const [pass,setPass] = useState("")

  // =========================
  // 球体アニメーション
  // =========================
  useEffect(()=>{

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    let w,h
    const resize = ()=>{
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize",resize)

    // cover画像ダミー（実際はAPIから取得でもOK）
    const covers = []
    for(let i=0;i<40;i++){
      const img = new Image()
      img.src = `https://picsum.photos/200?random=${i}`
      covers.push(img)
    }

    let angle = 0

    const render = ()=>{
      ctx.clearRect(0,0,w,h)

      const cx = w/2
      const cy = h/2 - 80
      const radius = 180

      angle += 0.003

      covers.forEach((img,i)=>{

        const a = (i / covers.length) * Math.PI * 2 + angle
        const x = cx + Math.cos(a) * radius
        const y = cy + Math.sin(a) * radius * 0.5

        const scale = (Math.sin(a)+1)/2 * 0.6 + 0.4
        const size = 60 * scale

        ctx.globalAlpha = scale

        ctx.drawImage(
          img,
          x - size/2,
          y - size/2,
          size,
          size
        )
      })

      requestAnimationFrame(render)
    }

    render()

    return ()=> window.removeEventListener("resize",resize)

  },[])

  // =========================
  // ログイン処理
  // =========================
  const handleLogin = async ()=>{

    // 仮：固定認証（ベータ用）
    if(id === "test" && pass === "1234"){
      localStorage.setItem("auth","true")
      window.location.reload()
    }else{
      alert("IDまたはパスワードが違います")
    }
  }

  return(
    <div className="login-screen">

      {/* 背景球 */}
      <canvas ref={canvasRef} className="bg-canvas"/>

      {/* フォーム */}
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