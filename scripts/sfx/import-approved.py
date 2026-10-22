#!/usr/bin/env python3
"""Rebuild selected ElevenLabs effects from preserved lossless masters; never fetch or play audio.
Usage: python3 scripts/sfx/import-approved.py
The source manifest records selected takes, prompts, generation IDs and measured footstep cuts.
"""
import argparse, array, hashlib, json, math, pathlib, subprocess, wave
ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCES = ROOT / 'references/audio/elevenlabs-sfx-2026-10-21'
OUT = ROOT / 'public/sfx'
RATE = 44100

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def read_mono(path):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', str(RATE), '-'])
    values = array.array('f'); values.frombytes(raw)
    if not values or not all(math.isfinite(v) for v in values): raise ValueError(f'Invalid audio: {path}')
    return list(values)

def stats(a):
    peak = max(abs(x) for x in a)
    rms = math.sqrt(sum(x*x for x in a)/len(a))
    return {'duration': len(a)/RATE, 'peakDbfs': 20*math.log10(max(peak,1e-12)), 'rmsDbfs': 20*math.log10(max(rms,1e-12))}

def write_wav(path, values):
    pcm = array.array('h', [round(max(-1, min(1, x))*32767) for x in values])
    with wave.open(str(path), 'wb') as w:
        w.setparams((1, 2, RATE, 0, 'NONE', 'not compressed')); w.writeframes(pcm.tobytes())

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--group', action='append', help='Rebuild only this group (repeatable); preserve other accepted runtime bytes.')
    args = parser.parse_args()
    manifest = json.loads((SOURCES/'manifest.json').read_text())
    runtime = json.loads((OUT/'manifest.json').read_text())
    runtime['licence'] = 'Mixed provenance: retained CC0 recordings and selected ElevenLabs-generated effects; see each file.'
    if args.group and set(args.group) - {s['group'] for s in manifest['sources']}:
        raise ValueError('Unknown selected source group')
    for source in manifest['sources']:
        if args.group and source['group'] not in args.group: continue
        path = SOURCES/source['file']
        if digest(path) != source['sha256']: raise ValueError(f'Source hash mismatch: {path}')
        if not source.get('generationId') or not source.get('prompt'): raise ValueError('Missing generation provenance')
        values = read_mono(path)
        cuts = source.get('cuts', [[0, len(values)/RATE]])
        if source['kind'] == 'footsteps' and len(cuts) != 4: raise ValueError('Exactly four measured footfalls required')
        for i, (start, end) in enumerate(cuts):
            if not 0 <= start < end <= len(values)/RATE + 1/RATE: raise ValueError('Invalid cut')
            a = values[round(start*RATE):round(end*RATE)]
            if source.get('fitSeconds'):
                duration = source['fitSeconds']
                tempo = len(a)/RATE/duration
                raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-af', f'atempo={tempo:.12f},apad=whole_dur={duration},atrim=duration={duration}', '-f', 'f32le', '-'], input=array.array('f', a).tobytes())
                fitted = array.array('f'); fitted.frombytes(raw); a = list(fitted)
            if source['kind'] == 'loop':
                # Join the last 150 ms to the first; no silent fade or encoder padding in a loop.
                n = round(.15*RATE)
                if len(a) < n*4: raise ValueError('Loop too short')
                blend = [a[-n+j]*(1-j/(n-1)) + a[j]*(j/(n-1)) for j in range(n)]
                a = a[n:-n] + blend
            else:
                n = min(round(.004*RATE), len(a)//4)
                tail = min(round(.025*RATE), len(a)//4)
                for j in range(n): a[j] *= j/max(1,n-1)
                for j in range(tail): a[-tail+j] *= 1-j/max(1,tail-1)
            peak = max(abs(v) for v in a)
            gain = 10**(source['peakDbfs']/20)/max(peak, 1e-12)
            a = [v*gain for v in a]
            name = f"{source['group']}-{i}"
            dest = OUT/(name+'.wav'); write_wav(dest, a)
            runtime['files'][name] = {'from': 'ElevenLabs Sound Effects v3, user-selected generated take',
                'licence': 'Generated with ElevenLabs; not CC0', 'source': str(path.relative_to(ROOT)),
                'generationId': source['generationId'], 'sourceSha256': source['sha256'],
                'cutSeconds': [start,end], 'fitSeconds': source.get('fitSeconds'), 'tempoRatio': ((end-start)/source['fitSeconds'] if source.get('fitSeconds') else None), 'timeStretch': ('ffmpeg atempo pitch-preserving; pad/trim to exact fitSeconds' if source.get('fitSeconds') else None), 'processing': 'mono 44.1 kHz PCM16; '+('150 ms loop join crossfade' if source['kind']=='loop' else '4 ms onset/25 ms tail edge fades'),
                'bytes': dest.stat().st_size, 'sha256': digest(dest), **stats(a)}
    (OUT/'manifest.json').write_text(json.dumps(runtime,indent=1)+'\n')

if __name__ == '__main__': main()
