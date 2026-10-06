# Hearing Deterioration Prediction

## Overview
An educational web application that predicts early signs of hearing deterioration by testing a user's hearing capacity and comparing it against standard, research-based hearing data.

## Features
- **Device Calibration**: Creates a custom volume-to-dB chart using microphone feedback
- **Hearing Test**: Tests hearing thresholds at 500Hz, 1000Hz, and 4000Hz frequencies
- **Normative Comparison**: Compares user thresholds against ISO 7029, NHANES, and KNHANES data
- **Risk Classification**: Ranks hearing health as Normal / Mild Concern / Possible Deterioration
- **Trend Tracking**: Shows hearing stability over time with repeated testing

## Technology Stack
- Frontend: HTML5, CSS3, JavaScript (Web Audio API)
- Backend: Flask (Python)
- Data: JSON normative hearing thresholds

## How to Run
1. Install Python 3.x
2. Install dependencies: `pip install -r requirements.txt`
3. Run the app: `python app.py`
4. Open http://localhost:5000 in your browser

## Disclaimer
This is an academic/research project for educational purposes only. It is not a medical diagnostic tool. Consult an audiologist for clinical assessment.