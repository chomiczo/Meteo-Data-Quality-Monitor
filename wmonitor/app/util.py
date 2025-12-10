from datetime import datetime
import re
from typing import NamedTuple

# 1. LISTA KOLUMN DO POMINIĘCIA Z PLIKÓW CSV
# Lista zawiera wszystkie kolumny systemowe, statusowe, cząstkowe i techniczne z plików CSV.
COLUMNS_TO_EXCLUDE_FROM_CSV = [
    '1256CV', '1M METAR Tab.4678', '1M Maximum diameter hail', '1M Measuring quality [0.', 
    '1M Radar reflectivity [d', '1M SYNOP Tab.4677', '1M SYNOP Tab.4680', '1M Visibility in precipi', 
    '1SERIAL (State)', '1SERIAL (State).1', '2SERIAL (State)', '2SERIAL (State).1', 
    '2SERIAL (State).2', '2SERIAL (State).3', '5M METAR Tab.4678', '5M SYNOP Tab.4677', 
    '5M SYNOP Tab.4680', 'Ambient temperature [deg', 'Control voltage [mV]', 
    'Current heating carriers', 'Current heating heads [m', 'Current heating housing[', 
    'Current pane heating las', 'Current pane heating rec', 'Day', 'Device adress', 
    'Hour', 'Interior temperature [de', 'Mean value laser current', 'Minute', 'Month', 
    'Number of all measured p', 'Number of particles < mi', 'Number of particles < mi.1', 
    'Number of particles > ma', 'Number of particles C1S1', 'Number of particles C1S1.1', 
    'Number of particles C1S1.10', 'Number of particles C1S1.2', 'Number of particles C1S1.3', 
    'Number of particles C1S1.4', 'Number of particles C1S1.5', 'Number of particles C1S1.6', 
    'Number of particles C1S1.7', 'Number of particles C1S1.8', 'Number of particles C1S1.9', 
    'Number of particles C1S2', 'Number of particles C1S2.1', 'Number of particles C1S3', 
    'Number of particles C1S4', 'Number of particles C1S5', 'Number of particles C1S6', 
    'Number of particles C1S7', 'Number of particles C1S8', 'Number of particles C1S9', 
    'Number of particles C2S1', 'Number of particles clas', 'Number of particles clas.1', 
    'Number of particles clas.2', 'Number of particles clas.3', 'Number of particles clas.4', 
    'Number of particles clas.5', 'Number of particles clas.6', 'Number of particles clas.7', 
    'Number of particles clas.8', 'Number of particles no h', 'Number of particles with', 
    'Optical control output [', 'Reserve Status', 'Second', 'Serial number', 
    'Software-Version', 'Static Signal', 'Status Control output la', 'Status Current heating c', 
    'Status Current heating h', 'Status Current pane heat', 'Status Current pane heat.1', 
    'Status Currnet heating h', 'Status Heating supply', 'Status Laser', 
    'Status Laser current (an', 'Status Laser currnet (gi', 'Status Laser temperature', 
    'Status Laser temperature.1', 'Status Sensor Supply', 'Status Temperature senso', 
    'TZ', 'Temperature of laser dri', 'Total volume (gross) of ', 'Total volume (gross) of .1',
    'Total volume (gross) of', 
    'Total volume (gross) of .10', 'Total volume (gross) of .2', 'Total volume (gross) of .3', 
    'Total volume (gross) of .4', 'Total volume (gross) of .5', 'Total volume (gross) of .6', 
    'Total volume (gross) of .7', 'Total volume (gross) of .8', 'Total volume (gross) of .9', 
    'Voltage Heating supply [', 'Voltage sensor supply [1', 'Year', 'interna data', 
    'internal data', 'internal data.1', 'internal data.2', 'posX', 'posY',
    # Lista z poprzednich kroków (dla pewności, że nic nie umknie)
    'record_no', 'Temp (degC)', 'Humidity (%)', 'RTD_1 (degC)', 'RTD_1_AV (degC)', 
    'RTD_2 (degC)', 'RTD_2_AV (degC)', 'RTD_3 (degC)', 'RTD_3_AV (degC)', 'Prom_1 (mV)', 
    'Prom_1_AV (mV)', 'Prom_1_SD (mV)', 'Prom_2 (mV)', 'Prom_2_AV (mV)', 'Prom_2_SD (mV)', 
    'RTD_4 (degC)', 'RTD_4_AV (degC)', 'RTD_5 (degC)', 'RTD_5_AV (degC)', 'RTD_6 (degC)', 
    'RTD_6_AV (degC)', 'RTD_7 (degC)', 'RTD_7_AV (degC)', 'RTD_8 (degC)', 'RTD_8_AV (degC)', 
    'TA_1_1_1 (degC)', 'RH_1_1_1 (%)', 'PPFD_BC_IN_2_1_1 (mV)', 'PPFD_BC_IN_2_1_1_SD (mV)', 
    'PPFD_BC_IN_2_2_1 (mV)', 'PPFD_BC_IN_2_2_1_SD (mV)', 'PPFD_BC_IN_1_1_1_SD', 
    'PPFD_BC_IN_1_1_2_SD', 'TS_6_1_1 (degC)', 'TS_6_2_1 (degC)', 'TS_7_1_1 (degC)', 
    'TS_7_2_1 (degC)', 'TS_8_1_1 (degC)', 'TS_8_2_1 (degC)', 'TS_9_1_1 (degC)', 
    'TS_9_2_1 (degC)', 'TS_10_1_1 (degC)', 'TS_10_2_1 (degC)', 'TA_1_2_1.1', 'SKR_UP_1 (mV)', 
    'SKR_UP_2 (mV)', 'SKR_UP_3 (mV)', 'SKR_UP_4 (mV)', 'SKR_DOWN_1 (mV)', 'SKR_DOWN_2 (mV)', 
    'SKR_DOWN_3 (mV)', 'SKR_DOWN_4 (mV)', 'CNR4_PT100_AVdegC', 'G_1_1_1mV', 'G_2_1_1mV', 
    'G_3_1_1mV', 'G_4_1_1mV', 'G_5_1_1mV', 'G_6_1_1mV', 'G_7_1_1mV', 'G_8_1_1mV', 
    'G_9_1_1mV', 'G_10_1_1mV', 'SDI12_33', 'SDI12_52', 'SDI12_32', 'SDI12_23', 'SDI12_31', 
    'SDI12_24', 'SDI12_13', 'SDI12_43', 'SDI12_41', 'U_plytka1mV', 'SDI12_21', 'SDI12_53', 
    'SDI12_14', 'SDI12_54', 'SDI12_22', 'SDI12_44', 'SDI12_51', 'SDI12_11', 'SDI12_42', 
    'SDI12_12', 'SDI12_34', 'PPFDd_1_1_1_AV', 'PPFD_1_2_1_SD', 'PPFDd_1_1_1_SD', 
    'BF5Sunshine_CH2mV', 'BF5Sunshine_CH1mV', 'Thermocouple_21 (degC)', 'Thermocouple_21_SD (degC)', 
    'RTD_5_SD (degC)', 'Voltage_10 (mV)', 'Voltage_5 (mV)', 'RTD_9 (degC)', 'TA_2_1_1 (degC)', 
    'RH_2_1_1 (%)', 'PPFD_BC_IN_1_1_1 (mV)', 'PPFD_BC_IN_1_1_1_AV (mV)', 
    'PPFD_BC_IN_1_1_1_SD (mV)', 'PPFD_BC_IN_1_2_1 (mV)', 'PPFD_BC_IN_1_2_1_AV (mV)', 
    'PPFD_BC_IN_1_2_1_SD (mV)', 'CNR4_PT100 (degC)', 'CNR4_PT100_AV (degC)', 
    'CNR4_PT100_SD (degC)', 'BF5Sunshine_CH1 (mV)', 'BF5Sunshine_CH1_AV (mV)', 
    'BF5Sunshine_CH1_SD (mV)', 'BF5Sunshine_CH2 (mV)', 'BF5Sunshine_CH2_AV (mV)', 
    'BF5Sunshine_CH2_SD (mV)', 'PPFD_1_2_1_AV', 'PPFDr_1_2_1_AV', 'PPFDr_1_2_1_SD', 
    'PPFD_1_1_1_AV', 'PPFD_1_1_1_SD', 'Temp_NUM', 'Humidity_NUM', 'Prom_2_NUM', 'RTD_4_NUM', 
    'RTD_2_NUM', 'RTD_5_NUM', 'Prom_1_NUM', 'RTD_3_NUM', 'RTD_7_NUM', 'LowSpeedCounter_11', 
    'RTD_1_NUM', 'RTD_8_NUM', 'RTD_6_NUM', '1038CV', '1160CV', '1161CV', 'C038CV', 'C160CV', 
    'CSERIAL_State_1', 'CSERIAL_State_2', 'CSERIAL_State_3', 'CSERIAL_State_4', 
    'Volt_12_V', 'Voltage_13_mV', 'LWin_1_2_W', 'LWout_1_2_W', 'Res_100_Ohms', 'Resistance_12_Ohms'
]

# Regex dopasowujący nazwy plików CSV:
#   <prefix>_<YYYYMMDDTHHMMSS>.csv
FNAME_RX = re.compile(
    r'(?P<prefix>\w+)_(?P<date>\d{8}T\d{6})',
    flags=re.I,
)

# Format timestampów w danych (np. "2023/04/17 12:30:00.000")
TS_FMT = '%Y/%m/%d %H:%M:%S.%f'


def parse_ts(datestr: str):
    """Konwertuje timestamp w formacie tekstowym na float (sekundy epoki)."""
    return datetime.strptime(datestr, TS_FMT).timestamp()


class DataRequest(NamedTuple):
    """Pojedyncze żądanie danych: określa stację, prefiks i zakres czasowy."""
    station: str
    prefix: str
    col_prefix: str
    tmin: float
    tmax: float