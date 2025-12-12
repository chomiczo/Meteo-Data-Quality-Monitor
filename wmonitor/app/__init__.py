from .app import App

"""
app/__init__.py

Ten plik sprawia, że katalog 'app' jest traktowany jako pakiet Pythona
i definiuje, co zostanie zaimportowane po wykonaniu:

    from app import App

Główne zadania tego pliku:
1. Ustawienie 'app' jako pakietu Pythona (nawet jeśli jest pusty, to już wystarczy).
2. Eksport głównej klasy aplikacji (App) – dzięki temu użytkownik może łatwo
   zaimportować i uruchomić całą aplikację jednym poleceniem.
3. Możliwość dodania inicjalizacji pakietu w przyszłości
   (np. konfiguracja loggera, ładowanie ustawień, rejestracja blueprintów itp.).

Użycie w projekcie:
    from app import App
    app = App()
    app.run()

Po dodaniu tych komentarzy plik będzie wyglądał tak:
"""