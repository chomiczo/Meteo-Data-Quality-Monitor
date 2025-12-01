/**
 * assets/main.js
 *
 * Główny skrypt frontendowy aplikacji METEO-DATA-QUALITY-MONITOR
 * Odpowiada za:
 *  • Reakcję na zmiany stanu współdzielonego z Pythonem (pywebview.state)
 *  • Dynamiczną aktualizację interfejsu (lista stacji, prefiksy, kolumny, reguły itp.)
 *  • Obsługę reguł kontroli jakości (QC)
 *  • Automatyczne odświeżanie wykresu po zmianie danych
 */

const createRuleControl = rule => {
  // Tworzy jeden wiersz edycji reguły QC w zakładce "Reguły"
  const main = document.createElement('div')
  main.classList.add('rule-input')

  // Checkbox – czy reguła jest aktywna
  const enabledInput = document.createElement('input')
  enabledInput.type = 'checkbox'
  enabledInput.checked = !!rule.enabled

  // Pola tekstowe dla prefiksu, min i max
  const prefixInput = document.createElement('input')
  prefixInput.value = rule.prefix || ''

  const minInput = document.createElement('input')
  minInput.value = rule?.min ?? ''

  const maxInput = document.createElement('input')
  maxInput.value = rule?.max ?? ''

  // Etykiety
  const enabledLabel = document.createElement('label')
  enabledLabel.innerText = 'Wyświetlaj'
  const prefixLabel = document.createElement('label')
  prefixLabel.innerText = 'Prefiks'
  const minLabel = document.createElement('label')
  minLabel.innerText = 'Min'
  const maxLabel = document.createElement('label')
  maxLabel.innerText = 'Max'

  // Kontenery dla par label + input
  const prefixDiv = document.createElement('div')
  prefixDiv.append(prefixLabel, prefixInput)

  const enabledDiv = document.createElement('div')
  enabledDiv.append(enabledLabel, enabledInput)

  const minDiv = document.createElement('div')
  minDiv.append(minLabel, minInput)

  const maxDiv = document.createElement('div')
  maxDiv.append(maxLabel, maxInput)

  // Funkcja aktualizująca obiekt reguły i przerysowująca wykres
  const onChange = () => {
    rule.prefix = prefixInput.value.trim()
    rule.min = minInput.value.trim() || undefined
    rule.max = maxInput.value.trim() || undefined
    rule.enabled = enabledInput.checked
    graph.render()  // natychmiastowe podświetlenie wartości poza zakresem
  }

  // Nasłuchiwanie zmian w polach
  prefixInput.addEventListener('change', onChange)
  enabledInput.addEventListener('change', onChange)
  minInput.addEventListener('change', onChange)
  maxInput.addEventListener('change', onChange)

  // Zwracamy gotowy element DOM
  main.append(prefixDiv, enabledDiv, minDiv, maxDiv)
  return main
}

// Główna funkcja reagująca na zmiany stanu z Pythona
const onStateChange = e => {
  const { key } = e.detail
  pywebview.api.log(`state change ${key}`)  // debug w konsoli Pythona

  switch (key) {

    // Aktualizacja listy dostępnych stacji
    case 'stations': {
      const stlist = document.getElementById('station-list')
      stlist.innerHTML = ''  // czyścimy poprzednią listę

      for (const station of pywebview.state.stations) {
        const btn = document.createElement('button')
        btn.innerText = station
        btn.dataset.station = station
        btn.addEventListener('click', () => {
          pywebview.api.set_station(station)  // zmiana stacji w Pythonie
        })
        stlist.appendChild(btn)
      }

      // Automatyczny wybór pierwszej stacji po załadowaniu listy
      if (pywebview.state.stations.length > 0) {
        pywebview.api.set_station(pywebview.state.stations[0])
      }

      document.getElementById('graph-message').innerText =
        'Wybierz stację z menu po lewej stronie'
      break
    }

    // Wypełnienie selecta z prefiksami (raw_, qc_, final_ itd.)
    case 'prefixes': {
      const prefixSelect = document.getElementById('prefix-select')
      prefixSelect.innerHTML = ''

      for (const prefix of pywebview.state.prefixes) {
        const opt = document.createElement('option')
        opt.value = opt.innerText = prefix
        prefixSelect.appendChild(opt)
      }
      break
    }

    // Podświetlenie aktywnej stacji w menu bocznym
    case 'station': {
      document.querySelectorAll('#station-list > button').forEach(el => {
        const isActive = el.dataset.station === pywebview.state.station
        el.classList.toggle('active', isActive)
      })

      document.getElementById('graph-message').innerText = pywebview.state.station

      // Po zmianie stacji – ustawiamy aktualny prefiks (z selecta)
      const currentPrefix = document.getElementById('prefix-select').value
      if (currentPrefix) {
        pywebview.api.set_prefix(currentPrefix)
      }
      break
    }

    // Wypełnienie listy podpowiedzi dla kolumn (t_air, rh_0001 itd.)
    case 'colnames': {
      const colList = document.getElementById('colnames')
      colList.innerHTML = ''

      for (const colname of pywebview.state.colnames) {
        const opt = document.createElement('option')
        opt.value = opt.innerText = colname
        colList.appendChild(opt)
      }
      break
    }

    // Pokazanie najnowszego dostępnego timestampa + auto-ładowanie danych
    case 'latest_ts': {
      const dateStr = new Date(pywebview.state.latest_ts * 1000).toUTCString()
      document.getElementById('graph-message').innerText =
        `${pywebview.state.station} – najnowsze dane: ${dateStr}`

      // Jeśli to pierwsze dane – automatycznie ładujemy ostatnie 24h
      if (!graph.tspan) {
        document.getElementById('graph-24h').click()
      }
      break
    }

    // Otrzymano nowe dane pomiarowe – rysujemy wykres
    case 'data': {
      graph.setData(pywebview.state.data)
      graph.render()

      // Aktualizacja pól "Od" i "Do" w zakładce Dane
      const format = iso => iso.substring(0, 16)  // YYYY-MM-DDTHH:mm
      document.getElementById('graph-tmin').value =
        format(new Date(pywebview.state.data.bounds.tmin * 1000).toISOString())
      document.getElementById('graph-tmax').value =
        format(new Date(pywebview.state.data.bounds.tmax * 1000).toISOString())

      // Generowanie legendy (kolor + nazwa kolumny)
      const labels = document.getElementById('graph-labels')
      labels.innerHTML = ''
      pywebview.state.data.desc.forEach((colname, i) => {
        const div = document.createElement('div')
        div.classList.add('graph-label')
        div.style.color = graph.color(i / pywebview.state.data.desc.length)
        div.innerText = colname
        labels.appendChild(div)
      })
      break
    }

    // Aktualizacja reguł QC z konfiguracji Pythona
    case 'rules': {
      rules = []  // czyścimy poprzednie

      // Konwertujemy obiekt { "t_": { min: -50, max: 60 } } na tablicę
      for (const [prefix, r] of Object.entries(pywebview.state.rules)) {
        rules.push({ ...r, prefix, enabled: true })
      }

      const rulesDiv = document.getElementById('graph-rules')
      rulesDiv.innerHTML = ''

      for (const rule of rules) {
        rulesDiv.appendChild(createRuleControl(rule))
      }
      break
    }

    // Aktualizacja paska postępu podczas ładowania danych
    case 'progress': {
      const bar = document.querySelector('#graph-progress > div')
      bar.style.opacity = 1
      bar.style.width = `${pywebview.state.progress * 100}%`
      break
    }

    // Nieobsłużone zmiany stanu – debug
    default: {
      console.log('Nieobsłużona zmiana stanu:', e.detail)
      break
    }
  }
}