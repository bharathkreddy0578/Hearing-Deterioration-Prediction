// Hearing Test Module - Clinical Pure-Tone Audiometry (Hughson-Westlake Method)
// Tests hearing thresholds at 500Hz, 1000Hz, 4000Hz, and 8000Hz (Presbycusis assessment)

let audioContext;
let userThresholds = {};
let currentFrequencyIndex = 0;
let testInProgress = false;
let currentDB = -25; // Starts at -25 dB HL (deep sub-audible silence)
let rampInterval = null;

const frequencies = [500, 1000, 4000, 8000]; // Hz
const frequencyLabels = { 
    500: 'Low (500 Hz)', 
    1000: 'Mid (1000 Hz)', 
    4000: 'High (4000 Hz)',
    8000: 'Very High / Presbycusis (8000 Hz)' 
};

// Convert dB HL (-25 to 80 dB HL) to logarithmic Web Audio gain (0.00003 to 1.0)
function dbHLToGain(dbHL) {
    const clampedDB = Math.max(-25, Math.min(80, dbHL));
    if (clampedDB <= -25) return 0.00003; // Deep silence / sub-audible
    // Map -25 dB HL to +80 dB HL exponentially
    const normalized = (clampedDB + 25) / 105.0; // 0.0 to 1.0
    return 0.00003 * Math.pow(33333, normalized);
}

// Play 3 short pulsed beeps (Standard Clinical Audiometry Pattern)
function playPulsedTone(frequency, dbHL) {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    const gainValue = dbHLToGain(dbHL);
    const now = audioContext.currentTime;
    
    // Create 3 short beeps (120ms beep, 60ms gap)
    for (let i = 0; i < 3; i++) {
        const startTime = now + i * 0.18;
        const stopTime = startTime + 0.12;
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startTime);
        
        // Soft envelope curve to eliminate pops/clicks
        gainNode.gain.setValueAtTime(0.00001, startTime);
        gainNode.gain.exponentialRampToValueAtTime(Math.max(0.00001, gainValue), startTime + 0.015);
        gainNode.gain.setValueAtTime(Math.max(0.00001, gainValue), stopTime - 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, stopTime);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start(startTime);
        oscillator.stop(stopTime);
    }
}

async function startHearingTest() {
    // Initialize audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    
    // Reset state
    userThresholds = {};
    currentFrequencyIndex = 0;
    currentDB = -25;
    testInProgress = true;
    
    // UI update
    document.getElementById('test-instructions').style.display = 'none';
    document.getElementById('test-active').style.display = 'block';
    document.getElementById('volume-bar').value = 0;
    document.getElementById('test-progress').textContent = 'Signal Level: Searching from silence...';
    
    runTestStep();
}

function runTestStep() {
    if (currentFrequencyIndex >= frequencies.length) {
        completeTest();
        return;
    }
    
    const freq = frequencies[currentFrequencyIndex];
    document.getElementById('current-frequency-label').textContent = `Current Frequency: ${frequencyLabels[freq] || freq + ' Hz'}`;
    document.getElementById('test-status').textContent = 'Listening for 3 pulsed beeps... Click "I Hear It" as soon as you detect the sound.';
    
    currentDB = -25; // Reset to deep silence for each frequency sweep
    
    if (rampInterval) clearInterval(rampInterval);
    
    // Increment signal level by +2.5 dB HL every 700ms
    rampInterval = setInterval(() => {
        if (!testInProgress) {
            clearInterval(rampInterval);
            return;
        }
        
        // Progress bar 0 to 100% mapped to -25 to 80 dB HL
        const progressPercent = Math.round(((currentDB + 25) / 105) * 100);
        document.getElementById('volume-bar').value = progressPercent;
        
        const displayDB = currentDB <= 0 ? 'Quiet Baseline (Sub-Audible)' : `${currentDB} dB HL`;
        document.getElementById('test-progress').textContent = `Signal Level: ${displayDB}`;
        
        playPulsedTone(freq, currentDB);
        
        if (currentDB >= 80) {
            clearInterval(rampInterval);
            document.getElementById('test-status').textContent = 'Could not detect tone at maximum test limit.';
            userThresholds[frequencies[currentFrequencyIndex]] = 80; // 80 dB HL (max threshold / severe loss)
            setTimeout(nextFrequency, 1500);
            return;
        }
        
        currentDB += 2.5; // +2.5 dB HL micro-step
    }, 700);
}

function heardTone() {
    if (!testInProgress) return;
    
    testInProgress = false;
    if (rampInterval) clearInterval(rampInterval);
    
    // Record clinical positive threshold (0 dB HL for early/sub-audible detection)
    const recordedThreshold = Math.max(0, currentDB);
    userThresholds[frequencies[currentFrequencyIndex]] = recordedThreshold;
    
    document.getElementById('test-status').textContent = `Threshold recorded: ${recordedThreshold} dB HL`;
    
    setTimeout(nextFrequency, 1500);
}

function cantHearTone() {
    if (!testInProgress) return;
    
    testInProgress = false;
    if (rampInterval) clearInterval(rampInterval);
    
    userThresholds[frequencies[currentFrequencyIndex]] = 80; // Max threshold / 80 dB HL
    document.getElementById('test-status').textContent = 'Not heard at max test limit.';
    
    setTimeout(nextFrequency, 1500);
}

function nextFrequency() {
    currentFrequencyIndex++;
    testInProgress = true;
    runTestStep();
}

function completeTest() {
    document.getElementById('test-active').style.display = 'none';
    document.getElementById('test-complete').style.display = 'block';
    
    // Save results to localStorage
    const ageVal = document.getElementById('user-age').value || '25';
    const genderVal = document.getElementById('user-gender').value || 'male';
    
    const results = {
        age: ageVal,
        gender: genderVal,
        thresholds: userThresholds,
        timestamp: new Date().toISOString()
    };
    
    // Load previous results for trend tracking
    let previousResults = JSON.parse(localStorage.getItem('hearingResults') || '[]');
    previousResults.push(results);
    localStorage.setItem('hearingResults', JSON.stringify(previousResults));
    
    // Display summary
    let summary = 'Your thresholds: ';
    for (const [freq, db] of Object.entries(userThresholds)) {
        summary += `${freq}Hz: ${db} dB HL, `;
    }
    document.getElementById('test-results-summary').textContent = summary.slice(0, -2);
}

function showResults() {
    window.location.href = 'result.html';
}




