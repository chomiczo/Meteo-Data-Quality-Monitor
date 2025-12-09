// Stałe pomocnicze do przeliczania zakresów czasu
const H = 60 * 60
const D = H * 24
const W = D * 7

class Graph {
  constructor(canvas, overlay) {
    this.canvas = canvas
    this.overlay = overlay
    this.colPrefix = ''          // aktywny prefiks kolumny (filtr danych)
    this.graphType = 'scatter'   // aktualny typ wykresu

    this.frameReq = 0            // requestAnimationFrame do głównego rysowania
    this.overlayFrameReq = 0     // requestAnimationFrame dla overlay (crosshair)

    this.mpos = { x: 0, y: 0 }   // aktualna pozycja myszy
    this.mstart = null           // pozycja myszy przy rozpoczęciu zaznaczania

    this.data = { rows: [], bounds: {}, desc: [] }
    this.tspan = 0               // zakres czasu (tmax - tmin)

    // Zmiana prefiksu kolumny
    document.getElementById('graph-colprefix').addEventListener('change', e => {
      this.colPrefix = e.target.value
    })

    // Zmiana typu wykresu
    document.getElementById('graph-type').addEventListener('change', e => {
      this.graphType = e.target.value
      this.render()
    })

    // Obsługa ruchu myszy — aktualizuje overlay
    this.overlay.addEventListener('mousemove', e => {
      this.mpos = { x: e.offsetX, y: e.offsetY }
      this.renderOverlay()
    })

// Początek zaznaczania zakresu czasu
    this.overlay.addEventListener('mousedown', e => {
      this.mstart = { x: e.offsetX, y: e.offsetY }
      this.renderOverlay()
    })

    // Zakończenie zaznaczania i pobranie danych dla zakresu
    // ZMIANA: mouseup na document zamiast tylko overlay
    document.addEventListener('mouseup', e => {
      if (this.mstart === null) return
      
      this.renderOverlay()
      if (this.tspan && this.mstart) {
        const tstart = this.xToData(this.mstart.x)
        const tend = this.xToData(this.mpos.x)
        // Wywołanie API pywebview po nowy zakres danych
        pywebview.api.get_data(
          this.colPrefix,
          Math.min(tstart, tend),
          Math.max(tstart, tend)
        )
      }
      this.mstart = null
    })
  }

  // Rozmiary canvasu
  get w() { return this.canvas.width }
  get h() { return this.canvas.height }

  // Marginesy wykresu
  get tpad() { return 0.05 * this.w }
  get ypad() { return 0.05 * this.h }

  // Skala osi X i Y
  get tstep() { return (this.w - this.tpad * 2) / this.tspan }
  get ystep() { return (this.h - this.ypad * 2) / this.yspan }

  // Ustawienie nowych danych do rysowania
  setData(data) {
    this.data = data
    this.tmin = data.bounds.tmin
    this.tmax = data.bounds.tmax
    this.ymin = data.bounds.ymin
    this.ymax = data.bounds.ymax
    this.tspan = this.tmax - this.tmin
    this.yspan = this.ymax - this.ymin
  }

  // --- Konwersje danych ↔ piksele ---
  dataToX(t) { return (t - this.tmin) * this.tstep + this.tpad }
  dataToY(y) { return this.h - ((y - this.ymin) * this.ystep + this.ypad) }
  xToData(x) { return (x - this.tpad) / this.tstep + this.tmin }
  yToData(y) { return (this.h - y - this.ypad) / this.ystep + this.ymin }

  // Format wyświetlania daty z pozycji X
  xToDateString(x) {
    return new Date(this.xToData(x) * 1000)
      .toISOString()
      .substring(0, 19)
      .replace('T', ' ')
  }

  // Kolor dla serii danych (na podstawie indeksu)
  color(x) {
    return `hsla(${x * 264 + 36}, 100%, 60%, 1)`
  }

  // Główne renderowanie wykresu
  render() {
    cancelAnimationFrame(this.frameReq)
    this.frameReq = requestAnimationFrame(() => {
      if (!this.tspan) return

      // Dopasowanie rozmiaru canvasów do kontenera
      const { width, height } = this.canvas.parentElement.getBoundingClientRect()
      this.canvas.width = width
      this.canvas.height = height
      this.overlay.width = width
      this.overlay.height = height

      /** @type {CanvasRenderingContext2D} */
      const ctx = this.canvas.getContext('2d')

      // Punkty siatki czasowej (godziny, dni, tygodnie)
      const hTick = Math.floor(this.tmin / H) * H
      const dTick = Math.floor(this.tmin / D) * D
      const wTick = Math.floor(this.tmin / W) * W

      // Rysowanie siatki zależnej od skali czasu
      ctx.setLineDash([])

      // Siatka godzinowa przy niewielkim zakresie
      if (this.tspan <= 7 * D) {
        ctx.strokeStyle = '#fff4'
        ctx.lineWidth = 0.75
        for (let x = hTick - H; x <= this.tmax + H; x += H) {
          ctx.beginPath()
          ctx.moveTo(this.dataToX(x), 0)
          ctx.lineTo(this.dataToX(x), this.h)
          ctx.stroke()
        }
      }

      // Siatka dzienna
      if (this.tspan <= 3 * W) {
        ctx.strokeStyle = '#fff8'
        ctx.lineWidth = 1
        for (let x = dTick - D; x <= this.tmax + D; x += D) {
          ctx.beginPath()
          ctx.moveTo(this.dataToX(x), 0)
          ctx.lineTo(this.dataToX(x), this.h)
          ctx.stroke()
        }
      }

      // Siatka tygodniowa (zawsze)
      for (let x = wTick - W; x <= this.tmax + W; x += W) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.25
        ctx.beginPath()
        ctx.moveTo(this.dataToX(x), 0)
        ctx.lineTo(this.dataToX(x), this.h)
        ctx.stroke()
      }
      
      // Rysowanie Osi Y (Wartości i poziome linie)
     const numSteps = 10
     const stepVal = this.yspan / numSteps
     ctx.font = '11px monospace'
     ctx.textAlign = 'right'
     ctx.textBaseline = 'middle'
     for (let i = 0; i <= numSteps; i++) {
       // Oblicz wartość i pozycję Y
       const val = this.ymin + (i * stepVal)
       const yPix = this.dataToY(val)
       // Pomiń rysowanie, jeśli wychodzi poza canvas (marginesy bezpieczeństwa)
       if (yPix < 0 || yPix > this.h) continue
       // Rysowanie delikatnej poziomej linii siatki (opcjonalne, ułatwia czytanie)
       ctx.strokeStyle = '#fff2'
       ctx.lineWidth = 1
       ctx.setLineDash([])
       ctx.beginPath()
       ctx.moveTo(this.tpad, yPix)
       ctx.lineTo(this.w, yPix)
       ctx.stroke()
       // Rysowanie kreski (tick) na osi
       ctx.strokeStyle = '#fff'
       ctx.lineWidth = 1
       ctx.beginPath()
       ctx.moveTo(this.tpad, yPix)
       ctx.lineTo(this.tpad - 5, yPix)
       ctx.stroke()
       // Rysowanie tekstu z wartością
       ctx.fillStyle = '#ccc'
       ctx.fillText(val.toFixed(2), this.tpad - 8, yPix)
     }
     // Rysowanie głównej pionowej kreski osi Y
     ctx.strokeStyle = '#fff'
     ctx.lineWidth = 1
     ctx.beginPath()
     ctx.moveTo(this.tpad, 0)
     ctx.lineTo(this.tpad, this.h)
     ctx.stroke()

      // Rysowanie wartości (scatter, bar, line)
      let lastRow = null
      this.data.rows.forEach(row => {
        const [t, ...ys] = row
        const x = this.dataToX(t)

        ys.forEach((y, j) => {
          // Domyślny kolor serii
          let color = this.color(j / ys.length)
          const colname = this.data.desc[j]

          // Reguły alarmowe (min/max)
          for (const rule of rules) {
            if (colname.startsWith(rule.prefix) && rule.enabled) {
              try { if (y <= parseFloat(rule.min)) color = 'red' } catch {}
              try { if (y >= parseFloat(rule.max)) color = 'red' } catch {}
            }
          }

          ctx.fillStyle = color
          ctx.strokeStyle = color
          ctx.setLineDash([])
          ctx.lineWidth = 1

          // Tryby rysowania
          switch (this.graphType) {
            case 'scatter':
              ctx.beginPath()
              ctx.arc(x, this.dataToY(y), 1, 0, Math.PI * 2)
              ctx.fill()
              break

            case 'bar':
              ctx.beginPath()
              ctx.moveTo(x, this.h - this.ypad)
              ctx.lineTo(x, this.dataToY(y))
              ctx.stroke()
              break

            case 'line':
              if (lastRow) {
                ctx.beginPath()
                ctx.moveTo(
                  this.dataToX(lastRow[0]),
                  this.dataToY(lastRow[j + 1])
                )
                ctx.lineTo(x, this.dataToY(y))
                ctx.stroke()
              }
              break
          }
        })

        lastRow = row
      })

      // Linie progowe (min/max z rules)
      ctx.lineWidth = 1
      ctx.setLineDash([8, 8])
      ctx.strokeStyle = '#f008'

      for (const rule of rules) {
        if (rule.enabled && rule.prefix.toLowerCase().startsWith(this.colPrefix.toLowerCase())) {
          try {
            const m = parseFloat(rule.min)
            ctx.beginPath()
            ctx.moveTo(0, this.dataToY(m))
            ctx.lineTo(this.w, this.dataToY(m))
            ctx.stroke()
          } catch {}

          try {
            const m = parseFloat(rule.max)
            ctx.beginPath()
            ctx.moveTo(0, this.dataToY(m))
            ctx.lineTo(this.w, this.dataToY(m))
            ctx.stroke()
          } catch {}
        }
      }

      // Ukrycie paska postępu
      document.querySelector('#graph-progress > div').style.opacity = 0
    })
  }

  // Overlay: crosshair, tooltip, zaznaczanie zakresu
  renderOverlay() {
    cancelAnimationFrame(this.overlayFrameReq)
    this.overlayFrameReq = requestAnimationFrame(() => {
      /** @type {CanvasRenderingContext2D} */
      const ctx = this.overlay.getContext('2d')
      ctx.clearRect(0, 0, this.w, this.h)

      ctx.setLineDash([4, 4])
      ctx.strokeStyle = '#fff'

      // Aktualizacja wyświetlanych wartości pod kursorem
      if (this.tspan) {
        if (this.mstart) {
          document.getElementById('graph-current-t').innerText =
            `${this.xToDateString(this.mstart.x)} – ${this.xToDateString(this.mpos.x)}`
        } else {
          document.getElementById('graph-current-t').innerText =
            `${this.xToDateString(this.mpos.x)}`
        }

        document.getElementById('graph-current-y').innerText =
          `${this.yToData(this.mpos.y).toFixed(4)}`
      }

      // Linie kursora
      ctx.beginPath()
      ctx.moveTo(this.mpos.x, 0)
      ctx.lineTo(this.mpos.x, this.h)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, this.mpos.y)
      ctx.lineTo(this.w, this.mpos.y)
      ctx.stroke()

      // Tooltipy i szukanie najbliższego punktu (tylko gdy nie zaznaczamy)
      if (this.mstart === null) {
        const x = this.xToData(this.mpos.x)

        // Szukanie najbliższych próbek czasowych
        const closestRows = this.data.rows.filter(
          row => Math.abs(row[0] - x) < this.tspan / this.data.rows.length / 2
        )

        if (closestRows.length > 0) {
          const row = closestRows[0]
          const [t, ...ys] = row

          // Najbliższa wartość na osi Y
          const ysI = ys.map((y, i) => [y, i])
          ysI.sort(
            (a, b) =>
              Math.abs(this.yToData(this.mpos.y) - a[0]) -
              Math.abs(this.yToData(this.mpos.y) - b[0])
          )
          const [closestY, closestYIndex] = ysI[0]

          // Pozycja punktu w pikselach
          const xx = this.dataToX(t)
          const yy = this.dataToY(closestY)

          // Kółko podświetlające najbliższy punkt
          ctx.strokeStyle = this.color(closestYIndex / ys.length)
          ctx.setLineDash([])
          ctx.lineWidth = 4

          ctx.beginPath()
          ctx.arc(xx, yy, 4, 0, Math.PI * 2)
          ctx.stroke()

          // Tooltip z wartością
          ctx.font = '12px monospace'

          let textM = ctx.measureText(
            `${this.data.desc[closestYIndex]} = ${closestY.toFixed(4)}`
          )

          ctx.fillStyle = '#000f'
          ctx.fillRect(
            xx + 8,
            this.mpos.y + 4 + 12 - textM.fontBoundingBoxAscent,
            textM.width + 8,
            textM.fontBoundingBoxAscent + textM.fontBoundingBoxDescent + 8
          )

          ctx.fillStyle = this.color(closestYIndex / ys.length)
          ctx.fillText(
            `${this.data.desc[closestYIndex]} = ${closestY.toFixed(4)}`,
            xx + 12,
            this.mpos.y + 8 + 12
          )

          // Tooltip z datą punktu
          textM = ctx.measureText(`${this.xToDateString(xx)}`)

          ctx.fillStyle = '#000f'
          ctx.fillRect(
            xx + 8,
            this.mpos.y + 4 + 12 - textM.fontBoundingBoxAscent - 8 - 12 - 8,
            textM.width + 8,
            textM.fontBoundingBoxAscent + textM.fontBoundingBoxDescent + 8
          )

          ctx.fillStyle = this.color(closestYIndex / ys.length)
          ctx.fillText(
            `${this.xToDateString(xx)}`,
            xx + 12,
            this.mpos.y - 8
          )
        }
      } else {
        // Zaznaczanie zakresu czasu — przyciemnienie obszaru poza zaznaczeniem
        ctx.fillStyle = '#00000040'
        const xmin = Math.min(this.mstart.x, this.mpos.x)
        const xmax = Math.max(this.mstart.x, this.mpos.x)

        ctx.fillRect(0, 0, xmin, this.h)
        ctx.fillRect(xmax, 0, this.w, this.h)
      }
    })
  }
}

// Inicjalizacja wykresu
const graph = new Graph(
  document.getElementById('graph-canvas'),
  document.getElementById('graph-canvas-overlay')
)
