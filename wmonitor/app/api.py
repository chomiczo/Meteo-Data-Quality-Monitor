"""
app/api.py – interfejs API dla pywebview (most JavaScript ↔ Python)
"""

from logging import getLogger                  # importujemy funkcję do tworzenia loggera
from typing import TYPE_CHECKING                # specjalny import tylko na czas sprawdzania typów (nie w runtime)

# Warunkowy import tylko dla edytora/analizatora typów (mypy, PyCharm itp.)
# Dzięki temu nie mamy cyklicznego importu App → AppAPI → App
if TYPE_CHECKING:
    from wmonitor.app.app import App            # importujemy klasę App tylko do podpowiedzi typów

# Tworzymy logger z nazwą modułu – dzięki temu w logach widać dokładnie, że wiadomość pochodzi z api.py
logger = getLogger(__name__)


class AppAPI:
    """
    Klasa wystawiana do JavaScriptu przez pywebview.
    W przeglądarce dostępna jako: window.pywebview.api
    """

    def __init__(self, app: 'App'):
        """
        Konstruktor – przyjmuje instancję głównej aplikacji (App)
        """
        self._app = app                         # zapisujemy referencję do głównej aplikacji

    def log(self, *args):
        """
        Metoda wywoływana z JS: api.log("coś", wartość, itd.)
        Służy do debugowania – wypisuje wszystko co przyjdzie z frontendu
        """
        logger.debug('webview: ' + ' '.join([str(arg) for arg in args]))

    def set_station(self, station: str):
        """
        Ustawia aktualnie wybraną stację meteorologiczną
        Wywoływane z JS po zmianie wyboru w selectie ze stacjami
        """
        logger.debug(f'Setting station to {station}')
        self._app.window.state.station = station   # aktualizujemy stan współdzielony z frontendem

    def set_prefix(self, prefix: str):
        """
        Ustawia prefiks kolumn (np. 'raw_', 'qc_', 'final_')
        Po zmianie prefiksu automatycznie ładuje dostępne nazwy kolumn i najnowszy timestamp
        """
        logger.debug(f'Setting prefix to {prefix}')
        self._app.window.state.prefix = prefix     # zapisujemy nowy prefiks w stanie

        # Pobieramy obiekt stacji na podstawie aktualnie wybranej nazwy stacji
        st = self._app.stations.get(self._app.window.state.get('station'))
        if st:                                      # jeśli stacja istnieje i jest załadowana
            latest_ts, colnames = st.colnames(prefix)  # pobieramy najnowszy timestamp i listę kolumn dla tego prefiksu
            self._app.window.state.colnames = colnames     # aktualizujemy dostępne kolumny w stanie (do wyboru w UI)
            self._app.window.state.latest_ts = latest_ts   # aktualizujemy najnowszy dostępny timestamp

    def get_data(self, col_prefix: str, tmin: float, tmax: float):
        """
        Główna metoda pobierająca dane pomiarowe z backendu
        Wywoływana z JavaScript po kliknięciu "Odśwież" lub zmianie zakresu dat

        Parametry:
            col_prefix – np. 't_', 'rh_', 'p_' (część wspólna nazwy kolumny)
            tmin, tmax – zakres czasu w formacie Unix timestamp (float)
        """
        station_name = self._app.window.state.get('station')   # aktualna stacja
        prefix = self._app.window.state.prefix                 # aktualny prefiks (raw_/qc_/final_)

        logger.debug(
            f'Loading data {station_name}/{prefix} col_prefix={col_prefix} t_min={tmin} t_max={tmax}'
        )

        def on_progress(p):
            """
            Callback wywoływany podczas ładowania danych (postęp w %)
            Aktualizuje pasek postępu widoczny w interfejsie użytkownika
            """
            self._app.window.state.progress = p

        # Pobieramy obiekt stacji z menedżera stacji
        st = self._app.stations.get(self._app.window.state.get('station'))
        if st:
            # Główna metoda pobierająca dane z dysku/bazy
            # Zwraca DataFrame (lub dict) z danymi w zadanym zakresie
            data = st.get_data(prefix, col_prefix.lower(), tmin, tmax, on_progress)
            
            # Zapisujemy pobrane dane do stanu – pywebview automatycznie wyśle je do JavaScript
            self._app.window.state.data = data