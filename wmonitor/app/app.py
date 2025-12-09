from collections import deque
import logging
from pathlib import Path
import webview

from wmonitor.app.api import AppAPI
from wmonitor.app.config import AppConfig
from wmonitor.app.station import Station
from wmonitor.app.util import DataRequest

asset_path = Path(__file__).parent.parent / 'assets'
logger = logging.getLogger()


class App:
  def __init__(self, args, cfg: AppConfig):
    # Argumenty aplikacji i konfiguracja
    self.args = args
    self.cfg = cfg

    # Backend API udostępniane do frontendu przez webview
    self.api = AppAPI(self)

    # Struktury do obsługi historii zapytań (undo/redo)
    self.history: deque[DataRequest] = deque()
    self.current: DataRequest = None
    self.future: deque[DataRequest] = deque()

    self.config_path: Path = None

    # Słownik dostępnych stacji (nazwa → obiekt Station)
    self.stations: dict[str, Station] = {}

    # Tworzenie okna aplikacji oraz ładowanie frontendu z index.html
    self.window = webview.create_window(
      'wmonitor',
      str(asset_path / 'index.html'),
      width=1366,
      height=768,
      min_size=(800, 600),
      js_api=self.api,  # API udostępnione po stronie JS
    )

  def run(self):
    # Inicjalizacja danych przed startem GUI
    self.initialize()

    # Uruchomienie pętli webview + zbindowanie zdarzeń
    webview.start(self.bind, self.window, debug=self.args.debug)

  def initialize(self):
    logger.debug('Looking for stations')

    # Przeszukiwanie katalogu danych i tworzenie obiektów stacji
    for stdir in self.cfg.data_path.iterdir():
      # Ignoruj ukryte pliki i obiekty, które nie są katalogami
      if stdir.name.startswith('.') or not stdir.is_dir():
        continue

      # Inicjalizacja stacji z katalogu
      station = Station(self, stdir)
      logger.debug(f'Adding station: {station.name}')
      self.stations[station.name] = station

  def bind(self, window: webview.Window):
    # Podpięcie handlerów zdarzeń okna
    window.events.loaded += self.on_window_loaded
    window.events.closed += self.on_window_closed
    window.dom.document.events.keydown += self.on_keydown

  def on_keydown(self, ev):
    # Tylko podgląd zdarzeń klawiatury — na razie nieobsługiwane
    print(ev)

  def on_window_closed(self, window):
    # Hook na zamknięcie okna — placeholder
    pass

  def on_window_loaded(self, window):
    logger.debug('Window has been loaded')

    # Przekazanie danych startowych do frontendu (Vue/Svelte/JS)
    self.window.state.prefixes = self.cfg.prefixes
    self.window.state.stations = list(self.stations.keys())
    self.window.state.rules = self.cfg.rules
