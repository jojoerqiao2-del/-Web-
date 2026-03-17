const DB_NAME = 'MyBodyIndexDB';
const DB_VERSION = 1;
const STORE_NAME = 'bmi_records';

let db;

document.addEventListener('DOMContentLoaded', () => {
    initDB().then(() => {
        loadHistory(); 
    });
});

// Setup IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        let request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(event) {
            let db = event.target.result;
            // create object store if not exists
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log("Database connected");
            resolve();
        };

        request.onerror = function(event) {
            console.error("DB Error: " + event.target.errorCode);
            reject();
        };
    });
}

function calculateBMI() {
    var height = document.getElementById('height').value;
    var weight = document.getElementById('weight').value;

    if (height === "" || weight === "") {
        alert("Please enter both height and weight!");
        return;
    }

    // BMI Formula
    var heightInMeters = height / 100;
    var bmi = weight / (heightInMeters * heightInMeters);
    bmi = parseFloat(bmi.toFixed(1));

    var status = "";
    var color = "";
    var tip = "";

    // BMI Standards
    if (bmi < 18.5) {
        status = "Underweight";
        color = "#5C6BC0"; 
        tip = "Eat more protein and healthy fats.";
    } else if (bmi >= 18.5 && bmi < 23) {
        status = "Healthy";
        color = "#66BB6A"; 
        tip = "Keep active and maintain a balanced diet.";
    } else if (bmi >= 23 && bmi < 27.5) {
        status = "Overweight";
        color = "#FFCA28"; 
        tip = "Reduce sugar and try cardio exercises.";
    } else {
        status = "Obese";
        color = "#EF5350"; 
        tip = "Consult a doctor for a diet plan.";
    }

    document.getElementById('result').style.display = "block";
    document.getElementById('bmi-value').innerText = bmi;
    document.getElementById('bmi-value').style.color = color;
    document.getElementById('bmi-status').innerText = status;
    document.getElementById('bmi-status').style.color = color;

    // Calculate chart position
    var minBMI = 15;
    var maxBMI = 35;
    var percentage = ((bmi - minBMI) / (maxBMI - minBMI)) * 100;
    
    if (percentage < 0) percentage = 0;
    if (percentage > 100) percentage = 100;
    
    document.getElementById('bmi-marker').style.left = percentage + "%";

    saveRecord(bmi, status, color, tip);
}


// --- Database Functions ---

function saveRecord(bmi, status, color, tip) {
    var record = {
        date: new Date().toLocaleString(),
        bmi: bmi,
        status: status,
        color: color,
        tip: tip,
        timestamp: new Date().getTime() 
    };

    var transaction = db.transaction([STORE_NAME], 'readwrite');
    var store = transaction.objectStore(STORE_NAME);
    var request = store.add(record);

    request.onsuccess = function() {
        console.log("Saved to DB");
        loadHistory(); 
    };
}

function loadHistory() {
    var listContainer = document.getElementById('history-list');
    if (!listContainer) return;

    var transaction = db.transaction([STORE_NAME], 'readonly');
    var store = transaction.objectStore(STORE_NAME);
    var request = store.getAll();

    request.onsuccess = function() {
        var history = request.result || [];

        // Sort by time ASC for chart 
        history.sort(function(a, b) {
            return (a.timestamp || 0) - (b.timestamp || 0);
        });

        // Render chart + stats
        renderHistoryStats(history);
        renderHistoryChart(history);

        // Render list 
        var list = history.slice().reverse();

        if (list.length === 0) {
            listContainer.innerHTML = '<p style="color:#999; text-align:center; margin-top: 20px;">No records yet. Go to Calculator to start.</p>';
            return;
        }

        listContainer.innerHTML = '';
        list.forEach(function(item) {
            var itemDiv = document.createElement('div');
            itemDiv.className = 'history-item';
            itemDiv.style.borderLeftColor = item.color || '#ccc';
            itemDiv.title = "Click to view details";

            itemDiv.innerHTML = `
                <div class="history-date">${item.date || ''}</div>
                <div class="history-data">BMI: ${item.bmi} - <span style="color: ${item.color}">${item.status}</span></div>
                <div style="font-size: 12px; color: #999; margin-top:5px;">(Click for details)</div>
            `;

            itemDiv.onclick = function() {
                openModal(item);
            };

            listContainer.appendChild(itemDiv);
        });
    };
}

function clearHistory() {
    if(confirm("Are you sure you want to delete all history?")) {
        var transaction = db.transaction([STORE_NAME], 'readwrite');
        var store = transaction.objectStore(STORE_NAME);
        var request = store.clear();

        request.onsuccess = function() {
            loadHistory();
        };
    }
}


// --- History Chart & Stats ---

function filterHistoryByDays(history, days) {
    if (!days || days === 'all') return history.slice();
    var d = parseInt(days, 10);
    if (isNaN(d)) return history.slice();
    var now = Date.now();
    var cutoff = now - (d * 24 * 60 * 60 * 1000);
    return history.filter(function(r) {
        return (r.timestamp || 0) >= cutoff;
    });
}

function renderHistoryStats(history) {
    var wrap = document.getElementById('history-stats');
    if (!wrap) return;

    if (!history || history.length === 0) {
        wrap.innerHTML = `
          <div class="stat-card">
            <div class="stat-label">Latest BMI</div>
            <div class="stat-value">--</div>
            <div class="stat-sub">No data yet</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Trend</div>
            <div class="stat-value">--</div>
            <div class="stat-sub">Add records in Calculator</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Status</div>
            <div class="stat-value">--</div>
            <div class="stat-sub">--</div>
          </div>
        `;
        return;
    }

    var latest = history[history.length - 1];
    var first = history[0];
    var change = (latest.bmi - first.bmi);
    var sign = change > 0 ? "+" : "";
    var trendText = sign + change.toFixed(1);
    var trendDir = change > 0.05 ? "Up" : (change < -0.05 ? "Down" : "Stable");

    wrap.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Latest BMI</div>
        <div class="stat-value">${latest.bmi}</div>
        <div class="stat-sub">${latest.date || ""}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Trend (All time)</div>
        <div class="stat-value">${trendText}</div>
        <div class="stat-sub">${trendDir}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Status</div>
        <div class="stat-value" style="color:${latest.color || "#2E7D32"}">${latest.status || "--"}</div>
        <div class="stat-sub">Based on BMI category</div>
      </div>
    `;
}

function renderHistoryChart(history) {
    var canvas = document.getElementById('bmiChart');
    var select = document.getElementById('rangeSelect');
    if (!canvas || !select) return;

    function drawForRange() {
        var range = select.value;
        var filtered = filterHistoryByDays(history, range);

        // Redraw stats based on full history, but note when filtered is small
        drawLineChart(canvas, filtered);
    }

    select.onchange = drawForRange;
    drawForRange();
}

function drawLineChart(canvas, history) {
    var ctx = canvas.getContext('2d');
    var tooltip = document.getElementById('chartTooltip');
    var note = document.getElementById('historyChartNote');

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!history || history.length === 0) {
        if (note) note.innerText = "No data yet. Add records in Calculator.";
        ctx.font = "16px Poppins, Arial";
        ctx.fillStyle = "#888";
        ctx.fillText("No records to display.", 20, 40);
        return;
    }

    if (note) note.innerText = "Click a point to view details.";

    var padL = 55, padR = 20, padT = 18, padB = 40;
    var w = canvas.width - padL - padR;
    var h = canvas.height - padT - padB;

    var ys = history.map(r => Number(r.bmi)).filter(v => !isNaN(v));
    var yMin = Math.min.apply(null, ys);
    var yMax = Math.max.apply(null, ys);
    var yPad = Math.max(0.6, (yMax - yMin) * 0.15);
    yMin -= yPad; yMax += yPad;
    yMin = Math.min(yMin, 15);
    yMax = Math.max(yMax, 35);

    function xAt(i) {
        if (history.length === 1) return padL + w/2;
        return padL + (i * (w / (history.length - 1)));
    }
    function yAt(v) {
        return padT + (yMax - v) * (h / (yMax - yMin));
    }

    // Background bands for BMI categories (Underweight / Healthy / Overweight / Obese)
    function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
    function bandRect(upper, lower) {
        var y1 = yAt(upper);
        var y2 = yAt(lower);
        var top = clamp(Math.min(y1, y2), padT, padT + h);
        var bottom = clamp(Math.max(y1, y2), padT, padT + h);
        return { y: top, h: Math.max(0, bottom - top) };
    }

    // Obese band (27.5+)
    var obese = bandRect(yMax, 27.5);
    if (obese.h > 0) {
        ctx.fillStyle = "rgba(244, 67, 54, 0.10)"; // red
        ctx.fillRect(padL, obese.y, w, obese.h);
        ctx.fillStyle = "rgba(140, 20, 20, 0.55)";
        ctx.fillText("Obese", padL + 10, obese.y + 16);
    }

    // Overweight band (23–27.5)
    var over = bandRect(27.5, 23);
    if (over.h > 0) {
        ctx.fillStyle = "rgba(255, 193, 7, 0.12)"; // yellow
        ctx.fillRect(padL, over.y, w, over.h);
        ctx.fillStyle = "rgba(120, 86, 0, 0.55)";
        ctx.fillText("Overweight", padL + 10, over.y + 16);
    }

    // Healthy band (18.5–23)
    var healthy = bandRect(23, 18.5);
    if (healthy.h > 0) {
        ctx.fillStyle = "rgba(76, 175, 80, 0.12)"; // green
        ctx.fillRect(padL, healthy.y, w, healthy.h);
        ctx.fillStyle = "rgba(20, 90, 22, 0.55)";
        ctx.fillText("Healthy", padL + 10, healthy.y + 16);
    }

    // Underweight band (<18.5)
    var under = bandRect(18.5, yMin);
    if (under.h > 0) {
        ctx.fillStyle = "rgba(63, 81, 181, 0.10)"; // blue
        ctx.fillRect(padL, under.y, w, under.h);
        ctx.fillStyle = "rgba(30, 45, 120, 0.55)";
        ctx.fillText("Underweight", padL + 10, under.y + 16);
    }


    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.fillStyle = "#666";
    ctx.font = "12px Poppins, Arial";

    var steps = 5;
    for (var s = 0; s <= steps; s++) {
        var y = padT + (s * h / steps);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL + w, y);
        ctx.stroke();

        var val = (yMax - (s * (yMax - yMin) / steps));
        ctx.fillText(val.toFixed(1), 10, y + 4);
    }

    var first = history[0];
    var last = history[history.length - 1];
    var firstLbl = first.date ? String(first.date) : "";
    var lastLbl = last.date ? String(last.date) : "";
    ctx.fillStyle = "#666";
    ctx.fillText(firstLbl, padL, canvas.height - 15);
    var lastTextWidth = ctx.measureText(lastLbl).width;
    ctx.fillText(lastLbl, padL + w - lastTextWidth, canvas.height - 15);

    ctx.strokeStyle = "rgba(46,125,50,0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    history.forEach(function(r, i) {
        var x = xAt(i);
        var y = yAt(Number(r.bmi));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    var points = [];
    history.forEach(function(r, i) {
        var x = xAt(i);
        var y = yAt(Number(r.bmi));
        points.push({ x: x, y: y, r: r });
        ctx.beginPath();
        ctx.fillStyle = "rgba(46,125,50,1)";
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    canvas.onclick = function(ev) {
        var rect = canvas.getBoundingClientRect();
        var mx = ev.clientX - rect.left;
        var my = ev.clientY - rect.top;

        var hit = null;
        var hitDist = 9999;
        points.forEach(function(p) {
            var dx = mx - p.x;
            var dy = my - p.y;
            var d = Math.sqrt(dx*dx + dy*dy);
            if (d < 12 && d < hitDist) {
                hit = p;
                hitDist = d;
            }
        });
        if (hit) {
            openModal(hit.r);
        }
    };

    canvas.onmousemove = function(ev) {
        if (!tooltip) return;
        var rect = canvas.getBoundingClientRect();
        var mx = ev.clientX - rect.left;
        var my = ev.clientY - rect.top;

        var hit = null;
        var hitDist = 9999;
        points.forEach(function(p) {
            var dx = mx - p.x;
            var dy = my - p.y;
            var d = Math.sqrt(dx*dx + dy*dy);
            if (d < 14 && d < hitDist) {
                hit = p;
                hitDist = d;
            }
        });

        if (hit) {
            tooltip.style.display = "block";
            tooltip.innerHTML = `<div style="font-weight:700;">BMI ${hit.r.bmi}</div><div style="font-size:12px; opacity:0.85;">${hit.r.date || ""}</div>`;
            tooltip.style.left = (ev.pageX + 12) + "px";
            tooltip.style.top = (ev.pageY - 10) + "px";
        } else {
            tooltip.style.display = "none";
        }
    };

    canvas.onmouseleave = function() {
        if (tooltip) tooltip.style.display = "none";
    };
}


// --- Modal Functions (New) ---

function openModal(data) {
    // Fill data into modal
    document.getElementById('m-date').innerText = data.date;
    document.getElementById('m-bmi').innerText = data.bmi;
    document.getElementById('m-bmi').style.color = data.color;
    document.getElementById('m-status').innerText = data.status;
    document.getElementById('m-status').style.color = data.color;
    document.getElementById('m-tip').innerText = data.tip;

    // Show modal
    document.getElementById('detailModal').style.display = "block";
}

function closeModal() {
    document.getElementById('detailModal').style.display = "none";
}

// Close if user clicks outside the box
window.onclick = function(event) {
    var modal = document.getElementById('detailModal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}