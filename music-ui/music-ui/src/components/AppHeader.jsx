import "./AppHeader.css"

export default function AppHeader({ title }) {

  return (

    <div className="app-header">

      <img
        src="/icon_nobackground.png"
        className="app-header-icon"
        alt="MusicPlayer"
      />

      <div className="main-title">
        {title}
      </div>

    </div>

  )

}