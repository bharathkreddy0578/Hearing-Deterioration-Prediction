from flask import Flask, render_template, send_from_directory, request, jsonify
import os
import math

app = Flask(__name__)

@app.route('/')
@app.route('/index.html')
def index():
    return render_template('index.html')

@app.route('/calibration')
@app.route('/calibration.html')
def calibration():
    return render_template('calibration.html')

@app.route('/predict')
@app.route('/predict.html')
def predict():
    return render_template('predict.html')

@app.route('/result')
@app.route('/result.html')
def result():
    return render_template('result.html')

@app.route('/about')
@app.route('/about.html')
def about():
    return render_template('about.html')

# API Route: Predict Future Hearing Capacity & Deterioration Age
@app.route('/api/predict_deterioration', methods=['POST'])
def predict_deterioration():
    try:
        data = request.get_json(force=True) or {}
        age_0 = int(data.get('age', 25))
        gender = str(data.get('gender', 'male')).lower()
        thresholds = data.get('thresholds', {})
        
        # High frequency user thresholds (4000 Hz and 8000 Hz)
        t_4000 = float(thresholds.get('4000', 10))
        t_8000 = float(thresholds.get('8000', 12))
        user_hf_avg = (t_4000 + t_8000) / 2.0
        
        # ISO 7029 alpha coefficients (presbycusis acceleration per year squared)
        if gender == 'female':
            alpha_avg = (0.0120 + 0.0180) / 2.0  # ~0.0150
            base_hf_20 = 11.5
        else:
            alpha_avg = (0.0160 + 0.0220) / 2.0  # ~0.0190
            base_hf_20 = 12.5
            
        # Standard norm for current age
        norm_current_hf = base_hf_20 + alpha_avg * math.pow(max(0, age_0 - 18), 2)
        gap = user_hf_avg - norm_current_hf
        
        # Rate multiplier k (accelerated aging pace factor)
        if gap <= 0:
            rate_multiplier = 1.0
        else:
            rate_multiplier = 1.0 + (gap / 15.0)
            
        # Effective Presbycusis Alpha for this user
        effective_alpha = alpha_avg * rate_multiplier
        
        # Predict Age of Moderate Loss (40 dB HL) and Severe Loss (60 dB HL)
        if user_hf_avg >= 40:
            age_moderate = age_0
        else:
            target_diff = 40.0 - user_hf_avg
            add_years = math.sqrt(target_diff / max(0.001, effective_alpha))
            age_moderate = int(round(age_0 + add_years))
            
        if user_hf_avg >= 60:
            age_severe = age_0
        else:
            target_diff_sev = 60.0 - user_hf_avg
            add_years_sev = math.sqrt(target_diff_sev / max(0.001, effective_alpha))
            age_severe = int(round(age_0 + add_years_sev))
            
        # Prevention delay: if user reduces rate back to normal baseline (k = 1.0)
        if user_hf_avg < 40:
            add_years_norm = math.sqrt((40.0 - user_hf_avg) / alpha_avg)
            age_moderate_norm = int(round(age_0 + add_years_norm))
            prevention_delay = max(0, age_moderate_norm - age_moderate)
        else:
            prevention_delay = 0
            
        # Generate Timeline Progression Curve (Ages 20 to 80)
        timeline = []
        for a in range(20, 85, 5):
            norm_val = min(90.0, base_hf_20 + alpha_avg * math.pow(max(0, a - 18), 2))
            
            if a < age_0:
                proj_val = norm_val
            else:
                proj_val = min(90.0, user_hf_avg + effective_alpha * (math.pow(a - 18, 2) - math.pow(max(0, age_0 - 18), 2)))
                
            timeline.append({
                'age': a,
                'norm': round(norm_val, 1),
                'projected': round(proj_val, 1)
            })
            
        # Warning Level & Banner Message
        if rate_multiplier >= 1.5 or age_moderate <= age_0 + 15:
            warning_level = 'CRITICAL'
            warning_message = f"CRITICAL WARNING: Your hearing is deteriorating {round(rate_multiplier, 2)}x faster than normal. High-frequency loss projected at Age {age_moderate}."
        elif rate_multiplier > 1.1:
            warning_level = 'WARNING'
            warning_message = f"WARNING: Mildly elevated decline rate ({round(rate_multiplier, 2)}x normal). High-frequency loss projected at Age {age_moderate}."
        else:
            warning_level = 'HEALTHY'
            warning_message = f"HEALTHY: Normal aging trajectory. High-frequency capacity protected until Age {age_moderate}."

        return jsonify({
            'success': True,
            'current_age': age_0,
            'gender': gender,
            'rate_multiplier': round(rate_multiplier, 2),
            'predicted_age_moderate_loss': age_moderate,
            'predicted_age_severe_loss': age_severe,
            'years_until_moderate_loss': max(0, age_moderate - age_0),
            'prevention_delay_years': prevention_delay,
            'timeline': timeline,
            'warning_level': warning_level,
            'warning_message': warning_message
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

# Static file routes
@app.route('/static/css/<path:filename>')
def css(filename):
    return send_from_directory('static/css', filename)

@app.route('/static/js/<path:filename>')
def js(filename):
    return send_from_directory('static/js', filename)

@app.route('/data/<path:filename>')
def data(filename):
    return send_from_directory('data', filename)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)