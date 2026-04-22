export default function ArtistLinks({ artists = [], onOpenArtist }) {

  const main = artists.filter(a => a.role === "main")
  const feat = artists.filter(a => a.role === "featuring")

  const handleClick = (e, artist) => {
    e.stopPropagation()
    onOpenArtist?.(artist)
  }

  return (
    <>
      {/* main */}
      {main.map((artist, i) => (
        <span key={artist.id}>
          <span
            className="artist-link"
            onClick={(e)=>handleClick(e, artist)}
          >
            {artist.name}
          </span>
          {i < main.length - 1 && ", "}
        </span>
      ))}

      {/* ft */}
      {feat.length > 0 && " ft. "}

      {feat.map((artist, i) => (
        <span key={artist.id}>
          <span
            className="artist-link"
            onClick={(e)=>handleClick(e, artist)}
          >
            {artist.name}
          </span>
          {i < feat.length - 1 && ", "}
        </span>
      ))}
    </>
  )
}