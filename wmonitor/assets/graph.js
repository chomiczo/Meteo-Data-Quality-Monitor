/* ===========================================================================
   assets/graph.js
   Główny moduł odpowiedzialny za interaktywny wykres czasowy w aplikacji
   METEO-DATA-QUALITY-MONITOR
   =========================================================================== */

const H = 60 * 60                     // 1 godzina w sekundach
const D = H * 24                      // 1 dzień w sekundach
const W = D * 7                       // 1 tydzień w sekundach

class Graph {
  constructor(canvas, overlay) {
    // Referencje do canvasów
    this.canvas = canvas               // główny canvas – tu rysujemy dane i siatkę
    this.overlay = overlay             // przezroczysty canvas na górze – do interakcji (kursor, zoom)

    this.colPrefix = ''                // aktualny filtr kolumn (np. 't_', 'rh_', 'p_')
    this.graphType = 'scatter'         // aktualny typ wykresu: scatter / line / bar

    // Identyfikatory requestAnimationFrame – do anulowania animacji
    this.frameReq = 0
    this.overlayFrameReq = 0

    // Pozycja myszy i zaznaczenie do zoomu
    this.mpos = { x: 0, y: 0 }         // aktualna pozycja kursora
    this.mstart = null                 // punkt startu zaznaczenia (mousedown)

    // Dane otrzymane z Pythona przez pywebview
    this.data = { rows: [], bounds: {}, desc: [] }
    this.tspan = 0                     // aktualny zakres czasu (w sekundach)

    // Zmiana filtra kolumn (np. temperatura, wilgotność, ciśnienie)
    document.getElementById('graph-colprefix').addEventListener('change', e => {
      this.colPrefix = e.target.value
    })

    // Zmiana typu wykresu (scatter / line / bar)
    document.getElementById('graph-type').addEventListener('change', e => {
      this.graphType = e.target.value
      this.render()                    // przerysuj od razu po zmianie
    })

    // Śledzenie ruchu myszy – aktualizacja podglądu czasu i wartości
    this.overlay.addEventListener('mousemove', e => {
      this.mpos = {
        x: e.offsetX,
        y: e.offsetY,
      }
      this.renderOverlay()
    })

    // Rozpoczęcie zaznaczania obszaru do zoomu
    this.overlay.addEventListener('mousedown', e => {
      this.mstart = {
        x: e.offsetX,
        y: e.offsetY,
      }
      this.renderOverlay()
    })

    // Zakończenie zaznaczania → wykonaj zoom (pobierz dane z nowego zakresu)
    this.overlay.addEventListener('mouseup', e => {
      this.renderOverlay()             // odśwież overlay

      if (this.tspan) {                // tylko jeśli mamy już jakieś dane
        const tstart = this.xToData(this.mstart.x)
        const tend = this.xToData(this.mpos.x)

        // Wywołujemy Pythona – pobieramy dane tylko z zaznaczonego zakresu
        pywebview.api.get_data(
          this.colPrefix,
          Math.min(tstart, tend),
          Math.max(tstart, tend),
        )

        this.mstart = null             // resetujemy zaznaczenie
      }
    })
  }

  // Wymiary canvasu
  get w() { return this.canvas.width }
  get h() { return this.canvas.height }

  // Marginesy (5% z każdej strony)
  get tpad() { return 0.05 * this.w }   // margines poziomy
  get ypad() { return 0.05 * this.h }   // margines pionowy

  // Skala (ile pikseli przypada na sekundę / jednostkę Y)
  get tstep() { return (this.w - this.tpad * 2) / this.tspan }
  get ystep() { return (this.h - this.ypad * 2) / this.yspan }

  // Przyjmowanie nowych danych z Pythona (po wywołaniu get_data)
  setData(data) {
    this.data = data
    this.tmin = data.bounds.tmin
    this.tmax = data.bounds.tmax
    this.ymin = data.bounds.ymin
    this.ymax = data.bounds.ymax
    this.tspan = this.tmax - this.tmin
    this.yspan = this.ymax - this.ymin
  }

  // Konwersja: czas (Unix timestamp) → pozycja X na canvasie
  dataToX(t) {
    return (t - this.tmin) * this.tstep + this.tpad
  }

  // Konwersja: wartość Y → pozycja Y na canvasie (odwrócona oś Y!)
  dataToY(y) {
    return this.h - ((y - this.ymin) * this.ystep + this.ypad)
  }

  // Konwersja odwrotna: X → czas
  xToData(x) {
    return (x - this.tpad) / this.tstep + this.tmin
  }

  // Formatowanie czasu pod kursorem (np. "2024-04-15 12:30:45")
  xToDateString(x) {
    return new Date(this.xToData(x) * 1000)
      .toISOString()
      .substring(0, 19)
      .replace('T', ' ')
  }

  // Konwersja odwrotna: Y → wartość
  yToData(y) {
    return (this.h - y - this.ypad) / this.ystep + this.ymin
  }

  // Generowanie różnych kolorów dla każdej serii danych (tęczowe)
  color(x) {
    return `hsla(${x * 264 + 36}, 100%, 50%, 1)`
  }

  // Główne rysowanie wykresu
  render() {
    cancelAnimationFrame(this.frameReq)
    this.frameReq = requestAnimationFrame(() => {
      if (!this.tspan) {               // brak danych → nic nie rysujemy
        return
      }

      // Responsywność – dopasowanie canvasu do rozmiaru kontenera
      const { width, height } = this.canvas.parentElement.getBoundingClientRect()
      this.canvas.width = width
      this.canvas.height = height
      this.overlay.width = width
      this.overlay.height = height

      const ctx = this.canvas.getContext('2d')

      // Przygotowanie siatki czasowej (godziny, dni, tygodnie)
      const hTick = Math.floor(this.tmin / H) * H
      const dTick = Math.floor(this.tmin / D) * D
      const wTick = Math.floor(this.tmin / W) * W

      ctx.setLineDash([])

      // Linie godzinowe (widoczne tylko przy zoomie ≤ 7 dni)
      if (this.tspan <= 7 * D) {
        ctx.strokeStyle = '#fff4'      // bardzo przezroczyste
        ctx.lineWidth = 0.75
        for (let x = hTick - H; x <= this.tmax + H; x += H) {
          ctx.beginPath()
          ctx.moveTo(this.dataToX(x), 0)
          ctx.lineTo(this.dataToX(x), this.h)
          ctx.stroke()
        }
      }

      // Linie dzienne (widoczne przy zoomie ≤ 3 tygodnie)
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

      // Linie tygodniowe – zawsze widoczne
      for (let x = wTick - W; x <= this.tmax + W; x += W) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.25
        ctx.beginPath()
        ctx.moveTo(this.dataToX(x), 0)
        ctx.lineTo(this.dataToX(x), this.h)
        ctx.stroke()
      }

      // Rysowanie danych pomiarowych
      let lastRow = null
      this.data.rows.forEach((row, i) => {
        const [t, ...ys] = row
        const x = this.dataToX(t)

        ys.forEach((y, j) => {
          if (y === null) return        // pomijamy brak danych

          let color = this.color(j / ys.length)  // domyślny kolor serii
          const colname = this.data.desc[j]

          // Podświetlanie wartości poza zakresem (reguły QC z Pythona)
          for (const rule of rules) {
            if (colname.startsWith(rule.prefix) && rule.enabled) {
              try {
                const m = parseFloat(rule.min)
                if (y <= m) color = 'red'
              } catch (err) {}
              try {
                const m = parseFloat(rule.max)
                if (y >= m) color = 'red'
              } catch (err) {}
            }
          }

          ctx.fillStyle = color
          ctx.strokeStyle = color
          ctx.setLineDash([])
          ctx.lineWidth = 1

          switch (this.graphType) {
            case 'scatter':
              const y_ = this.dataToY(y)
              ctx.beginPath()
              ctx.arc(x, y_, 1, 0, Math.PI * 2)
              ctx.fill()
              break

            case 'bar':
              ctx.beginPath()
              ctx.moveTo(x, this.h - this.ypad)
              ctx.lineTo(x, this.dataToY(y))
              ctx.stroke()
              break

            case 'line':
              if (lastRow && lastRow[j + 1] !== null) {
                ctx.beginPath()
                ctx.moveTo(this.dataToX(lastRow[0]), this.dataToY(lastRow[j + 1]))
                ctx.lineTo(this.dataToX(t), this.dataToY(y))
                ctx.stroke()
              }
              break
          }
        })
        lastRow = row
      })

      // Rysowanie poziomych linii reguł (np. min/max temperatura)
      ctx.lineWidth = 1
      ctx.setLineDash([8, 8])
      ctx.strokeStyle = '#f008'        // czerwona, półprzezroczysta

      for (const rule of rules) {
        if (rule.enabled && rule.prefix.toLowerCase().startsWith(this.colPrefix.toLowerCase())) {
          try {
            const m = parseFloat(rule.min)
            ctx.beginPath()
            ctx.moveTo(0, this.dataToY(m))
            ctx.lineTo(this.w, this.dataToY(m))
            ctx.stroke()
          } catch (err) {}

          try {
            const m = parseFloat(rule.max)
            ctx.beginPath()
            ctx.moveTo(0, this.dataToY(m))
            ctx.lineTo(this.w, this.dataToY(m))
            ctx.stroke()
          } catch (err) {}
        }
      }

      // Ukrycie paska postępu po zakończeniu rysowania
      document.querySelector('#graph-progress > div').style.opacity = 0
    })
  }

  // Rysowanie overlaya: kursor, podgląd czasu/wartości, zaznaczenie do zoomu
  renderOverlay() {
    cancelAnimationFrame(this.overlayFrameReq)
    this.overlayFrameReq = requestAnimationFrame(() => {
      const ctx = this.overlay.getContext('2d')
      ctx.clearRect(0, 0, this.w, this.h)

      ctx.setLineDash([4, 4])
      ctx.lineWidth = 1
      ctx.strokeStyle = '#fff'

      if (this.tspan) {
        // Aktualizacja podglądu czasu pod kursorem
        if (this.mstart) {
          document.getElementById('graph-current-t').innerText =
            `${this.xToDateString(this.mstart.x)} – ${this.xToDateString(this.mpos.x)}`
        } else {
          document.getElementById('graph-current-t').innerText = this.xToDateString(this.mpos.x)
        }
        document.getElementById('graph-current-y').innerText = this.yToData(this.mpos.y).toFixed(4)
      }

      // Pionowa i pozioma linia kursora
      ctx.beginPath()
      ctx.moveTo(this.mpos.x, 0)
      ctx.lineTo(this.mpos.x, this.h)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(0, this.mpos.y)
      ctx.lineTo(this.w, this.mpos.y)
      ctx.stroke()

      // Podświetlenie zaznaczonego obszaru (do zoomu)
      if (this.mstart !== null) {
        ctx.fillStyle = '#00000040'    // półprzezroczysty czarny

        const xmin = Math.min(this.mstart.x, this.mpos.x)
        const xmax = Math.max(this.mstart.x, this.mpos.x)

        ctx.fillRect(0, 0, xmin, this.h)
        ctx.fillRect(xmax, 0, this.w, this.h)
      }
    })
  }
}

// Inicjalizacja głównego obiektu wykresu
const graph = new Graph(
  document.getElementById('graph-canvas'),
  document.getElementById('graph-canvas-overlay'),
)