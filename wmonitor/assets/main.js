// Dodajemy drugi parametr 'onRemove', który będzie funkcją wywoływaną po usunięciu
const createRuleControl = (rule, onRemove) => {
  const container = document.createElement('div')
  container.className = 'rule-input'

  // Dodajemy style inline dla układu flex, aby przycisk zmieścił się w rzędzie
  container.style.display = 'flex'
  container.style.gap = '10px'
  container.style.alignItems = 'flex-end'
  container.style.marginBottom = '10px'

  container.innerHTML = `
    <div>
      <label>Prefiks</label>
      <input type="text" class="rule-prefix" value="${rule.prefix || ''}">
    </div>
    <div>
      <label>Wyświetlaj</label>
      <input type="checkbox" class="rule-enabled" ${rule.enabled !== false ? 'checked' : ''}>
    </div>
    <div>
      <label>Min</label>
      <input type="number" class="rule-min" step="any" value="${rule.min ?? ''}">
    </div>
    <div>
      <label>Max</label>
      <input type="number" class="rule-max" step="any" value="${rule.max ?? ''}">
    </div>
    <div style="padding-bottom: 2px;">
      <button class="rule-remove-btn" style="
        background: transparent;
        border: 1px solid #cc241d;
        color: #cc241d;
        cursor: pointer;
        padding: 4px 8px;
        font-size: 12px;">Usuń</button>
    </div>
  `

  const prefixIn = container.querySelector('.rule-prefix')
  const enabledIn = container.querySelector('.rule-enabled')
  const minIn = container.querySelector('.rule-min')
  const maxIn = container.querySelector('.rule-max')
  const removeBtn = container.querySelector('.rule-remove-btn')

  const update = () => {
    rule.prefix = prefixIn.value.trim()
    rule.enabled = enabledIn.checked
    rule.min = minIn.value ? parseFloat(minIn.value) : undefined
    rule.max = maxIn.value ? parseFloat(maxIn.value) : undefined
    graph.render()
  }

  prefixIn.addEventListener('input', update)
  enabledIn.addEventListener('change', update)
  minIn.addEventListener('input', update)
  maxIn.addEventListener('input', update)

  // Obsługa kliknięcia przycisku usuwania
  removeBtn.addEventListener('click', () => {
    if (confirm(`Czy na pewno usunąć regułę dla "${rule.prefix}"?`)) {
      container.remove() // Usuń element z DOM
      if (onRemove) onRemove() // Wywołaj zapis do backendu
      graph.render() // Odśwież wykres
    }
  })

  return container
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
// Legenda – etykiety serii z kolorami + CHECKBOXY
const labels = document.getElementById('graph-labels')
labels.innerHTML = ''

const desc = data.desc
desc.forEach((colname, i) => {
  const label = document.createElement('div')
  label.classList.add('graph-label')
  label.style.display = 'flex'
  label.style.alignItems = 'center'
  label.style.gap = '8px'
  label.style.cursor = 'pointer'
  label.style.userSelect = 'none'
  
  // 🆕 Checkbox
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.checked = graph.columnVisibility[colname] !== false
  checkbox.style.cursor = 'pointer'
  
  // 🆕 Tekst z kolorem
  const span = document.createElement('span')
  span.style.color = graph.color(i / desc.length)
  span.innerText = colname
  
  // 🆕 Kliknięcie w checkbox LUB w tekst przełącza widoczność
  const toggle = () => {
    graph.columnVisibility[colname] = checkbox.checked
    graph.render()
  }
  
  checkbox.addEventListener('change', toggle)
  label.addEventListener('click', (e) => {
    if (e.target !== checkbox) {
      checkbox.checked = !checkbox.checked
      toggle()
    }
  })
  
  label.appendChild(checkbox)
  label.appendChild(span)
  labels.appendChild(label)
})
// --- OBSŁUGA PRZYCISKU ZAZNACZ/ODZNACZ WSZYSTKO ---
const clearBtn = document.getElementById('clear-legend-btn')

if (clearBtn) {
  clearBtn.onclick = () => {
    const allVisible = desc.every(col => graph.columnVisibility[col] !== false)
    const newState = !allVisible
    desc.forEach(col => {
      graph.columnVisibility[col] = newState
    })

    const allCheckboxes = labels.querySelectorAll('input[type="checkbox"]')
    allCheckboxes.forEach(cb => cb.checked = newState)
    graph.render()
  }
}

      break
    }

// Aktualizacja reguł filtrowania/wyświetlania
    case 'rules': {
      const rulesDiv = document.getElementById('graph-rules')
      rulesDiv.innerHTML = ''
      rules = [] // Zerujemy globalną tablicę

      // -- NOWOŚĆ: Funkcja pomocnicza do zapisu stanu (Skanuje DOM i wysyła do Pythona) --
      const saveRulesToBackend = async () => {
        const save = {}
        // Pobieramy wszystkie aktualnie istniejące w DOM reguły
        document.getElementById('graph-rules').querySelectorAll('.rule-input').forEach(el => {
          const p = el.querySelector('.rule-prefix').value.trim()
          if (!p) return
          
          const enabled = el.querySelector('.rule-enabled').checked
          const m = el.querySelector('.rule-min').value.trim()
          const mx = el.querySelector('.rule-max').value.trim()
          
          const obj = {}
          // Jeśli odznaczone, musimy to zapisać, lub jeśli są limity
          // (Zależnie od logiki backendu, tutaj zakładam standardowe mapowanie)
          if (!enabled) obj.enabled = false 
          if (m) obj.min = parseFloat(m)
          if (mx) obj.max = parseFloat(mx)
          
          // Zapisujemy tylko jeśli są jakieś ustawienia lub po prostu istnieje prefiks
          save[p] = obj
        })
        
        await pywebview.api.save_rules(save)
      }
      // --------------------------------------------------------------------------------

      // Wczytujemy reguły z backendu
      const backendRules = pywebview.state.rules || {}

      Object.entries(backendRules).forEach(([prefix, r]) => {
        const ruleObj = { prefix, enabled: true, ...r }
        rules.push(ruleObj)
        // Przekazujemy saveRulesToBackend jako callback 'onRemove'
        rulesDiv.appendChild(createRuleControl(ruleObj, saveRulesToBackend))
      })

      // Formularz dodawania
      const prefixIn = document.getElementById('new-rule-prefix')
      const minIn = document.getElementById('new-rule-min')
      const maxIn = document.getElementById('new-rule-max')
      const errorDiv = document.getElementById('new-rule-error')
      const addBtn = document.getElementById('add-rule-btn')

      // Czyścimy stare listenery
      const newBtn = addBtn.cloneNode(true)
      addBtn.parentNode.replaceChild(newBtn, addBtn)

      newBtn.addEventListener('click', async () => {
        const prefix = prefixIn.value.trim()
        const min = minIn.value.trim()
        const max = maxIn.value.trim()

        errorDiv.textContent = ''

        if (!prefix) {
          errorDiv.textContent = 'Prefiks jest wymagany!'
          return
        }

        // Dodajemy OD RAZU do UI
        const newRule = {
          prefix,
          min: min ? parseFloat(min) : undefined,
          max: max ? parseFloat(max) : undefined,
          enabled: true
        }
        
        // Tutaj również przekazujemy funkcję zapisu
        rulesDiv.appendChild(createRuleControl(newRule, saveRulesToBackend))

        // Czyścimy formularz
        prefixIn.value = minIn.value = maxIn.value = ''

        // Zapisujemy w tle
        try {
          await pywebview.api.add_rule(prefix, min || '', max || '')
        } catch (e) {
          errorDiv.textContent = 'Błąd zapisu'
          rulesDiv.removeChild(rulesDiv.lastChild)
        }
      })

      // Automatyczny zapis po edycji (debounce)
      let timeout
      rulesDiv.addEventListener('input', () => {
        clearTimeout(timeout)
        timeout = setTimeout(async () => {
           await saveRulesToBackend()
        }, 800)
      })

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