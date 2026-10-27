# Hearing Deterioration Prediction

A web-based hearing health screening tool that measures hearing thresholds using calibrated audio testing and compares results against age/gender normative data (ISO 7029 / NHANES) to predict early signs of hearing deterioration.

## Features
- **Device Calibration**: Uses your device microphone to measure actual sound output (dB SPL) across volume levels, creating a personalized volume-to-dB calibration chart.
- **Clinical Hearing Test**: Pure-tone audiometry at 500 Hz, 1000 Hz, 4000 Hz, and 8000 Hz using pulsed tones.
- **Risk Classification**: Compares your thresholds to age/gender norms and classifies risk (Normal / Mild Concern / Possible Deterioration / Significant Concern).
- **Longitudinal Tracking**: Stores test history in your browser to track hearing changes over time.
- **Future Deterioration Prediction**: Projects hearing loss trajectory and estimates age of moderate/severe loss.

## Tech Stack
- **Backend**: Python Flask
- **Frontend**: HTML5, CSS3, JavaScript (Web Audio API)
- **Design**: Ferrari-inspired luxury theme (near-black canvas, Rosso Corsa accents)

## How to Run

### 1. Navigate to project folder
```bash
cd "/Users/suhassureshbabu/Downloads/Zen/project /hearing-deterioration-prediction"
```

### 2. Create and activate virtual environment
```bash
python3 -m venv venv
source venv/bin/activate
```
*(On Windows, use: `venv\Scripts\activate`)*

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the app
```bash
python3 app.py
```

### 5. Open in browser
Visit: `http://127.0.0.1:5001`

## Important Notes
- **Microphone permission**: Required for calibration. Enable it in System Settings → Privacy & Security → Microphone.
- **Educational tool only**: Not a medical diagnostic tool. Consult an audiologist for clinical assessment.
- **Data privacy**: All test data stays in your browser (localStorage). Nothing is uploaded to a server.

## File Structure
```
hearing-deterioration-prediction/
├── app.py
├── requirements.txt
├── README.md
├── .gitignore
├── data/
│   └── normative_data.json
├── static/
│   ├── css/
│   └── js/
└── templates/
    ├── index.html
    ├── calibration.html
    ├── predict.html
    ├── result.html
    └── about.html
```
