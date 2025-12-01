"""
app/config.py

Klasa odpowiedzialna za wczytywanie i przechowywanie konfiguracji aplikacji
METEO-DATA-QUALITY-MONITOR.

Konfiguracja jest przechowywana w pliku JSON (domyślnie: wmonitor.json w katalogu głównym projektu).
Pozwala na łatwe dostosowanie zachowania aplikacji bez zmiany kodu, np.:
- gdzie są dane stacji
- jakie prefiksy kolumn są dostępne (np. raw_, qc_, final_)
- reguły podświetlania wartości błędnych
- które kolumny zawsze pokazywać
"""

import json                                     # wczytywanie pliku konfiguracyjnego w formacie JSON
from pathlib import Path                        # wygodna i bezpieczna praca ze ścieżkami


class AppConfig:
    """
    Prosta klasa konfiguracyjna – nie używa __init__, tylko pola klasowe + metoda load()
    Dzięki temu możemy łatwo tworzyć instancje na podstawie pliku JSON
    """

    # Ścieżka do głównego katalogu z danymi wszystkich stacji
    data_path: Path

    # Lista dostępnych prefiksów kolumn (np. ['raw_', 'qc_', 'final_'])
    # Używane w interfejsie do przełączania między wersjami danych
    prefixes: list[str]

    # Słownik z regułami kontroli jakości (QC)
    # Klucz: nazwa kolumny lub prefiks, wartość: reguły (np. zakresy, kolory)
    rules: dict

    # Lista kolumn, które zawsze mają być widoczne (nawet jeśli nie pasują do filtra)
    column_include: list[str]

    @staticmethod
    def load(config_path='wmonitor.json'):
        """
        Statyczna metoda fabrykująca – wczytuje konfigurację z pliku JSON
        
        Parametry:
            config_path (str): ścieżka do pliku konfiguracyjnego
                              domyślnie: 'wmonitor.json' w katalogu uruchomienia
        
        Zwraca:
            AppConfig – skonfigurowany obiekt z ustawieniami
        
        Jeśli plik nie istnieje lub brakuje klucza – używane są bezpieczne wartości domyślne
        """
        # Otwieramy i wczytujemy plik JSON
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Tworzymy nową, pustą instancję konfiguracji
        cfg = AppConfig()

        # Ścieżka do danych – domyślnie folder 'data' w katalogu projektu
        # Używamy .absolute() żeby zawsze mieć pełną, jednoznaczną ścieżkę
        cfg.data_path = Path(data.get('data_path', 'data')).absolute()

        # Lista prefiksów – np. ['pom1m', 'pom10m'] lub ['raw_', 'qc_']
        cfg.prefixes = data.get('prefixes', ['pom1m'])

        # Reguły kontroli jakości – mogą być puste {}
        cfg.rules = data.get('rules', {})

        # Kolumny, które zawsze mają być widoczne (np. czas, stacja)
        cfg.column_include = data.get('column_include', [])

        return cfg