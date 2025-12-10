// Stałe pomocnicze do przeliczania zakresów czasu
const H = 60 * 60
const D = H * 24
const W = D * 7

class Graph {
  constructor(canvas, overlay) {
    this.canvas = canvas
    this.overlay = overlay
    this.colPrefix = ''
    this.graphType = 'scatter'

    this.frameReq = 0
    this.overlayFrameReq = 0

    this.mpos = { x: 0, y: 0 }
    this.mstart = null

    this.data = { rows: [], bounds: {}, desc: [] }
    this.tspan = 0

    // 🆕 Historia zoom
    this.zoomHistory = []
    this.zoomHistoryIndex = -1

    // 🆕 Widoczność kolumn (true = pokazuj, false = ukryj)
    this.columnVisibility = {}

    document.getElementById('graph-colprefix').addEventListener('change', e => {
      this.colPrefix = e.target.value
    })

    document.getElementById('graph-type').addEventListener('change', e => {
      this.graphType = e.target.value
      this.render()
    })

    this.overlay.addEventListener('mousemove', e => {
      this.mpos = { x: e.offsetX, y: e.offsetY }
      this.renderOverlay()
    })

    this.overlay.addEventListener('mousedown', e => {
      this.mstart = { x: e.offsetX, y: e.offsetY }
      this.renderOverlay()
    })

    document.addEventListener('mouseup', e => {
      if (!this.tspan || this.mstart === null) return

      const x1 = Math.min(this.mstart.x, this.mpos.x)
      const x2 = Math.max(this.mstart.x, this.mpos.x)
      const y1 = Math.min(this.mstart.y, this.mpos.y)
      const y2 = Math.max(this.mstart.y, this.mpos.y)

      this.mstart = null
      this.renderOverlay()

      if (Math.abs(x2 - x1) < 5 || Math.abs(y2 - y1) < 5) return

      // Konwersja pikseli na wartości danych
      const tmin = this.xToData(x1)
      const tmax = this.xToData(x2)
      const ymin = this.yToData(y2) // odwrotnie
      const ymax = this.yToData(y1)

      // 🆕 Zapisz aktualny stan do historii PRZED zmianą
      this.saveZoomState()

      // Zapisujemy ZOOM X + ZOOM Y
      this.tmin = Math.min(tmin, tmax)
      this.tmax = Math.max(tmin, tmax)
      this.ymin = Math.min(ymin, ymax)
      this.ymax = Math.max(ymin, ymax)

      this.tspan = this.tmax - this.tmin
      this.yspan = this.ymax - this.ymin

      // Renderujemy bez pobierania nowych danych
      this.render()
    })
  }

  get w() { return this.canvas.width }
  get h() { return this.canvas.height }

  get tpad() { return 0.05 * this.w }
  get ypad() { return 0.05 * this.h }

  get tstep() { return (this.w - this.tpad * 2) / this.tspan }
  get ystep() { return (this.h - this.ypad * 2) / this.yspan }

  // 🆕 Zapisz aktualny stan zoom do historii
  saveZoomState() {
    // Usuń wszystko po aktualnym indeksie (jak w edytorze tekstu)
    this.zoomHistory = this.zoomHistory.slice(0, this.zoomHistoryIndex + 1)
    
    // Dodaj nowy stan
    this.zoomHistory.push({
      tmin: this.tmin,
      tmax: this.tmax,
      ymin: this.ymin,
      ymax: this.ymax,
      tspan: this.tspan,
      yspan: this.yspan
    })
    
    this.zoomHistoryIndex++
  }

  // 🆕 Cofnij zoom (Ctrl+Z)
  historyBack() {
    if (this.zoomHistoryIndex > 0) {
      this.zoomHistoryIndex--
      this.restoreZoomState()
    }
  }

  // 🆕 Przywróć zoom (Ctrl+Y / Ctrl+Shift+Z)
  historyNext() {
    if (this.zoomHistoryIndex < this.zoomHistory.length - 1) {
      this.zoomHistoryIndex++
      this.restoreZoomState()
    }
  }

  // 🆕 Przywróć stan zoom z historii
  restoreZoomState() {
    const state = this.zoomHistory[this.zoomHistoryIndex]
    if (state) {
      this.tmin = state.tmin
      this.tmax = state.tmax
      this.ymin = state.ymin
      this.ymax = state.ymax
      this.tspan = state.tspan
      this.yspan = state.yspan
      this.render()
    }
  }

  setData(data) {
    this.data = data
    this.tmin = data.bounds.tmin
    this.tmax = data.bounds.tmax
    this.ymin = data.bounds.ymin
    this.ymax = data.bounds.ymax
    this.tspan = this.tmax - this.tmin
    this.yspan = this.ymax - this.ymin

    // 🆕 Inicjalizuj widoczność wszystkich kolumn jako true
    data.desc.forEach(colname => {
      if (this.columnVisibility[colname] === undefined) {
        this.columnVisibility[colname] = true
      }
    })

    // 🆕 Zresetuj historię i zapisz początkowy stan
    this.zoomHistory = [{
      tmin: this.tmin,
      tmax: this.tmax,
      ymin: this.ymin,
      ymax: this.ymax,
      tspan: this.tspan,
      yspan: this.yspan
    }]
    this.zoomHistoryIndex = 0
  }

  dataToX(t) { return (t - this.tmin) * this.tstep + this.tpad }
  dataToY(y) { return this.h - ((y - this.ymin) * this.ystep + this.ypad) }
  xToData(x) { return (x - this.tpad) / this.tstep + this.tmin }
  yToData(y) { return (this.h - y - this.ypad) / this.ystep + this.ymin }

  xToDateString(x) {
    return new Date(this.xToData(x) * 1000)
      .toISOString()
      .substring(0, 19)
      .replace('T', ' ')
  }

  color(x) {
    return `hsla(${x * 264 + 36}, 100%, 60%, 1)`
  }

  render() {
    cancelAnimationFrame(this.frameReq)
    this.frameReq = requestAnimationFrame(() => {
      if (!this.tspan) return

      const { width, height } = this.canvas.parentElement.getBoundingClientRect()
      this.canvas.width = width
      this.canvas.height = height
      this.overlay.width = width
      this.overlay.height = height

      const ctx = this.canvas.getContext('2d')

      const hTick = Math.floor(this.tmin / H) * H
      const dTick = Math.floor(this.tmin / D) * D
      const wTick = Math.floor(this.tmin / W) * W

      ctx.setLineDash([])

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

      for (let x = wTick - W; x <= this.tmax + W; x += W) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.25
        ctx.beginPath()
        ctx.moveTo(this.dataToX(x), 0)
        ctx.lineTo(this.dataToX(x), this.h)
        ctx.stroke()
      }

      const numSteps = 10
      const stepVal = this.yspan / numSteps
      ctx.font = '11px monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (let i = 0; i <= numSteps; i++) {
        const val = this.ymin + (i * stepVal)
        const yPix = this.dataToY(val)
        if (yPix < 0 || yPix > this.h) continue
        ctx.strokeStyle = '#fff2'
        ctx.lineWidth = 1
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(this.tpad, yPix)
        ctx.lineTo(this.w, yPix)
        ctx.stroke()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(this.tpad, yPix)
        ctx.lineTo(this.tpad - 5, yPix)
        ctx.stroke()
        ctx.fillStyle = '#ccc'
        ctx.fillText(val.toFixed(2), this.tpad - 8, yPix)
      }

      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(this.tpad, 0)
      ctx.lineTo(this.tpad, this.h)
      ctx.stroke()

      let lastRow = null
      this.data.rows.forEach(row => {
        const [t, ...ys] = row
        const x = this.dataToX(t)
        ys.forEach((y, j) => {
          // 🆕 Sprawdź widoczność kolumny
          const colname = this.data.desc[j]
          if (!this.columnVisibility[colname]) return

          if (y < this.ymin || y > this.ymax) return
          let color = this.color(j / ys.length)
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
              if (lastRow && this.columnVisibility[this.data.desc[j]]) {
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

      document.querySelector('#graph-progress > div').style.opacity = 0
    })
  }

  renderOverlay() {
    cancelAnimationFrame(this.overlayFrameReq)
    this.overlayFrameReq = requestAnimationFrame(() => {
      const ctx = this.overlay.getContext('2d')
      ctx.clearRect(0, 0, this.w, this.h)

      if (!this.tspan) return

      if (this.mstart) {
        document.getElementById('graph-current-t').innerText =
          `${this.xToDateString(this.mstart.x)} – ${this.xToDateString(this.mpos.x)}`
      } else {
        document.getElementById('graph-current-t').innerText =
          `${this.xToDateString(this.mpos.x)}`
      }
      document.getElementById('graph-current-y').innerText =
        `${this.yToData(this.mpos.y).toFixed(4)}`

      if (this.mstart === null) {
        ctx.setLineDash([4, 4])
        ctx.strokeStyle = '#fff'

        ctx.beginPath()
        ctx.moveTo(this.mpos.x, 0)
        ctx.lineTo(this.mpos.x, this.h)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(0, this.mpos.y)
        ctx.lineTo(this.w, this.mpos.y)
        ctx.stroke()

        const x = this.xToData(this.mpos.x)
        const closestRows = this.data.rows.filter(
          row => Math.abs(row[0] - x) < this.tspan / this.data.rows.length / 2
        )
        if (closestRows.length > 0) {
          const row = closestRows[0]
          const [t, ...ys] = row
          const ysI = ys.map((y, i) => [y, i])
          ysI.sort(
            (a, b) =>
              Math.abs(this.yToData(this.mpos.y) - a[0]) -
              Math.abs(this.yToData(this.mpos.y) - b[0])
          )
          const [closestY, closestYIndex] = ysI[0]
          const xx = this.dataToX(t)
          const yy = this.dataToY(closestY)

          ctx.strokeStyle = this.color(closestYIndex / ys.length)
          ctx.setLineDash([])
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.arc(xx, yy, 4, 0, Math.PI * 2)
          ctx.stroke()

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

        return
      }

      const xmin = Math.min(this.mstart.x, this.mpos.x)
      const xmax = Math.max(this.mstart.x, this.mpos.x)
      const ymin = Math.min(this.mstart.y, this.mpos.y)
      const ymax = Math.max(this.mstart.y, this.mpos.y)

      ctx.fillStyle = '#00000040'
      ctx.fillRect(0, 0, this.w, ymin)
      ctx.fillRect(0, ymax, this.w, this.h - ymax)
      ctx.fillRect(0, ymin, xmin, ymax - ymin)
      ctx.fillRect(xmax, ymin, this.w - xmax, ymax - ymin)

      ctx.setLineDash([6, 4])
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(
        xmin,
        ymin,
        xmax - xmin,
        ymax - ymin
      )
    })
  }
}

const graph = new Graph(
  document.getElementById('graph-canvas'),
  document.getElementById('graph-canvas-overlay')
)