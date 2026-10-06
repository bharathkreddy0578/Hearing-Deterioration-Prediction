// Results Module - Compares user thresholds to norms, renders Audiogram canvas, and classifies risk

async function loadResults() {
    const results = JSON.parse(localStorage.getItem('hearingResults') || '[]');
    
    if (results.length === 0) {
        document.getElementById('error-message').textContent = 'No test results found. Please complete the hearing test first.';
        document.getElementById('error-message').style.display = 'block';
        return;
    }
    
    // Get latest result
    const latest = results[results.length - 1];
    
    // Load normative data
    const normData = await fetch('data/normative_data.json').then(r => r.json());
    
    // Determine age group
    const age = parseInt(latest.age || 25);
    const gender = (latest.gender || 'male').toLowerCase();
    const ageGroup = getAgeGroup(age);
    
    // Populate test profile
    document.getElementById('result-age').textContent = age;
    document.getElementById('result-gender').textContent = gender.charAt(0).toUpperCase() + gender.slice(1);
    document.getElementById('result-date').textContent = new Date(latest.timestamp || Date.now()).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    // Build comparison table and prepare chart points
    const tableBody = document.getElementById('results-table-body');
    tableBody.innerHTML = '';
    
    let totalGap = 0;
    
    const freqs = ['500', '1000', '4000', '8000'];
    const userPoints = [];
    const normPoints = [];
    
    for (const freq of freqs) {
        const userThreshold = latest.thresholds[freq] !== undefined ? latest.thresholds[freq] : 0;
        const norm = normData.norms[gender][ageGroup][freq];
        const gap = userThreshold - norm;
        
        userPoints.push(userThreshold);
        normPoints.push(norm);
        
        totalGap += gap;
        
        const risk = classifyRisk(gap);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${freq} Hz</strong></td>
            <td>${userThreshold} dB HL</td>
            <td>${norm} dB HL</td>
            <td>${gap > 0 ? '+' : ''}${Math.round(gap * 10) / 10} dB</td>
            <td><span class="${risk.className}">${risk.label}</span></td>
        `;
        tableBody.appendChild(row);
    }
    
    // Render Audiogram Graph
    drawAudiogram('audiogramCanvas', freqs, userPoints, normPoints);
    
    // Overall risk classification
    const avgGap = Math.round((totalGap / freqs.length) * 10) / 10;
    const overallRisk = classifyRisk(avgGap);
    
    const riskBadge = document.getElementById('overall-risk');
    riskBadge.textContent = `Overall Assessment: ${overallRisk.label} (Average Threshold Gap: ${avgGap > 0 ? '+' : ''}${avgGap} dB)`;
    riskBadge.className = `risk-badge ${overallRisk.className}`;
    
    // Call Future Deterioration Prediction API
    try {
        const predRes = await fetch('/api/predict_deterioration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                age: age,
                gender: gender,
                thresholds: latest.thresholds
            })
        }).then(r => r.json());
        
        if (predRes.success) {
            renderPredictionResults(predRes);
        }
    } catch (err) {
        console.error('Error fetching prediction:', err);
    }
    
    // Trend analysis
    if (results.length > 1) {
        const previous = results[results.length - 2];
        const prevAvg = calculateAverageGap(previous, normData, ageGroup);
        const diff = Math.round((avgGap - prevAvg) * 10) / 10;
        const trend = diff > 3 ? 'showing slight threshold elevation' : diff < -3 ? 'improving' : 'stable';
        document.getElementById('trend-analysis').textContent = `Trend: Your hearing capacity is ${trend} compared to your last test session (Change: ${diff > 0 ? '+' : ''}${diff} dB).`;
    } else {
        document.getElementById('trend-analysis').textContent = 'Trend: Initial baseline recorded. Take regular monthly tests to track changes over time.';
    }
    
    // Recommendations
    renderRecommendations(overallRisk.label, avgGap);
    
    document.getElementById('results-container').style.display = 'block';
}

function renderPredictionResults(data) {
    const banner = document.getElementById('prediction-banner');
    const paceEl = document.getElementById('metric-pace');
    const modEl = document.getElementById('metric-moderate-age');
    const sevEl = document.getElementById('metric-severe-age');
    
    paceEl.textContent = `${data.rate_multiplier}x`;
    modEl.textContent = `Age ${data.predicted_age_moderate_loss}`;
    sevEl.textContent = `Age ${data.predicted_age_severe_loss}`;
    
    if (data.warning_level === 'CRITICAL') {
        banner.className = 'risk-badge risk-danger';
        banner.innerHTML = `<strong>⚠️ CRITICAL WARNING:</strong> Hearing is declining <strong>${data.rate_multiplier}x faster</strong> than population average. Projected Moderate Hearing Loss (40 dB) at <strong>Age ${data.predicted_age_moderate_loss}</strong> (${data.years_until_moderate_loss} years from now).`;
    } else if (data.warning_level === 'WARNING') {
        banner.className = 'risk-badge risk-warning';
        banner.innerHTML = `<strong>⚠️ ELEVATED DECLINE:</strong> Hearing is declining <strong>${data.rate_multiplier}x faster</strong> than average. Projected Moderate Loss at <strong>Age ${data.predicted_age_moderate_loss}</strong>. By adopting ear protection, you can delay loss by up to <strong>${data.prevention_delay_years} years</strong>!`;
    } else {
        banner.className = 'risk-badge risk-normal';
        banner.innerHTML = `<strong>✓ HEALTHY TRAJECTORY:</strong> Normal age progression rate. High-frequency capacity protected until <strong>Age ${data.predicted_age_moderate_loss}</strong>.`;
    }
    
    drawTimelineGraph('timelineCanvas', data.timeline, data.current_age, data.predicted_age_moderate_loss);
}

function drawTimelineGraph(canvasId, timeline, currentAge, targetAge) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);
    
    const paddingLeft = 55;
    const paddingRight = 35;
    const paddingTop = 40;
    const paddingBottom = 45;
    
    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;
    
    // Scale: Age 20 to 80 on X axis, 0 to 80 dB HL on Y axis
    const minAge = 20;
    const maxAge = 80;
    const minDB = 0;
    const maxDB = 80;
    
    function getX(age) {
        return paddingLeft + ((age - minAge) / (maxAge - minAge)) * graphWidth;
    }
    function getY(db) {
        const clamped = Math.max(minDB, Math.min(maxDB, db));
        return paddingTop + ((clamped - minDB) / (maxDB - minDB)) * graphHeight;
    }
    
    // Draw horizontal grid lines (dB)
    ctx.lineWidth = 1;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    for (let db = 0; db <= 80; db += 20) {
        const y = getY(db);
        ctx.strokeStyle = '#333333';
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();
        
        ctx.fillStyle = '#888888';
        ctx.fillText(`${db} dB`, paddingLeft - 8, y + 3);
    }
    
    // Moderate Loss Limit Line (40 dB)
    const y40 = getY(40);
    ctx.strokeStyle = '#ffaa00';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y40);
    ctx.lineTo(width - paddingRight, y40);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#ffaa00';
    ctx.textAlign = 'left';
    ctx.fillText('40 dB (Moderate Loss Threshold)', paddingLeft + 10, y40 - 5);
    
    // Vertical grid lines (Age)
    ctx.textAlign = 'center';
    for (let age = 20; age <= 80; age += 10) {
        const x = getX(age);
        ctx.strokeStyle = '#333333';
        ctx.beginPath();
        ctx.moveTo(x, paddingTop);
        ctx.lineTo(x, height - paddingBottom);
        ctx.stroke();
        
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(`Age ${age}`, x, height - paddingBottom + 18);
    }
    
    // Draw Normal Population Line (Blue)
    ctx.strokeStyle = '#3399ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    timeline.forEach((pt, i) => {
        const x = getX(pt.age);
        const y = getY(pt.norm);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw Projected User Line (Red)
    ctx.strokeStyle = '#ff2e00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    timeline.forEach((pt, i) => {
        const x = getX(pt.age);
        const y = getY(pt.projected);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw Points
    timeline.forEach(pt => {
        const x = getX(pt.age);
        const y = getY(pt.projected);
        ctx.fillStyle = '#ff2e00';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Current Age Marker
    const curX = getX(currentAge);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(curX, paddingTop);
    ctx.lineTo(curX, height - paddingBottom);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText('You Now', curX, paddingTop - 8);
    
    // Legend
    ctx.fillStyle = '#3399ff';
    ctx.fillRect(width - 180, 12, 10, 10);
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'left';
    ctx.fillText('Normal Aging Curve', width - 165, 20);
    
    ctx.fillStyle = '#ff2e00';
    ctx.fillRect(width - 80, 12, 10, 10);
    ctx.fillStyle = '#cccccc';
    ctx.fillText('Your Trajectory', width - 65, 20);
}

function drawAudiogram(canvasId, freqs, userPoints, normPoints) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear background
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);
    
    const paddingLeft = 60;
    const paddingRight = 40;
    const paddingTop = 45;
    const paddingBottom = 40;
    
    const graphWidth = width - paddingLeft - paddingRight;
    const graphHeight = height - paddingTop - paddingBottom;
    
    // Standard Audiogram dB Scale: 0 dB HL (top - quietest) to 90 dB HL (bottom - loudest)
    const minDB = 0;
    const maxDB = 90;
    
    // Draw Grid Lines (dB HL horizontal lines)
    ctx.lineWidth = 1;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    
    for (let db = minDB; db <= maxDB; db += 10) {
        const y = paddingTop + ((db - minDB) / (maxDB - minDB)) * graphHeight;
        
        ctx.strokeStyle = '#333333';
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();
        
        ctx.fillStyle = '#888888';
        ctx.fillText(`${db} dB`, paddingLeft - 8, y + 4);
    }
    
    // Draw Frequency Vertical Lines (X axis)
    const xCoords = [];
    freqs.forEach((freq, idx) => {
        const x = paddingLeft + (idx / (freqs.length - 1)) * graphWidth;
        xCoords.push(x);
        
        ctx.strokeStyle = '#333333';
        ctx.beginPath();
        ctx.moveTo(x, paddingTop);
        ctx.lineTo(x, height - paddingBottom);
        ctx.stroke();
        
        ctx.fillStyle = '#aaaaaa';
        ctx.textAlign = 'center';
        ctx.fillText(`${freq} Hz`, x, height - paddingBottom + 20);
    });
    
    // Helper to convert dB HL value to Y pixel coordinate
    function getY(db) {
        const clampedDB = Math.max(minDB, Math.min(maxDB, db));
        return paddingTop + ((clampedDB - minDB) / (maxDB - minDB)) * graphHeight;
    }
    
    // Draw Population Norm Line (Blue)
    ctx.strokeStyle = '#3399ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    normPoints.forEach((db, i) => {
        const x = xCoords[i];
        const y = getY(db);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw Norm Line Points
    normPoints.forEach((db, i) => {
        const x = xCoords[i];
        const y = getY(db);
        ctx.fillStyle = '#3399ff';
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Draw User Threshold Line (Red / Primary)
    ctx.strokeStyle = '#ff2e00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    userPoints.forEach((db, i) => {
        const x = xCoords[i];
        const y = getY(db);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Draw User Points (Circles)
    userPoints.forEach((db, i) => {
        const x = xCoords[i];
        const y = getY(db);
        ctx.fillStyle = '#ff2e00';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });
    
    // Graph Legend
    ctx.fillStyle = '#3399ff';
    ctx.fillRect(width - 180, 15, 12, 12);
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'left';
    ctx.fillText('Norm Baseline', width - 160, 25);
    
    ctx.fillStyle = '#ff2e00';
    ctx.fillRect(width - 85, 15, 12, 12);
    ctx.fillStyle = '#cccccc';
    ctx.fillText('Your Result', width - 65, 25);
}

function renderRecommendations(riskLabel, avgGap) {
    const el = document.getElementById('recommendations');
    let html = '';
    
    if (riskLabel === 'Normal') {
        html = `
            <p style="color: var(--success); font-weight: 500;">✓ Normal Hearing Capacity</p>
            <p>Your measured thresholds are well within normal baseline limits for your age group.</p>
            <ul>
                <li>Maintain safe listening habits (keep earphone volume under 60%).</li>
                <li>Wear hearing protection in high-noise environments.</li>
                <li>Re-test periodically to track long-term hearing health.</li>
            </ul>
        `;
    } else if (riskLabel === 'Mild Concern') {
        html = `
            <p style="color: var(--warning); font-weight: 500;">⚠️ Mild Sensitivity Shift</p>
            <p>Your threshold gap (+${avgGap} dB) indicates a minor elevation compared to normal age baseline.</p>
            <ul>
                <li>Take regular audio breaks when using earbuds or headphones.</li>
                <li>Avoid prolonged exposure to loud noise sources.</li>
                <li>Re-test in 1-2 weeks in a very quiet room.</li>
            </ul>
        `;
    } else {
        html = `
            <p style="color: var(--error); font-weight: 500;">❗ Threshold Gap Identified</p>
            <p>Your test indicates a noticeable threshold gap (+${avgGap} dB) compared to age baseline data.</p>
            <ul>
                <li>Consider consulting an audiologist or ENT doctor for a clinical evaluation.</li>
                <li>Protect your ears using certified noise-canceling earplugs in loud settings.</li>
            </ul>
        `;
    }
    
    el.innerHTML = html;
}

function getAgeGroup(age) {
    if (age < 30) return '20-29';
    if (age < 40) return '30-39';
    if (age < 50) return '40-49';
    if (age < 60) return '50-59';
    if (age < 70) return '60-69';
    return '70+';
}

function classifyRisk(gap) {
    if (gap <= 5) return { label: 'Normal', className: 'risk-normal' };
    if (gap <= 15) return { label: 'Mild Concern', className: 'risk-mild' };
    if (gap <= 25) return { label: 'Possible Deterioration', className: 'risk-warning' };
    return { label: 'Significant Concern', className: 'risk-danger' };
}

function calculateAverageGap(result, normData, ageGroup) {
    let total = 0;
    const gender = (result.gender || 'male').toLowerCase();
    const freqs = ['500', '1000', '4000', '8000'];
    for (const freq of freqs) {
        const userThreshold = result.thresholds[freq] !== undefined ? result.thresholds[freq] : 0;
        const norm = normData.norms[gender][ageGroup][freq];
        total += userThreshold - norm;
    }
    return total / freqs.length;
}

// Load results when page loads
window.addEventListener('load', loadResults);



