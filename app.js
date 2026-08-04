// Configuration
const SPEED_OF_SOUND_CM_MS = 34.3; // Speed of sound ~343 m/s
let audioCtx = null;
let micSource = null;
let ancNode = null;
let analyserIn = null;
let analyserOut = null;
let isRunning = false;

// UI Elements
const toggleBtn = document.getElementById('toggle-btn');
const statusText = document.getElementById('status-text');
const delaySlider = document.getElementById('delay-slider');
const delayDisplay = document.getElementById('delay-display');
const distDisplay = document.getElementById('dist-display');
const canvas = document.getElementById('scope');
const canvasCtx = canvas.getContext('2d');

// --- Initialization ---
async function initAudio() {
    try {
        audioCtx = new AudioContext();
        
        // 1. Load the Worklet Processor
        await audioCtx.audioWorklet.addModule('anc-processor.js');

        // 2. Get Microphone Input
        // CRITICAL: Disable auto-processing so we get RAW noise
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                latency: 0
            }
        });

        // 3. Create Nodes
        micSource = audioCtx.createMediaStreamSource(stream);
        ancNode = new AudioWorkletNode(audioCtx, 'anc-processor');
        
        // Analysers for Visualization
        analyserIn = audioCtx.createAnalyser();
        analyserOut = audioCtx.createAnalyser();
        analyserIn.fftSize = 2048;
        analyserOut.fftSize = 2048;

        // 4. Connect Graph
        // Path A: Mic -> Visualizer (Green Line)
        micSource.connect(analyserIn);

        // Path B: Mic -> ANC Processor (Inversion) -> Speakers
        micSource.connect(ancNode);
        ancNode.connect(audioCtx.destination);
        
        // Path C: ANC Output -> Visualizer (Red Line)
        ancNode.connect(analyserOut);

        statusText.textContent = "Active - System Running";
        statusText.className = "text-sm text-green-400";
        toggleBtn.textContent = "STOP ANC";
        toggleBtn.classList.replace('bg-teal-600', 'bg-red-600');
        toggleBtn.classList.replace('hover:bg-teal-500', 'hover:bg-red-500');

        isRunning = true;
        drawVisualizer();

    } catch (err) {
        console.error(err);
        statusText.textContent = "Error: " + err.message;
        statusText.className = "text-sm text-red-500";
    }
}

function stopAudio() {
    if (audioCtx) {
        audioCtx.close();
        audioCtx = null;
    }
    isRunning = false;
    statusText.textContent = "Standby";
    statusText.className = "text-sm text-yellow-500";
    toggleBtn.textContent = "START ANC";
    toggleBtn.classList.replace('bg-red-600', 'bg-teal-600');
    toggleBtn.classList.replace('hover:bg-red-500', 'hover:bg-teal-500');
}

// --- Interactions ---

toggleBtn.addEventListener('click', () => {
    if (!isRunning) initAudio();
    else stopAudio();
});

delaySlider.addEventListener('input', (e) => {
    const ms = parseFloat(e.target.value);
    
    // Update UI
    delayDisplay.textContent = ms.toFixed(2) + ' ms';
    const dist = ms * SPEED_OF_SOUND_CM_MS;
    distDisplay.textContent = dist.toFixed(1);

    // Send to Worklet
    if (ancNode) {
        ancNode.port.postMessage({ type: 'set-delay', value: ms });
    }
});

// --- Visualization Loop ---

function drawVisualizer() {
    if (!isRunning) return;
if (!isRunning) isRunning = true; 
    requestAnimationFrame(drawVisualizer);

    // Setup Canvas
    const w = canvas.width;
    const h = canvas.height;
    canvasCtx.fillStyle = 'rgb(0, 0, 0)';
    canvasCtx.fillRect(0, 0, w, h);
    canvasCtx.lineWidth = 2;

    const bufferLength = analyserIn.frequencyBinCount;
    const dataArrayIn = new Uint8Array(bufferLength);
    const dataArrayOut = new Uint8Array(bufferLength);

    analyserIn.getByteTimeDomainData(dataArrayIn);
    analyserOut.getByteTimeDomainData(dataArrayOut);

    // Draw Input (Green)
    canvasCtx.beginPath();
    canvasCtx.strokeStyle = 'rgb(50, 255, 100)';
    for(let i = 0; i < bufferLength; i++) {
        const v = dataArrayIn[i] / 128.0;
        const y = v * h/2;
        if(i === 0) canvasCtx.moveTo(i * (w/bufferLength), y);
        else canvasCtx.lineTo(i * (w/bufferLength), y);
    }
    canvasCtx.stroke();

    // Draw Output (Red) - Should be inverse
    canvasCtx.beginPath();
    canvasCtx.strokeStyle = 'rgb(255, 50, 50)';
    for(let i = 0; i < bufferLength; i++) {
        const v = dataArrayOut[i] / 128.0;
        const y = v * h/2;
        if(i === 0) canvasCtx.moveTo(i * (w/bufferLength), y);
        else canvasCtx.lineTo(i * (w/bufferLength), y);
    }
    canvasCtx.stroke();
}

// Handle canvas resizing
function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resize);
resize();
