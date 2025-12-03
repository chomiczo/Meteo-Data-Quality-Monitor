import csv
from datetime import datetime
from logging import getLogger
import math
from pathlib import Path
from typing import TYPE_CHECKING, NamedTuple

from wmonitor.app.util import COLNAME_RX, FNAME_RX, parse_ts

if TYPE_CHECKING:
  from wmonitor.app.app import App

logger = getLogger()


class StationFile(NamedTuple):
  # Jedna linia zidentyfikowanego pliku CSV
  path: Path
  prefix: str
  timestamp: float


class Station:
  def __init__(self, app: 'App', path: Path):
    self.app = app          # Referencja do aplikacji (do configu itp.)
    self.path = path        # Folder stacji

  @property
  def name(self):
    # Nazwa stacji = nazwa katalogu
    return self.path.name

  def is_colname_valid(self, col: str):
    # Kolumna jest poprawna, jeśli pasuje do regexu albo jest na whiteliście
    return COLNAME_RX.match(col) or any(
      col.lower().startswith(cpref.lower())
      for cpref in self.app.cfg.column_include
    )

  def csv_paths(self):
    """
    Generator zwracający wszystkie pliki CSV w katalogu stacji,
    rozpoznane przez regex FNAME_RX.
    """
    for path in self.path.iterdir():
      if path.suffix.lower() == '.csv' and (m := FNAME_RX.match(path.name)):
        groups = m.groupdict()
        prefix = groups.get('prefix')
        date_str = groups.get('date')

        # Format daty w nazwie pliku: YYYYmmddTHHMMSS
        dt = datetime.strptime(date_str, '%Y%m%dT%H%M%S')

        yield StationFile(path, prefix, dt.timestamp())

  def colnames(self, prefix: str):
    """
    Zwraca:
      - najnowszy timestamp w danym prefiksie
      - listę poprawnych nazw kolumn
    """
    # Najnowszy plik dla wybranego prefiksu
    latest = min(
      (p for p in self.csv_paths() if p.prefix.startswith(prefix)),
      key=lambda f: -f.timestamp,
    )

    # Odczyt nagłówka CSV
    with latest.path.open('r') as fp:
      reader = csv.reader(fp)
      cols = [col.replace('\ufeff', '').strip() for col in next(reader)]

      # Lokalizacja kolumny timestamp
      lcols = [col.lower() for col in cols]
      ts_col = lcols.index('timestamp')

      # Najnowszy timestamp w całym pliku
      newest_ts = max([parse_ts(row[ts_col]) for row in reader])

      # Zwrot listy tylko poprawnych kolumn
      return newest_ts, [col for col in cols if self.is_colname_valid(col)]

  def get_data(
    self, prefix: str, col_prefix: str, tmin: float, tmax: float, on_progress
  ):
    """
    Wczytuje dane:
      - z wielu plików CSV pasujących do prefiksu
      - tylko rekordy z przedziału tmin–tmax
      - tylko kolumny zaczynające się od col_prefix
    Oblicza jednocześnie zakresy (min/max) czasu i wartości.
    """
    # Wszystkie pliki CSV pasujące do prefiksu, posortowane rosnąco
    paths = sorted(
      [p for p in self.csv_paths() if p.prefix.startswith(prefix)],
      key=lambda p: p.timestamp,
    )

    rows = []
    bounds = {
      'tmin': math.inf,
      'tmax': -math.inf,
      'ymin': math.inf,
      'ymax': -math.inf,
    }
    colmap = {}  # Mapowanie nazwy kolumny → index w CSV

    for i, p in enumerate(paths):
      # Uwzględnienie dobowej tolerancji +86400 s na koniec zakresu
      if p.timestamp >= tmin and p.timestamp <= tmax + 86400:
        on_progress(i / len(paths))  # Callback postępu
        logger.debug(f'Reading {p.path.name}')

        with p.path.open('r') as fp:
          reader = csv.reader(fp)
          cols = [col.replace('\ufeff', '').strip() for col in next(reader)]
          lcols = [col.lower() for col in cols]

          # Zbudowanie mapy kolumn o podanym prefiksie,
          # pomijamy timestamp i niepoprawne kolumny
          colmap = {
            col: i
            for i, col in enumerate(lcols)
            if col.lower().startswith(col_prefix.lower())
            and col.lower() != 'timestamp'
            and self.is_colname_valid(col)
          }

          ts_col = lcols.index('timestamp')

          last_ts = 0  # Zapobieganie cofaniu się czasu w danych
          for row in reader:
            ts = parse_ts(row[ts_col])

            if ts < last_ts:
              continue  # ignorujemy "cofnięte" rekordy
            last_ts = ts

            # Rekord w zakresie
            if tmin <= ts <= tmax:
              # Aktualizacja granic czasowych
              if ts < bounds['tmin']:
                bounds['tmin'] = ts
              if ts > bounds['tmax']:
                bounds['tmax'] = ts

              values = []
              for col, i in colmap.items():
                value = None
                try:
                  value = float(row[i])

                  # Zamiana wartości specjalnych (9999/-9999) na None
                  if int(value) in (9999, -9999):
                    value = None
                except Exception as e:
                  logger.warning(f'{e}: {p.path.name} {col}')
                finally:
                  values.append(value)

              # Jeśli wszystkie wartości to None — pomijamy
              good_values = [v for v in values if v is not None]
              if not good_values:
                continue

              # Aktualizacja zakresów wartości
              ymin = min(good_values)
              ymax = max(good_values)
              if ymin < bounds['ymin']:
                bounds['ymin'] = ymin
              if ymax > bounds['ymax']:
                bounds['ymax'] = ymax

              # Wiersz danych: [timestamp, val1, val2...]
              r = [ts, *values]
              rows.append(r)

    # Zwrot końcowych danych
    return {
      'rows': rows,              # Wszystkie rekordy
      'bounds': bounds,          # Zakresy czasowe i wartości
      'desc': [col for col, i in colmap.items()],  # Opisy kolumn
    }
