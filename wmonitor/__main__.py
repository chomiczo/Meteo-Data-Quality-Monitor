"""
wmonitor/__main__.py

Punkt wejścia do aplikacji uruchamiany poleceniem:
    python -m wmonitor [opcje]

Dzięki temu plikowi możesz uruchomić aplikację w sposób czysty, standardowy
i zalecany przez Pythona – bez konieczności wskazywania konkretnego pliku .py.

Ten plik jest automatycznie wykonywany przy `python -m wmonitor`.
"""

from argparse import ArgumentParser     # Parsowanie argumentów wiersza poleceń
import logging                          # Konfiguracja logowania
import sys                              # Dostęp do stdout i wyjścia z programu
from wmonitor.app import App            # Główna klasa aplikacji
from logging import getLogger, getLevelNamesMapping  # Logger i mapa poziomów logowania

from wmonitor.app.config import AppConfig  # Wczytywanie konfiguracji z JSON-a


# ===========================================================================
# Konfiguracja loggera – wszystkie logi idą na konsolę (stdout)
# ===========================================================================
logging.basicConfig(
    stream=sys.stdout,
    format='%(levelname)s %(filename)s:%(lineno)d -- %(message)s',
    # Przykład: INFO app.py:127 -- Ładowanie danych z pliku raw_20240401T000000.csv
)

# Dodajemy własny poziom logowania TRACE (5) – przydatny do bardzo szczegółowego debugowania
logging.addLevelName(5, 'TRACE')

# Pobieramy mapę wszystkich dostępnych poziomów logowania (INFO=20, DEBUG=10 itd.)
loglevels = getLevelNamesMapping()


# ===========================================================================
# Parsowanie argumentów wiersza poleceń
# ===========================================================================
parser = ArgumentParser(prog='wmonitor', description='METEO-DATA-QUALITY-MONITOR')

parser.add_argument(
    '-L', '--loglevel',
    choices=[x.lower() for x in loglevels.keys()],  # info, debug, warning, trace itd.
    default='info',
    help='Poziom logowania (domyślnie: info)'
)

parser.add_argument(
    '-c', '--config',
    default='wmonitor.json',
    help='Ścieżka do pliku konfiguracyjnego (domyślnie: wmonitor.json)'
)

parser.add_argument(
    '--debug',
    action='store_true',
    help='Włącza tryb debug w pywebview (okno devtools w przeglądarce)'
)

args = parser.parse_args()


# ===========================================================================
# Ustawienie poziomu logowania na podstawie argumentu
# ===========================================================================
logger = getLogger()  # Główny logger aplikacji
logger.setLevel(loglevels.get(args.loglevel.upper(), logging.INFO))
# Jeśli podano np. --loglevel trace → poziom 5
# Jeśli podano coś nieznanego → domyślnie INFO


# ===========================================================================
# Wczytanie konfiguracji z pliku JSON
# ===========================================================================
cfg = AppConfig.load(args.config)  # Szuka pliku podanego w --config lub domyślnie wmonitor.json


# ===========================================================================
# Uruchomienie głównej aplikacji
# ===========================================================================
app = App(args, cfg)   # Przekazujemy argumenty i konfigurację do głównej klasy
app.run()              # Start GUI przez pywebview + cała logika aplikacji


# Uwaga: nie potrzebujemy if __name__ == '__main__' – ten plik jest wykonywany tylko przez python -m