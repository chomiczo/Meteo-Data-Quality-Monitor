"""
app/util.py

Zbiór funkcji i stałych pomocniczych używanych w całej aplikacji METEO-DATA-QUALITY-MONITOR.

Zawiera:
- wyrażenia regularne do parsowania nazw plików i kolumn
- format czasu używanego w plikach CSV
- funkcję konwertującą string czasu na Unix timestamp
"""

from datetime import datetime                   # potrzebny do parsowania daty/czasu
import re                                       # moduł do wyrażeń regularnych


# =============================================================================
# WYRAŻENIA REGULARNE DO PARSOWANIA NAZW PLIKÓW I KOLUMN
# =============================================================================

FNAME_RX = re.compile(
    r'(?P<prefix>\w+)_(?P<date>\d{8}T\d{6})',
    flags=re.IGNORECASE,  # dzięki re.I nie rozróżniamy wielkości liter
)
"""
Wyrażenie regularne dopasowujące nazwy plików CSV stacji.

Oczekiwany format nazwy pliku:
    raw_20231001T000000.csv
    qc_20231115T120000.csv
    final_20240401T000000.csv

Grupy nazwane:
    prefix – prefiks danych (np. raw, qc, final, pom1m)
    date   – data i czas w formacie YYYYMMDDTHHMMSS

Przykład użycia:
    m = FNAME_RX.match("raw_20231001T000000.csv")
    → m.groupdict() → {'prefix': 'raw', 'date': '20231001T000000'}
"""

COLNAME_RX = re.compile(r'(\w+)_([\d\w]+_?)+', flags=re.IGNORECASE)
"""
Wyrażenie regularne do rozpoznawania "prawidłowych" nazw kolumn pomiarowych.

Akceptuje kolumny w stylu:
    t_air
    rh_0001
    p_1013_1
    wind_speed_10m

Czyli: co najmniej jedna litera/digit + podkreślnik + dalsza część z cyframi/literami/podkreśleniami.

Dzięki temu odróżniamy prawdziwe pomiary od kolumn typu:
    timestamp, station_id, flag_qc, comment itd.
"""

# =============================================================================
# FORMAT CZASU W PLIKACH CSV
# =============================================================================

TS_FMT = '%Y/%m/%d %H:%M:%S.%f'
"""
Format daty i czasu używany w kolumnie 'timestamp' w plikach CSV.

Przykład wartości w pliku:
    2023/10/01 00:00:00.000
    2024/04/15 12:30:45.123

Uwaga: milisekundy są zawsze 3-cyfrowe (zawsze .000, .123 itd.)
"""


# =============================================================================
# FUNKCJE POMOCNICZE
# =============================================================================

def parse_ts(datestr: str) -> float:
    """
    Konwertuje string z kolumny 'timestamp' na Unix timestamp (float).

    Parametry:
        datestr (str): wartość z kolumny timestamp, np. "2023/10/01 00:00:00.000"

    Zwraca:
        float: liczba sekund od 1970-01-01 00:00:00 UTC (z ułamkami sekund)

    Przykład:
        parse_ts("2023/10/01 00:00:00.000") → 1696118400.0
    """
    return datetime.strptime(datestr, TS_FMT).timestamp()