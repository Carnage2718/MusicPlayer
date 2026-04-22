import "./AppHeader.css"

export default function AppHeader({ title }) {

  return (

    <div className="app-header">

      <img
        src="/headphone_transparent_stretched.png"
        className="app-header-icon"
        alt="MusicPlayer"
      />

      <div className="main-title">
        {title}
      </div>

    </div>

  )

}