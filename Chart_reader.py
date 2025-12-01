import pandas as pd
import os
import glob

from matplotlib.figure import Figure

csv_folder = ""

def set_csv_folder(path: str):
    global csv_folder
    csv_folder = path

def get_figure(date_str):
    global csv_folder

    if not csv_folder:
        return None
    
    clean_date = date_str.replace("-", "")
    search_pattern = os.path.join(csv_folder, f"*{clean_date}*.csv")
    found_files = glob.glob(search_pattern)

    if not found_files:
        print(f"Nie znaleziono plików dla wzorca: {search_pattern}")
        return None
    
    file_path = found_files[0]

    if not os.path.exists(file_path):
        return None
    
    try:
        df = pd.read_csv(file_path)
        
        fig = Figure(figsize=(5, 4), dpi=100)
        ax = fig.add_subplot(111)

        if 'Timestamp' in df.columns and 'RH_1_1_1' in df.columns:
            df['Timestamp'] = pd.to_datetime(df['Timestamp'])
            ax.plot(df['Timestamp'], df['RH_1_1_1'], marker='o')
            ax.set_title(f"Dane z dnia {date_str}")
            ax.set_xlabel("Czas")
            ax.set_ylabel("Wartość")
            ax.grid(True)
        else:
            ax.plot(df.iloc[:,0], df.iloc[:,1])

        ax.set_title(f"Plik: {os.path.basename(file_path)}")
        ax.grid(True)
        fig.autofmt_xdate()

        return fig
    except Exception as e:
        print(f"Błąd podczas rysowania wykresu: {e}")
        return None