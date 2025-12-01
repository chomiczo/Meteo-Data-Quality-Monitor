"""
wmonitor/__init__.py

Ten plik jest celowo pusty – pełni rolę znacznika pakietu Pythona.

Dzięki jego istnieniu katalog `wmonitor` jest rozpoznawany jako pakiet,
co pozwala na:
    python -m wmonitor          # prawidłowe uruchomienie aplikacji
    import wmonitor             # import z dowolnego miejsca

Bez tego pliku Python (w niektórych środowiskach i wersjach) nie traktowałby
katalogu jako pakietu i nie można by było uruchomić aplikacji przez `python -m`.

Nie dodajemy tu żadnej logiki – cała inicjalizacja odbywa się w pliku
wmonitor/__main__.py lub bezpośrednio przy uruchomieniu app/app.py.

To standardowa, zalecana praktyka w nowoczesnych projektach Pythona.
"""

# Plik pozostaje pusty – nie ma tu kodu do wykonania