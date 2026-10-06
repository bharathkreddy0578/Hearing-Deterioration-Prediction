// Calibration Module - Creates device-specific volume-to-dB chart (Real Measurement)

let audioContext;
let microphoneStream;
let calibrationData = [];
let currentVolume = 0;
let analyser;
let microphone;

const volumeLevels = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

async function initCalibration() {
    try {
        // Request microphone access
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        document.getElementById('calibration-status').textContent = 'Microphone access granted. Ready to start calibration.';
        
        // Initialize audio context
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        // Set up analyser for microphone input
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        
        // Connect microphone to analyser
        microphone = audioContext.createMediaStreamSource(microphoneStream);
        microphone.connect(analyser);
        
        // Start calibration sequence
        setTimeout(startCalibrationSequence, 1000);
    } catch (err) {
        document.getElementById('calibration-status').textContent = 'Microphone access denied or error occurred.';
        document.getElementById('error-message').textContent = 'Error: ' + err.message + '. You can still run the test with default estimates.';
        document.getElementById('error-message').style.display = 'block';
    }
}

function startCalibrationSequence() {
    document.getElementById('calibration-progress').style.display = 'block';
    currentVolume = 0;
    calibrationData = [];
    runCalibrationStep();
}

function runCalibrationStep() {
    if (currentVolume >= volumeLevels.length) {
        completeCalibration();
        return;
    }
    
    const vol = volumeLevels[currentVolume];
    const progress = ((currentVolume + 1) / volumeLevels.length) * 100;
    
    document.getElementById('progress-bar').value = progress;
    document.getElementById('progress-text').textContent = Math.round(progress) + '%';
    document.getElementById('calibration-status').textContent = 'Testing output volume level ' + Math.round(vol * 100) + '%...';
    
    // Play tone and measure dB
    playToneAndMeasure(vol);
    
    currentVolume++;
    setTimeout(runCalibrationStep, 1500); // Wait 1.5s between steps
}

function playToneAndMeasure(volumeLevel) {
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime); // 1kHz test tone
    gainNode.gain.setValueAtTime(volumeLevel, audioContext.currentTime);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.8); // Play tone for 0.8s
    
    // Measure microphone input at 300ms while tone is playing
    setTimeout(() => {
        const measuredDB = measureMicrophoneLevel();
        calibrationData.push({
            volume: volumeLevel,
            percent: Math.round(volumeLevel * 100),
            dB: measuredDB
        });
        console.log('Calibration point:', volumeLevel, '->', measuredDB, 'dB');
    }, 300);
}

function measureMicrophoneLevel() {
    const bufferLength = analyser.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);
    
    // Calculate RMS (Root Mean Square) of audio signal
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    
    // Convert RMS to dB (decibels)
    let db = 20 * Math.log10(rms || 0.00001);
    
    // Clamp to reasonable range (-60 to 0 dB)
    db = Math.max(-60, Math.min(0, db));
    
    return Math.round(db);
}

function completeCalibration() {
    document.getElementById('calibration-progress').style.display = 'none';
    document.getElementById('calibration-status').textContent = 'Calibration complete!';
    document.getElementById('calibration-results').style.display = 'block';
    
    // Save calibration data to localStorage for use in hearing test
    localStorage.setItem('calibrationData', JSON.stringify(calibrationData));
    console.log('Calibration data saved:', calibrationData);
}

function startHearingTest() {
    window.location.href = 'predict.html';
}

// Auto-start calibration when page loads
window.addEventListener('load', initCalibration);

