from datetime import datetime
import re
from typing import NamedTuple

# Regex dopasowujący nazwy plików CSV:
#   <prefix>_<YYYYMMDDTHHMMSS>.csv
FNAME_RX = re.compile(
  r'(?P<prefix>\w+)_(?P<date>\d{8}T\d{6})',
  flags=re.I,
)

# Regex dopuszczający nazwy kolumn typu:
#   temp_1m, wind_dir_10m, qc_flag etc.


# COLNAME_RX = re.compile(r'(\w+)_(\d+)_(\d+)_(\d+)?', flags=re.I) <-- Pana Profesora regex


COLNAME_RX = re.compile(r'(\w+)_([\d\w]+_?)+', flags=re.I)


# Format timestampów w danych (np. "2023/04/17 12:30:00.000")
TS_FMT = '%Y/%m/%d %H:%M:%S.%f'


def parse_ts(datestr: str):
  """Konwertuje timestamp w formacie tekstowym na float (sekundy epoki)."""
  return datetime.strptime(datestr, TS_FMT).timestamp()


class DataRequest(NamedTuple):
  """Pojedyncze żądanie danych: określa stację, prefiks i zakres czasowy."""
  station: str
  prefix: str
  col_prefix: str
  tmin: float
  tmax: float
