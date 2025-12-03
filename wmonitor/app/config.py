import json
from pathlib import Path


class AppConfig:
  # Typy pól (dla czytelności i wsparcia IDE)
  data_path: Path
  prefixes: list[str]
  rules: dict[str]
  column_include: list[str]

  @staticmethod
  def load(config_path='wmonitor.json'):
    """
    Wczytuje konfigurację aplikacji z pliku JSON
    i zwraca obiekt AppConfig z wypełnionymi polami.
    """
    with open(config_path, 'r') as f:
      data = json.load(f)

    cfg = AppConfig()

    # Ścieżka do katalogu z danymi — zamieniona na ścieżkę absolutną
    cfg.data_path = Path(data.get('data_path', 'data')).absolute()

    # Lista dostępnych prefiksów (np. raw_, qc_, pom1m itp.)
    cfg.prefixes = data.get('prefixes', ['pom1m'])

    # Reguły kontroli jakości (słownik używany w frontendzie)
    cfg.rules = data.get('rules', {})

    # Lista nazw kolumn, które mają być domyślnie wczytywane
    cfg.column_include = data.get('column_include', [])

    return cfg
