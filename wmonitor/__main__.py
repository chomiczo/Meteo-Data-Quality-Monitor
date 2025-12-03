from argparse import ArgumentParser
import logging
import sys
from wmonitor.app import App  # Główna klasa aplikacji

from logging import getLogger, getLevelNamesMapping

from wmonitor.app.config import AppConfig  # Klasa obsługująca konfigurację aplikacji

# Konfiguracja podstawowego loggera – wszystkie komunikaty idą na stdout
logging.basicConfig(
  stream=sys.stdout,
  format='%(levelname)s %(filename)s:%(lineno)d -- %(message)s',
)

# Dodanie własnego poziomu logowania TRACE (5) – przydatne do bardzo szczegółowego debugowania
logging.addLevelName(5, 'TRACE')
loglevels = getLevelNamesMapping()  # Mapa nazw poziomów → wartości numerycznych

# Parsowanie argumentów wiersza poleceń
parser = ArgumentParser('wmonitor')
parser.add_argument(
  '-L',
  '--loglevel',
  choices=[x.lower() for x in loglevels.keys()],  # Wszystkie dostępne poziomy (debug, info, …)
  default='info',
  help='Poziom logowania (domyślnie info)',
)
parser.add_argument('-c', '--config', default='wmonitor.json',
                    help='Ścieżka do pliku konfiguracyjnego (domyślnie wmonitor.json)')
parser.add_argument('--debug', action='store_true',
                    help='Włącza tryb debug – nadpisuje loglevel na DEBUG')

args = parser.parse_args()

# Ustawienie globalnego poziomu logowania
logger = getLogger()
logger.setLevel(loglevels.get(args.loglevel.upper(), 'INFO'))

# Jeśli podano flagę --debug, wymuszamy poziom DEBUG niezależnie od --loglevel
if args.debug:
    logger.setLevel(logging.DEBUG)

# Wczytanie konfiguracji z pliku JSON
cfg = AppConfig.load(args.config)

# Utworzenie instancji głównej aplikacji i uruchomienie jej
app = App(args, cfg)
app.run()