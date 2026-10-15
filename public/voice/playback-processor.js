/**
 * Playback worklet for synthesized speech.
 *
 * Audio arrives from the provider in chunks that do not align to the render quantum, so
 * this keeps its own queue and reads across chunk boundaries. Playing each chunk through
 * its own `AudioBufferSourceNode` instead — the obvious approach — leaves an audible gap
 * at every seam, because the next node cannot be scheduled with sample accuracy from the
 * main thread.
 *
 * `flush` is the whole reason this is a worklet: when the patient interrupts, everything
 * already queued has to stop *now*. A buffered source node would keep playing until the
 * chunk ended, which is exactly the "it talked over me" failure that makes a voice agent
 * feel broken.
 */

class PlaybackProcessor extends AudioWorkletProcessor {
    constructor() {
        super()
        /** @type {Float32Array[]} */
        this.queue = []
        this.readOffset = 0
        this.wasPlaying = false

        this.port.onmessage = (event) => {
            const data = event.data
            if (!data) return

            if (data.type === 'push' && data.pcm) {
                this.queue.push(new Float32Array(data.pcm))
                return
            }

            if (data.type === 'flush') {
                // Dropped wholesale. Fading out would be gentler but adds latency to the
                // one operation that must feel instantaneous.
                this.queue.length = 0
                this.readOffset = 0
                this.wasPlaying = false
                this.port.postMessage({ type: 'flushed' })
            }
        }
    }

    process(_inputs, outputs) {
        const output = outputs[0][0]
        if (!output) return true

        let written = 0

        while (written < output.length) {
            if (this.queue.length === 0) {
                // Underrun: emit silence rather than stopping, so a late chunk resumes
                // seamlessly instead of needing the node restarted.
                output[written++] = 0
                continue
            }

            const head = this.queue[0]
            const available = head.length - this.readOffset
            const space = output.length - written
            const count = available < space ? available : space

            output.set(head.subarray(this.readOffset, this.readOffset + count), written)
            written += count
            this.readOffset += count

            if (this.readOffset >= head.length) {
                this.queue.shift()
                this.readOffset = 0
            }
        }

        const playing = this.queue.length > 0
        // Edge-triggered, so the main thread learns the moment speech actually finishes
        // rather than polling. `turnComplete` from the provider arrives while audio is
        // still draining, so this is what the UI needs to leave the speaking state.
        if (this.wasPlaying && !playing) {
            this.port.postMessage({ type: 'drained' })
        }
        this.wasPlaying = playing

        return true
    }
}

registerProcessor('voice-playback', PlaybackProcessor)
