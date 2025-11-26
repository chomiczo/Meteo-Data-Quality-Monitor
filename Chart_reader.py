import pandas as pd
import os

from matplotlib.figure import Figure

csv_folder = ""

def set_csv_folder(path: str):
    global csv_folder
    csv_folder = path

def get_figure():
    global csv_folder

    file = os.path.join(csv_folder, "data.csv")

    df = pd.read_csv(file)

    fig = Figure()
    ax = fig.add_subplot()
    ax.plot(df["time"], df["value"])

    return fig