import Chart_reader

from PyQt6.QtWidgets import QWidget, QVBoxLayout, QPushButton, QLineEdit, QFileDialog, QLabel

# Class Definition
class PathWindow(QWidget):
    # Constructor
    def __init__(self):
        super().__init__()
        self.initUI()
        self.settings()
        self.btn_click()

    # Initialize UI (App Object and Design)
    def initUI(self):
        layout = QVBoxLayout()

        self.label = QLabel("Ścieżka folderu CSV:")
        self.path_edit = QLineEdit()
        self.btn_browse = QPushButton("Przeglądaj")
        self.btn_save = QPushButton("Zapisz")

        layout.addWidget(self.label)
        layout.addWidget(self.path_edit)
        layout.addWidget(self.btn_browse)
        layout.addWidget(self.btn_save)

        self.setLayout(layout)

    # App Settings
    def settings(self):
        self.setWindowTitle("Wybierz ścieżkę foleru z danymi")

    def btn_click(self):
        self.btn_browse.clicked.connect(self.select_folder)
        self.btn_save.clicked.connect(self.save_folder)

    def select_folder(self):
        folder_path = QFileDialog.getExistingDirectory(self, "Wybierz folder")
        if folder_path:
            self.path_edit.setText(folder_path)

    def save_folder(self):
        Chart_reader.set_csv_folder(self.path_edit.text())

        self.close()

