import json
from pathlib import Path


class AppConfig:
  data_path: Path
  prefixes: list[str]
  rules: dict[str]
  column_include: list[str]

  def __init__(self, config_path):
    # Prywatna zmienna do przechowywania ścieżki pliku konfiguracyjnego
    self.__config_path = Path(config_path)

    # Ładowanie konfiguracji z pliku
    with self.__config_path.open('r') as f:
      data = json.load(f)
      
      # Ścieżka do katalogu z danymi — zamieniona na ścieżkę absolutną
      self.data_path = Path(data.get('data_path', 'data')).absolute()
      
      # Lista dostępnych prefiksów
      self.prefixes = data.get('prefixes', ['pom1m'])
      
      # Reguły kontroli jakości (zmieniono domyślną wartość na {} z [] w Kodzie 1)
      self.rules = data.get('rules', {}) 
      
      # Lista nazw kolumn
      self.column_include = data.get('column_include', [])

  def save(self):
    """Zapisuje aktualny stan konfiguracji do pliku JSON."""
    with self.__config_path.open('w') as f:
      json.dump(
        {
          'data_path': str(self.data_path),
          'prefixes': self.prefixes,
          'rules': self.rules,
          'column_include': self.column_include,
        },
        f,
        indent=2,
      )

  @staticmethod
  def load(config_path='wmonitor.json'):
    """Statyczna metoda ładowania, która faktycznie inicjuje obiekt."""
    return AppConfig(config_path)