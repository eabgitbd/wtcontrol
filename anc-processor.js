class AncProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        // 2-second circular buffer at 48kHz (approx 96,000 samples)
        // This stores the history of the audio to allow for the delay.
        this.bufferSize = 96000; 
        this.buffer = new Float32Array(this.bufferSize);
        this.writeIndex = 0;
        
        // Default delay in samples
        this.delaySamples = 0;

        // Listen for messages from the main thread (UI)
        this.port.onmessage = (event) => {
            if (event.data.type === 'set-delay') {
                // Convert requested ms to sample count
                // formula: samples = (ms / 1000) * sampleRate
                const ms = event.data.value;
                this.delaySamples = Math.floor((ms / 1000) * sampleRate);
            }
        };
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];

        // If no input, keep processor alive
        if (!input || input.length === 0) return true;

        const inputChannel = input[0];
        const outputChannel = output[0];

        // Process audio block (usually 128 samples)
        for (let i = 0; i < inputChannel.length; i++) {
            // 1. WRITE: Store raw input into circular buffer
            this.buffer[this.writeIndex] = inputChannel[i];

            // 2. READ: Calculate read position based on delay
            // We move BACKWARDS from the write pointer by 'delaySamples'
            let readIndex = this.writeIndex - this.delaySamples;
            
            // Handle wrap-around for circular buffer
            if (readIndex < 0) {
                readIndex += this.bufferSize;
            }

            // 3. INVERT: Read the delayed sample and multiply by -1 (180° flip)
            // This creates the "Anti-Noise"
            outputChannel[i] = -this.buffer[readIndex];

            // 4. Advance write pointer
            this.writeIndex++;
            if (this.writeIndex >= this.bufferSize) {
                this.writeIndex = 0;
            }
        }

        return true; // Keep processor alive
    }
}

registerProcessor('anc-processor', AncProcessor);
