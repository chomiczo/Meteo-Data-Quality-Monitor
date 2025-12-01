"""
app/station.py

Klasa reprezentująca jedną stację meteorologiczną (jeden folder z plikami CSV).
Odpowiada za:
- skanowanie plików CSV w folderze stacji
- wyciąganie dostępnych kolumn dla danego prefiksu (np. raw_, qc_)
- wczytywanie danych pomiarowych w zadanym zakresie czasu
- filtrowanie kolumn i obsługę brakujących wartości (-9999, 9999)
"""

import csv                                      # wczytywanie plików CSV
from datetime import datetime                   # parsowanie daty z nazwy pliku
from logging import getLogger                   # logowanie błędów i informacji diagnostycznych
import math                                     # math.inf do inicjalizacji granic
from pathlib import Path                        # praca ze ścieżkami
from typing import TYPE_CHECKING, NamedTuple    # podpowiedzi typów + NamedTuple

# Nasze własne funkcje pomocnicze
from wmonitor.app.util import COLNAME_RX, FNAME_RX, parse_ts

# Unikamy cyklicznego importu – tylko do podpowiedzi typów w IDE
if TYPE_CHECKING:
    from wmonitor.app.app import App

# Logger – lepiej byłoby użyć __name__, ale działa globalnie
logger = getLogger()


class StationFile(NamedTuple):
    """
    Reprezentuje pojedynczy plik CSV należący do stacji
    """
    path: Path          # pełna ścieżka do pliku
    prefix: str         # prefiks pliku (np. 'raw_', 'qc_', 'final_')
    timestamp: float    # czas rozpoczęcia pomiarów w pliku (Unix timestamp)


class Station:
    """
    Główna klasa jednej stacji meteorologicznej.
    Tworzona dla każdego folderu w katalogu danych.
    """

    def __init__(self, app: 'App', path: Path):
        """
        Konstruktor
        
        app  – referencja do głównej aplikacji (dostęp do cfg, api itp.)
        path – ścieżka do folderu stacji (np. data/WARSZAWA_URSYNOW/)
        """
        self.app = app
        self.path = path

    @property
    def name(self) -> str:
        """Nazwa stacji = nazwa folderu (np. 'KRAKOW_BALICE')"""
        return self.path.name

    def is_colname_valid(self, col: str) -> bool:
        """
        Sprawdza, czy nazwa kolumny powinna być pokazana w interfejsie
        
        Akceptuje:
        - kolumny pasujące do wyrażenia regularnego COLNAME_RX (np. t_air, rh_0001)
        - kolumny z listy column_include z konfiguracji (np. timestamp, station_id)
        """
        return COLNAME_RX.match(col) or any(
            col.lower().startswith(cpref.lower())
            for cpref in self.app.cfg.column_include
        )

    def csv_paths(self):
        """
        Generator zwracający wszystkie ważne pliki CSV w folderze stacji
        
        Plik jest ważny jeśli:
        - ma rozszerzenie .csv
        - nazwa pasuje do wzorca FNAME_RX (np. raw_20231001T000000.csv)
        """
        for path in self.path.iterdir():
            if path.suffix.lower() == '.csv' and (m := FNAME_RX.match(path.name)):
                groups = m.groupdict()
                prefix = groups.get('prefix') or ''           # prefiks (np. raw_, qc_)
                date_str = groups.get('date')                 # np. 20231001T000000
                dt = datetime.strptime(date_str, '%Y%m%dT%H%M%S')  # zamiana na datetime
                yield StationFile(path, prefix, dt.timestamp())   # zwracamy jako NamedTuple

    def colnames(self, prefix: str):
        """
        Zwraca najnowszy timestamp i listę dostępnych kolumn dla danego prefiksu
        
        Szuka najnowszego pliku z pasującym prefiksem → czyta jego nagłówek
        """
        # Znajdujemy najnowszy plik z danym prefiksem (największy timestamp)
        latest = min(
            (p for p in self.csv_paths() if p.prefix.startswith(prefix)),
            key=lambda f: -f.timestamp,   # minus → najnowszy ma największy timestamp
            default=None
        )

        if not latest:
            return 0, []

        with latest.path.open('r', encoding='utf-8') as fp:
            reader = csv.reader(fp)
            # Czytamy pierwszą linię – nagłówki kolumn
            cols = [col.replace('\ufeff', '').strip() for col in next(reader)]  # usuwa BOM
            lcols = [col.lower() for col in cols]
            ts_col = lcols.index('timestamp')  # kolumna z czasem

            # Szukamy najnowszego rekordu w pliku
            newest_ts = max([parse_ts(row[ts_col]) for row in reader])
            # Zwracamy tylko "ważne" kolumny (zgodnie z regułami)
            return newest_ts, [col for col in cols if self.is_colname_valid(col)]

    def get_data(
        self, prefix: str, col_prefix: str, tmin: float, tmax: float, on_progress
    ):
        """
        Główna metoda wczytująca dane z plików CSV w zadanym zakresie czasu
        
        Parametry:
            prefix     – prefiks plików (np. 'raw_', 'qc_')
            col_prefix – filtr kolumn (np. 't_' → temperatura)
            tmin, tmax – zakres czasu (Unix timestamp)
            on_progress – callback do aktualizacji paska postępu
        
        Zwraca dict z danymi gotowymi do wysłania do JavaScriptu
        """
        # Pobieramy wszystkie pliki z danym prefiksem i sortujemy chronologicznie
        paths = sorted(
            [p for p in self.csv_paths() if p.prefix.startswith(prefix)],
            key=lambda p: p.timestamp,
        )

        rows = []                                           # zebrane wiersze danych
        bounds = {                                          # granice wykresu
            'tmin': math.inf, 'tmax': -math.inf,
            'ymin': math.inf, 'ymax': -math.inf,
        }

        for i, p in enumerate(paths):
            # Odczytujemy tylko pliki, które nakładają się na żądany zakres
            if p.timestamp >= tmin and p.timestamp <= tmax + 86400:  # +1 dzień marginesu
                on_progress(i / len(paths))             # aktualizacja paska postępu
                logger.debug(f'Reading {p.path.name}')

                with p.path.open('r', encoding='utf-8') as fp:
                    reader = csv.reader(fp)
                    cols = [col.replace('\ufeff', '').strip() for col in next(reader)]
                    lcols = [col.lower() for col in cols]

                    # Mapujemy tylko kolumny pasujące do filtra (np. t_air, t_soil)
                    colmap = {
                        col: i for i, col in enumerate(lcols)
                        if col.lower().startswith(col_prefix.lower())
                        and col.lower() != 'timestamp'
                        and self.is_colname_valid(col)
                    }

                    ts_col = lcols.index('timestamp')
                    last_ts = 0

                    for row in reader:
                        ts = parse_ts(row[ts_col])

                        # Pomijamy zdublowane lub cofnięte rekordy
                        if ts < last_ts:
                            continue
                        last_ts = ts

                        if tmin <= ts <= tmax:
                            # Aktualizacja granic czasu
                            bounds['tmin'] = min(bounds['tmin'], ts)
                            bounds['tmax'] = max(bounds['tmax'], ts)

                            values = []
                            for col, i in colmap.items():
                                value = None
                                try:
                                    value = float(row[i])
                                    # Standardowe wartości oznaczające brak danych
                                    if int(value) in (9999, -9999):
                                        value = None
                                except Exception as e:
                                    logger.warning(f'{e}: {p.path.name} {col}')
                                finally:
                                    values.append(value)

                            # Pomijamy wiersze bez żadnych wartości
                            good_values = [v for v in values if v is not None]
                            if not good_values:
                                continue

                            # Aktualizacja granic wartości Y
                            ymin = min(good_values)
                            ymax = max(good_values)
                            bounds['ymin'] = min(bounds['ymin'], ymin)
                            bounds['ymax'] = max(bounds['ymax'], ymax)

                            # Dodajemy wiersz: [timestamp, val1, val2, ...]
                            r = [ts, *values]
                            rows.append(r)

        return {
            'rows': rows,                    # dane do wykresu
            'bounds': bounds,                # granice osi
            'desc': [col for col, i in colmap.items()],  # nazwy kolumn (do legendy)
        }