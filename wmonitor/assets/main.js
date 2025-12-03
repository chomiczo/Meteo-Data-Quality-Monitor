// Tworzy kontrolkę edycji jednej reguły filtrowania/wyświetlania serii na wykresie
const createRuleControl = rule => {
  const main = document.createElement('div')
  main.classList.add('rule-input') // kontener dla pojedyńczej reguły

  // Checkbox – czy seria ma być wyświetlana
  const enabledInput = document.createElement('input')
  enabledInput.setAttribute('type', 'checkbox')
  if (rule.enabled) {
    enabledInput.checked = true
  }

  // Pola tekstowe dla wartości reguły
  const prefixInput = document.createElement('input')
  prefixInput.value = rule.prefix

  const minInput = document.createElement('input')
  minInput.value = rule?.min ?? ''   // opcjonalne minimum wartości

  const maxInput = document.createElement('input')
  maxInput.value = rule?.max ?? ''   // opcjonalne maksimum wartości

  // Etykiety dla pól
  const enabledLabel = document.createElement('label')
  enabledLabel.innerText = 'Wyświetlaj'
  const prefixLabel = document.createElement('label')
  prefixLabel.innerText = 'Prefiks'
  const minLabel = document.createElement('label')
  minLabel.innerText = 'Min'
  const maxLabel = document.createElement('label')
  maxLabel.innerText = 'Max'

  // Kontenery grupujące etykietę z inputem (dla lepszego wyglądu)
  const prefixDiv = document.createElement('div')
  prefixDiv.appendChild(prefixLabel)
  prefixDiv.appendChild(prefixInput)

  const enabledDiv = document.createElement('div')
  enabledDiv.appendChild(enabledLabel)
  enabledDiv.appendChild(enabledInput)

  const minDiv = document.createElement('div')
  minDiv.appendChild(minLabel)
  minDiv.appendChild(minInput)

  const maxDiv = document.createElement('div')
  maxDiv.appendChild(maxLabel)
  maxDiv.appendChild(maxInput)

  // Funkcja wywoływana przy każdej zmianie w kontrolkach – aktualizuje obiekt reguły i przerysowuje wykres
  const onChange = () => {
    rule.prefix = prefixInput.value
    rule.min = minInput.value
    rule.max = maxInput.value
    rule.enabled = enabledInput.checked
    graph.render() // przerysowanie wykresu z nowymi regułami
  }

  // Nasłuchiwanie zmian we wszystkich polach
  prefixInput.addEventListener('change', onChange)
  enabledInput.addEventListener('change', onChange)
  minInput.addEventListener('change', onChange)
  maxInput.addEventListener('change', onChange)

  // Dodanie wszystkich kontenerów do głównego diva reguły
  main.appendChild(prefixDiv)
  main.appendChild(enabledDiv)
  main.appendChild(minDiv)
  main.appendChild(maxDiv)

  return main
}

// Główny handler reagujący na zmiany stanu aplikacji przesyłane przez pywebview
const onStateChange = e => {
  const { key } = e.detail

  pywebview.api.log(`state change ${key}`) // log do konsoli Pythona

  switch (key) {
    // Aktualizacja listy dostępnych stacji
    case 'stations': {
      const stlist = document.getElementById('station-list')

      // Wyczyść poprzednią zawartość
      stlist.childNodes.forEach(c => c.remove())

      // Wygeneruj przyciski dla każdej stacji
      for (const station of pywebview.state.stations) {
        const btn = document.createElement('button')

        btn.innerText = station
        btn.setAttribute('data-station', station)
        btn.addEventListener('click', e => {
          pywebview.api.set_station(station) // ustaw wybraną stację w backendzie
        })

        stlist.appendChild(btn)
      }

      // Automatycznie wybierz pierwszą stację po załadowaniu listy
      pywebview.api.set_station(pywebview.state.stations[0])

      document.getElementById('graph-message').innerText =
        'Wybierz stację z menu po lewej stronie'
      break
    }

    // Wypełnienie selecta z dostępnymi prefiksami
    case 'prefixes': {
      const prefixSelect = document.getElementById('prefix-select')
      prefixSelect.childNodes.forEach(c => c.remove())

      for (const prefix of pywebview.state.prefixes) {
        const opt = document.createElement('option')
        opt.innerText = prefix
        opt.value = prefix
        prefixSelect.appendChild(opt)
      }
      break // brak break w oryginale – celowe łączenie z kolejnym case?
    }

    // Zmiana aktualnie wybranej stacji
    case 'station': {
      // Podświetlenie aktywnego przycisku stacji
      document.querySelectorAll('#station-list > button').forEach(el => {
        const stationName = el.getAttribute('data-station')
        if (stationName === pywebview.state.station) {
          el.classList.add('active')
        } else {
          el.classList.remove('active')
        }
      })

      // Wyświetl nazwę stacji w obszarze komunikatu
      document.getElementById('graph-message').innerText = pywebview.state.station

      // Ustaw wybrany prefiks w backendzie (zazwyczaj po zmianie stacji)
      pywebview.api.set_prefix(document.getElementById('prefix-select').value)

      break
    }

    // Lista nazw kolumn (prawdopodobnie serii danych)
    case 'colnames': {
      const colList = document.getElementById('colnames')
      colList.innerHTML = ''

      for (const colname of pywebview.state.colnames) {
        const opt = document.createElement('option')
        opt.innerText = colname
        opt.value = colname
        colList.appendChild(opt)
      }
      break
    }

    // Najnowszy znacznik czasu danych – używany do informacji o aktualności
    case 'latest_ts': {
      document.getElementById('graph-message').innerText = `${
        pywebview.state.station
      } ${new Date(pywebview.state.latest_ts * 1000).toUTCString()}`

      // Automatyczne przełączenie na widok 24h przy pierwszym załadowaniu danych
      if (!graph.tspan) {
        document.getElementById('graph-24h').click()
      }
      break
    }

    // Przyjście nowych danych do wykresu
    case 'data': {
      const data = pywebview.state.data
      graph.setData(data)
      graph.render()

      // Ustawienie pól daty/czasu na granice danych
      document.getElementById('graph-tmin').value = new Date(
        data.bounds.tmin * 1000,
      )
        .toISOString()
        .substring(0, 19)

      document.getElementById('graph-tmax').value = new Date(
        data.bounds.tmax * 1000,
      )
        .toISOString()
        .substring(0, 19)

      // Legenda – etykiety serii z kolorami
      const labels = document.getElementById('graph-labels')
      labels.innerHTML = ''

      const desc = data.desc
      desc.forEach((colname, i) => {
        const label = document.createElement('div')
        label.classList.add('graph-label')
        label.style.color = graph.color(i / desc.length)
        label.innerText = colname
        labels.appendChild(label)
      })

      break
    }

    // Aktualizacja reguł filtrowania/wyświetlania
    case 'rules': {
      rules = []

      // Przekształcenie obiektu reguł na tablicę z dodanym prefiksem i domyślnie włączonymi
      for (const [prefix, r] of Object.entries(pywebview.state.rules)) {
        rules.push({ ...r, prefix, enabled: true })
      }

      const rulesDiv = document.getElementById('graph-rules')
      rulesDiv.innerHTML = ''

      // Wygenerowanie kontrolek dla każdej reguły
      for (const rule of rules) {
        rulesDiv.appendChild(createRuleControl(rule))
      }

      break
    }

    // Pasek postępu (np. podczas ładowania danych)
    case 'progress': {
      const progressDiv = document.querySelector('#graph-progress > div')
      progressDiv.style.opacity = 1
      progressDiv.style.width = `${pywebview.state.progress * 100}%`
      break
    }

    // Historia nawigacji (poprzednie/następne zakresy czasu)
    case 'history': {
      const { prev, next } = pywebview.state.history
      console.log({ prev, next })

      // Włącz/wyłącz przyciski przewijania w historii
      if (prev > 0) {
        document.getElementById('graph-prev').removeAttribute('disabled')
      } else {
        document.getElementById('graph-prev').setAttribute('disabled', true)
      }

      if (next > 0) {
        document.getElementById('graph-next').removeAttribute('disabled')
      } else {
        document.getElementById('graph-next').setAttribute('disabled', true)
      }

      break
    }

    // Domyślny przypadek – nieobsłużone klucze
    default: {
      console.log('msg', e.detail)
      break
    }
  }
}