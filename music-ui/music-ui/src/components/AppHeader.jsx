import "./AppHeader.css"

export default function AppHeader({ title, rightAction }) {

  return (

    <div className="app-header">

      <div className="header-left">

        <img
          src="/icon_nobackground.png"
          className="app-header-icon"
          alt="MusicPlayer"
        />

        <div className="main-title">
          {title}
        </div>

      </div>

      <div className="header-right">
        {rightAction}
      </div>

    </div>
  )

}