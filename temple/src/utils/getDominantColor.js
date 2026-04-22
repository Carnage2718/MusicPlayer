export default function getDominantColor(imageUrl) {

  return new Promise((resolve) => {

    const img = new Image()
    img.crossOrigin = "Anonymous"
    img.src = imageUrl

    img.onload = () => {

      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")

      canvas.width = img.width
      canvas.height = img.height

      ctx.drawImage(img,0,0)

      const data = ctx.getImageData(
        0,0,img.width,img.height
      ).data

      let r = 0
      let g = 0
      let b = 0
      let count = 0

      for (let i=0;i<data.length;i+=40){

        r += data[i]
        g += data[i+1]
        b += data[i+2]

        count++

      }

      r = Math.floor(r/count)
      g = Math.floor(g/count)
      b = Math.floor(b/count)

      resolve(`rgb(${r},${g},${b})`)

    }

  })

}