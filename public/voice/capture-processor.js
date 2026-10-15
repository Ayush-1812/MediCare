/**
 * Microphone capture worklet for the voice receptionist.
 *
 * Runs on the audio render thread, which is why capture lives here rather than in a
 * ScriptProcessorNode or a MediaRecorder: this is the only place that is not subject to
 * main-thread jank. A garbage collection pause while React re-renders would otherwise
 * drop audio frames mid-sentence.
 *
 * Emits fixed-size little-endian PCM16 frames. The AudioContext is created at 16 kHz by
 * the caller, so the browser has already resampled whatever the hardware gave it and no
 * resampling is needed here — hand-rolled resampling is a common source of the metallic
 * artefacts that make speech recognition worse.
 */

class CaptureProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super()
        const processorOptions = (options && options.processorOptions) || {}
        // 320 samples = 20 ms at 16 kHz. Small enough that barge-in feels immediate,
        // large enough not to pay per-message overhead every millisecond.
        this.frameSamples = processorOptions.frameSamples || 320
        this.buffer = new Int16Array(this.frameSamples)
        this.offset = 0
        this.muted = false

        this.port.onmessage = (event) => {
            const data = event.data
            if (data && data.type === 'mute') this.muted = Boolean(data.value)
        }
    }

    process(inputs) {
        const channel = inputs[0] && inputs[0][0]
        // No input yet (the graph is still warming up) — keep the processor alive.
        if (!channel) return true

        // While muted we still return true so the node stays connected; dropping the
        // frames here rather than disconnecting means unmuting is instant and does not
        // renegotiate the audio graph.
        if (this.muted) return true

        let peak = 0

        for (let i = 0; i < channel.length; i++) {
            const sample = Math.max(-1, Math.min(1, channel[i]))
            const magnitude = sample < 0 ? -sample : sample
            if (magnitude > peak) peak = magnitude

            // Asymmetric scaling: Int16 runs -32768..32767, so using 0x8000 for negatives
            // and 0x7fff for positives uses the full range without ever wrapping a
            // full-scale negative sample round to positive.
            this.buffer[this.offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff

            if (this.offset === this.frameSamples) {
                const frame = new Int16Array(this.frameSamples)
                frame.set(this.buffer)
                // Transferred, not copied: ownership moves to the main thread so a
                // continuous 32 KB/s uplink does not allocate twice per frame.
                this.port.postMessage({ type: 'frame', pcm: frame.buffer, peak }, [frame.buffer])
                this.offset = 0
                peak = 0
            }
        }

        return true
    }
}

registerProcessor('voice-capture', CaptureProcessor)
