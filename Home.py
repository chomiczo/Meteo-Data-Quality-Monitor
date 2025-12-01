import sys
import Chart_reader

from PyQt6.QtWidgets import QApplication, QWidget, QLabel, QVBoxLayout, QHBoxLayout, QPushButton, QCalendarWidget
from PyQt6.QtCore import QDate
from matplotlib.backends.backend_qtagg import FigureCanvasQTAgg
from Path_window import PathWindow

# Class Definition
class MainWindow(QWidget):
    # Constructor
    def __init__(self):
        super().__init__()
        self.chart_canvas = None
        self.initUI()
        self.settings()
        self.btn_click()

    # Initialize UI (App Object and Design)
    def initUI(self):
        self.btn_path = QPushButton("Ustaw ścieżkę folderu z danymi")
        self.calendar = QCalendarWidget()
        self.calendar.setGridVisible(True)
        self.info_label = QLabel("Wybierz datę z kalendarza")

        # Main Layout
        self.master = QHBoxLayout()
        column_1 = QVBoxLayout()
        self.column_2 = QVBoxLayout()

        # Column 1 Widgets
        column_1.addWidget(self.btn_path)
        column_1.addWidget(self.calendar)
        column_1.addStretch()

        # Column 2 Widgets
        self.column_2.addWidget(self.info_label)

        # Layout Proportions
        self.master.addLayout(column_1, 30)
        self.master.addLayout(self.column_2, 70)

        self.setLayout(self.master)

    # App Settings
    def settings(self):
        self.setWindowTitle("Meteo-Data Quality Monitor")
        self.resize(900, 600)

    # Button Click Events
    def btn_click(self):
        self.btn_path.clicked.connect(self.open_path_window)
        self.calendar.selectionChanged.connect(self.update_chart)

    def open_path_window(self):
        self.path_window = PathWindow()
        self.path_window.show()

    # Update Chart
    def update_chart(self):
        selected_date = self.calendar.selectedDate()
        date_str = selected_date.toString("yyyy-MM-dd")

        fig = Chart_reader.get_figure(date_str)

        if self.chart_canvas:
            self.column_2.removeWidget(self.chart_canvas)
            self.chart_canvas.deleteLater()
            self.chart_canvas = None

        if self.info_label:
            self.info_label.hide()

        if fig:
            self.chart_canvas = FigureCanvasQTAgg(fig)
            self.column_2.addWidget(self.chart_canvas)
        else:
            self.info_label.setText(f"Brak danych (pliku csv) dla daty: {date_str.replace('-', '')}")
            self.info_label.show()



if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())