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
    # Argumenty aplikacji i konfiguracja (zostawiam dla lepszej czytelności)
    self.args = args
    self.cfg = cfg
    
    # Backend API udostępniane do frontendu przez webview (zostawiam dla lepszej czytelności)
    self.api = AppAPI(self)

    # Struktury do obsługi historii zapytań (undo/redo)
    self.history: deque[DataRequest] = deque()
    self.current: DataRequest = None
    self.future: deque[DataRequest] = deque()
    
    # Usunięto: self.config_path: Path = None (nieobecne w Kodzie 2)
    
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
    # Usunięto: self.initialize() z metody run() (jak w Kodzie 2)
    
    # Uruchomienie pętli webview + zbindowanie zdarzeń
    webview.start(self.bind, self.window, debug=self.args.debug)

  def initialize(self):
    logger.debug('Looking for stations')

    # Logika sprawdzania i wyboru ścieżki danych (obecna w obu kodach, z priorytetem na Kod 2)
    if not self.cfg.data_path.exists():
      logger.warning('Data path does not exist')

      confirmed = self.window.create_confirmation_dialog(
        'Brak danych',
        'Podana ścieżka nie istnieje, kliknij OK, aby wybrać folder zawierający dane',
      )
      if not confirmed:
        self.window.destroy()
        return
      path, *_ = self.window.create_file_dialog(
        dialog_type=webview.FileDialog.FOLDER, allow_multiple=False
      )
      self.cfg.data_path = Path(path)
      self.cfg.save()

    # Przeszukiwanie katalogu danych i tworzenie obiektów stacji
    for stdir in self.cfg.data_path.iterdir():
      if stdir.name.startswith('.') or not stdir.is_dir():
        continue

      station = Station(self, stdir)
      logger.debug(f'Adding station: {station.name}')
      self.stations[station.name] = station
      
    # Przywrócono: Ustawianie stanu okna w initialize() (jak w Kodzie 2)
    self.window.state.prefixes = self.cfg.prefixes
    self.window.state.stations = list(self.stations.keys())
    self.window.state.rules = self.cfg.rules

  def bind(self, window: webview.Window):
    # Podpięcie handlerów zdarzeń okna
    window.events.loaded += self.on_window_loaded
    window.events.closed += self.on_window_closed
    # Usunięto: window.dom.document.events.keydown += self.on_keydown (nieobecne w Kodzie 2)
    
    self.initialize() # Wywołanie initialize() w bind() (jak w Kodzie 2)

  # Usunięto: def on_keydown(self, ev): (nieobecne w Kodzie 2)
    
  def on_window_closed(self, window):
    logger.debug('Closing window') # Logowanie zamknięcia okna (jak w Kodzie 2)

  def on_window_loaded(self, window):
    logger.debug('Window has been loaded')
    # Ustawienie stanu okna w on_window_loaded (jak w Kodzie 2)
    self.window.state.prefixes = self.cfg.prefixes
    self.window.state.stations = list(self.stations.keys())
    self.window.state.rules = self.cfg.rules