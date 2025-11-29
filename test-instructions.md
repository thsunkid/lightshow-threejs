# Testing the Lightshow Generator

## Application is now running at http://localhost:3001/

## What's been fixed:

1. **AudioAnalyzer Integration**: The app now properly creates and uses the AudioAnalyzer when an audio file is loaded.

2. **Audio Playback**: When you click Play, the audio will actually play through your speakers.

3. **Real-time Light Mapping**: The AudioAnalyzer processes audio frames in real-time and sends them through the MappingEngine to generate lighting commands.

4. **Play/Pause/Stop Controls**: These buttons now actually control the audio playback.

5. **Time Display**: A timer showing current/total time has been added to the controls.

## How the flow works:

1. User drops audio file → AudioAnalyzer loads it
2. User clicks Play → Audio starts playing
3. AudioAnalyzer emits frames (~60fps) with audio features
4. Each frame is processed: `MappingEngine.process(frame)` → `LightingCommand[]`
5. Commands are executed on Stage: `Stage.executeCommands(commands)`
6. Lights react to the music!

## Testing steps:

1. Open http://localhost:3001/ in your browser
2. Drop an MP3 or WAV file onto the drop zone (or click to browse)
3. Click Play button - you should hear audio AND see lights reacting
4. Try Pause - audio and lights should freeze
5. Try Stop - audio stops and lights reset to off

## What to expect:

- **Intensity**: Follows the audio RMS (loudness)
- **Colors**: Change based on spectral content
- **Beat detection**: Lights pulse on beats
- **Moving heads**: Tilt based on bass energy
- **Color shifts**: Change on downbeats
- **Section awareness**: Different patterns for verse/chorus/drop

## Sample test file:

If you need a test file, there are some WAV files in:
`node_modules/wav/test/fixtures/gameover.wav`

## Debug info:

- Open browser console to see logs
- The Stage object is available as `window.stage` for debugging
- Check console for "Playing...", "Paused", "Stopped" messages

## Current audio flow:
```
Audio File → AudioAnalyzer → AudioFrame → MappingEngine → LightingCommands → Stage → 3D Visuals
```

The lights should now react to your music in real-time!