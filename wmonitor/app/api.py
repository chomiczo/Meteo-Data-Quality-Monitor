from logging import getLogger
from typing import TYPE_CHECKING

import json   # <-- ta linijka brakuje!

from wmonitor.app.util import DataRequest

if TYPE_CHECKING:
  from wmonitor.app.app import App

logger = getLogger()


class AppAPI:
  def __init__(self, app: 'App'):
    # Referencja do głównej instancji aplikacji (stacje, historia, okno webview)
    self._app = app

  def log(self, *args):
    # Logowanie wiadomości pochodzących z frontendu
    logger.debug('webview: ' + ' '.join([str(arg) for arg in args]))

  def set_station(self, station: str):
    logger.debug(f'Setting station to {station}')
    # Aktualizacja aktualnie wybranej stacji
    self._app.window.state.station = station

  def set_prefix(self, prefix: str):
    logger.debug(f'Setting prefix to {prefix}')
    # Ustawienie aktualnego prefiksu kolumn
    self._app.window.state.prefix = prefix

    # Pobranie metadanych kolumn dla wybranego prefiksu i stacji
    st = self._app.stations.get(self._app.window.state.get('station'))
    if st:
      latest_ts, colnames = st.colnames(prefix)
      self._app.window.state.colnames = colnames
      self._app.window.state.latest_ts = latest_ts

  def get_data(self, col_prefix: str, tmin: float, tmax: float):
    # Odrzucenie zapytań, w których zakres dat jest zerowy
    if tmin == tmax:
      logger.info(f'Not loading new data because tmin == tmax: {tmin}')
      return

    # Walidacja zakresu czasu
    if tmin > tmax:
      self._app.window.create_confirmation_dialog(
        'Niepoprawny zakres', 'Podany zakres dat jest niepoprawny'
      )
      return

    st_name = self._app.window.state.get('station')
    prefix = self._app.window.state.prefix

    logger.debug(
      f'Loading data {st_name}/{prefix} col_prefix={col_prefix} t_min={tmin} t_max={tmax}'
    )

    # Tworzenie obiektu zapytania do historii
    req = DataRequest(st_name, prefix, col_prefix, tmin, tmax)

    # Pobranie danych + dodanie zapytania do historii
    self._get_data(req, add_to_history=True, clear_future=True)

  def _on_progress(self, p):
    # Aktualizacja paska postępu ładowania danych
    self._app.window.state.progress = p

  def _get_data(
    self, req: DataRequest, add_to_history=False, clear_future=False
  ):
    # Pobranie obiektu stacji
    st = self._app.stations.get(req.station)
    if st:
      # Pobranie danych z plików stacji
      data = st.get_data(
        req.prefix,
        req.col_prefix.lower(),
        req.tmin,
        req.tmax,
        self._on_progress,
      )
      data['req'] = req  # zapisanie metadanych zapytania w wynikach

      # Jeśli nie znaleziono danych w podanym zakresie
      if len(data['rows']) == 0:
        self._app.window.create_confirmation_dialog(
          'Brak danych', 'Nie znaleziono danych dla podanego zakresu'
        )
        logger.info(f'No data found for requested constraints: {req}')
        return

      # Przekazanie danych do frontendu
      self._app.window.state.data = data

      # Aktualizacja historii (undo)
      if add_to_history and self._app.current is not None:
        self._app.history.append(self._app.current)

      # Wyczyszczenie "przyszłości" po nowym zapytaniu (redo)
      if clear_future:
        self._app.future.clear()

      # Ustawienie aktualnego zapytania
      self._app.current = req

      # Zaktualizowanie liczników w interfejsie
      self._app.window.state.history = {
        'prev': len(self._app.history),
        'next': len(self._app.future),
      }

  def history_back(self):
    logger.debug('History: back')

    try:
      # Pobranie ostatniego zapytania z historii (undo)
      last = self._app.history.pop()

      # Aktualne zapytanie trafia do „przyszłości” (redo)
      if self._app.current is not None:
        self._app.future.append(self._app.current)

      # Odtworzenie poprzedniego zapytania
      self._get_data(last)

    except IndexError:
      # Brak historii → nic nie robimy
      return

  def history_next(self):
    logger.debug('History: next')

    try:
      # Pobranie zapytania z kolejki "przyszłości" (redo)
      next_ = self._app.future.pop()

      # Pobranie danych i dodanie aktualnego zapytania do historii
      self._get_data(next_, add_to_history=True)

    except IndexError:
      # Brak pozycji do przodu → nic nie robimy
      return
    
  def add_rule(self, prefix: str, min_val: str = "", max_val: str = ""):
      """Dodaje nową regułę i zapisuje konfigurację"""
      logger.info(f"Dodawanie nowej reguły: {prefix}")

      # Dodajemy do aktualnej konfiguracji
      if prefix not in self._app.cfg.rules:
          self._app.cfg.rules[prefix] = {}

      if min_val:
          self._app.cfg.rules[prefix]["min"] = float(min_val)
      if max_val:
          self._app.cfg.rules[prefix]["max"] = float(max_val)

      # Zapisujemy do pliku
      self._save_config()

      # Odświeżamy frontend
      self._app.window.state.rules = self._app.cfg.rules

  def save_rules(self, rules_dict: dict):
      """Zapisuje cały słownik reguł (używane przy edycji istniejących)"""
      logger.info("Zapisywanie reguł z frontendu")
      new_rules = {}
      for prefix, vals in rules_dict.items():
          if not prefix.strip():
              continue
          rule = {}
          if 'min' in vals and vals['min'] not in [None, ""]:
              rule['min'] = float(vals['min'])
          if 'max' in vals and vals['max'] not in [None, ""]:
              rule['max'] = float(vals['max'])
          if rule:  # tylko jeśli coś jest ustawione
              new_rules[prefix] = rule

      self._app.cfg.rules = new_rules
      self._save_config()
      self._app.window.state.rules = self._app.cfg.rules

  def _save_config(self):
      """Zapisuje całą konfigurację do pliku wmonitor.json"""
      try:
          config_path = self._app.config_path
          data = {
              "data_path": str(self._app.cfg.data_path),
              "prefixes": self._app.cfg.prefixes,
              "column_include": self._app.cfg.column_include,
              "rules": self._app.cfg.rules
          }
          with open(config_path, 'w', encoding='utf-8') as f:
              json.dump(data, f, indent=2, ensure_ascii=False)
          logger.info(f"Konfiguracja zapisana do {config_path}")
      except Exception as e:
          logger.error(f"Błąd podczas zapisu konfiguracji: {e}")
          self._app.window.create_confirmation_dialog(
              "Błąd zapisu", f"Nie udało się zapisać konfiguracji:\n{e}"
          )    
