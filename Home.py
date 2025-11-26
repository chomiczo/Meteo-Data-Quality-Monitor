import sys
import Chart_reader

from PyQt6.QtWidgets import QApplication, QWidget, QLabel, QVBoxLayout, QHBoxLayout, QPushButton
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from Path_window import PathWindow

# Class Definition
class MainWindow(QWidget):
    # Constructor
    def __init__(self):
        super().__init__()
        self.initUI()
        self.settings()
        self.btn_click()

    # Initialize UI (App Object and Design)
    def initUI(self):
        self.btn_path = QPushButton("Ustaw ścieżkę")
        #self.label_path = QLabel("Ścieżka nie ustawiona")
        self.master = QHBoxLayout()

        column_1 = QVBoxLayout()
        column_2 = QVBoxLayout()

        column_1.addWidget(self.btn_path)
        #column_1.addWidget(self.label_path)

        self.master.addLayout(column_1, 30)
        self.master.addLayout(column_2, 70)

        self.setLayout(self.master)

    # App Settings
    def settings(self):
        self.setWindowTitle("Meteo-Data Quality Monitor")

    def btn_click(self):
        self.btn_path.clicked.connect(self.open_path_window)

    def open_path_window(self):
        self.path_window = PathWindow()
        self.path_window.show()

app = QApplication(sys.argv)

window = MainWindow()
window.show()

app.exec()