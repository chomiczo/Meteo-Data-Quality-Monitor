"""
app/app.py

Główna klasa aplikacji METEO-DATA-QUALITY-MONITOR.
Zarządza całym cyklem życia programu:
- tworzy okno desktopowe (pywebview)
- skanuje dysk w poszukiwaniu stacji meteorologicznych
- łączy backend Pythona z frontendem HTML/JS
- udostępnia stan aplikacji do JavaScriptu
"""

import logging                                  # moduł do logowania komunikatów aplikacji
from pathlib import Path                        # nowoczesna obsługa ścieżek w systemie plików
import webview                                  # biblioteka tworząca aplikację desktopową z HTML/JS

# Importujemy własne moduły z pakietu wmonitor.app
from wmonitor.app.api import AppAPI             # klasa API dostępna z poziomu JavaScriptu
from wmonitor.app.config import AppConfig       # konfiguracja aplikacji (ścieżki, prefiksy, reguły)
from wmonitor.app.station import Station        # klasa reprezentująca jedną stację pomiarową

# Ścieżka do katalogu z plikami frontendowymi (index.html, main.js, style.css itp.)
asset_path = Path(__file__).parent.parent / 'assets'

# Tworzymy globalny logger – używany w całej aplikacji
# (lepiej byłoby użyć __name__, ale działa i tak)
logger = logging.getLogger()


class App:
    """Główna klasa aplikacji – instancja tworzona przy uruchomieniu programu"""

    def __init__(self, args, cfg: AppConfig):
        """
        Konstruktor – uruchamiany przy starcie aplikacji
        
        args – obiekt z argumentami wiersza poleceń (np. --debug)
        cfg  – skonfigurowany obiekt AppConfig z ustawieniami
        """
        self.args = args                            # zapisujemy argumenty uruchomienia
        self.cfg = cfg                              # zapisujemy konfigurację (ścieżka do danych, prefiksy itp.)
        self.api = AppAPI(self)                     # tworzymy obiekt API, który będzie dostępny w JS

        # Słownik wszystkich załadowanych stacji: { "STACJA1": <obiekt Station>, ... }
        self.stations: dict[str, Station] = {}

        # Tworzymy główne okno aplikacji pywebview
        self.window = webview.create_window(
            'wmonitor',                             # tytuł paska okna
            str(asset_path / 'index.html'),         # plik startowy – nasz frontend
            width=1366,                             # początkowa szerokość okna
            height=768,                             # początkowa wysokość okna
            min_size=(800, 600),                    # minimalny dopuszczalny rozmiar
            js_api=self.api,                        # WAŻNE: wystawiamy Python API do JavaScriptu!
        )

    def run(self):
        """Uruchamia aplikację – główna pętla zdarzeń"""
        self.initialize()                           # najpierw szukamy i ładujemy stacje
        # Uruchamiamy pywebview z podpiętą metodą bind() i trybem debug (jeśli włączony)
        webview.start(self.bind, self.window, debug=self.args.debug)

    def initialize(self):
        """Skanuje dysk i ładuje wszystkie dostępne stacje meteorologiczne"""
        logger.debug('Looking for stations')        # informacja diagnostyczna

        # Przechodzimy po wszystkich elementach w katalogu z danymi (z config)
        for stdir in self.cfg.data_path.iterdir():
            # Pomijamy ukryte foldery (np. .git, .cache) i pliki
            if stdir.name.startswith('.') or not stdir.is_dir():
                continue

            # Tworzymy obiekt stacji na podstawie folderu z danymi
            station = Station(self, stdir)
            logger.debug(f'Adding station: {station.name}')  # logujemy dodanie
            self.stations[station.name] = station   # dodajemy do słownika stacji

    def bind(self, window: webview.Window):
        """
        Podpinamy obsługę zdarzeń okna po jego utworzeniu
        Wywoływane automatycznie przez pywebview przy starcie
        """
        window.events.loaded += self.on_window_loaded    # po załadowaniu HTML
        window.events.closed += self.on_window_closed    # przy zamykaniu aplikacji
        window.dom.document.events.keydown += self.on_keydown  # globalne skróty klawiszowe

    def on_keydown(self, ev):
        """
        Obsługa naciśnięć klawiszy w oknie (np. F5, Ctrl+R, Esc)
        Na razie tylko wypisuje zdarzenie – można tu dodać skróty
        """
        print(ev)                                   # debug: widzimy co się naciska

    def on_window_closed(self, window):
        """
        Wywoływane przy zamykaniu okna
        Tu można dodać zapis stanu, czyszczenie zasobów itp.
        """
        pass                                        # na razie nic nie robimy

    def on_window_loaded(self, window):
        """
        Wywoływane, gdy strona HTML/JS jest w pełni załadowana
        Tutaj przekazujemy początkowe dane do frontendu
        """
        logger.debug('Window has been loaded')      # informacja, że frontend gotowy

        # Przekazujemy konfigurację i dane startowe do JavaScriptu
        # (pywebview automatycznie serializuje do JSON)
        self.window.state.prefixes = self.cfg.prefixes   # lista dostępnych prefiksów (raw_, qc_, itd.)
        self.window.state.stations = list(self.stations.keys())  # lista nazw stacji do selecta
        self.window.state.rules = self.cfg.rules         # reguły kontroli jakości (do podświetlenia)