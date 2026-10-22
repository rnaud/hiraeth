#!/usr/bin/env python3
"""Rebuild only user-starred NEXT action WAVs; no downloads or playback."""
import array, importlib.util, json, math, pathlib, subprocess
ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('approved', pathlib.Path(__file__).with_name('import-approved.py'))
A = importlib.util.module_from_spec(spec); spec.loader.exec_module(A)
SOURCES = ROOT/'references/audio/elevenlabs-next-2026-10-22'

def main():
    selected = json.loads((SOURCES/'manifest.json').read_text())
    runtime = json.loads((A.OUT/'manifest.json').read_text())
    for s in selected['sources']:
        p = SOURCES/s['file']
        if A.digest(p) != s['sha256']: raise ValueError('Selected source hash mismatch: '+str(p))
        a = A.read_mono(p)
        fit = s.get('fitSeconds')
        if fit:
            ratio = len(a)/A.RATE/fit
            raw = subprocess.check_output(['ffmpeg','-v','error','-f','f32le','-ar',str(A.RATE),'-ac','1','-i','-','-af',f'atempo={ratio:.12f},apad=whole_dur={fit},atrim=duration={fit}','-f','f32le','-'],input=array.array('f',a).tobytes())
            v = array.array('f');v.frombytes(raw);a=list(v)
        # These are finite action phrases. Even the selected running breath is
        # played once after sustained running, never as an idle or looping bed.
        onset,tail=round(.004*A.RATE),round(.025*A.RATE)
        for j in range(min(onset,len(a))):a[j]*=j/max(1,onset-1)
        for j in range(min(tail,len(a))):a[-1-j]*=j/max(1,tail-1)
        peak=max(abs(x) for x in a)
        if peak < 1e-7:raise ValueError('Silent selected source: '+str(p))
        gain=10**(s['peakDbfs']/20)/peak;a=[x*gain for x in a]
        name=f"{s['group']}-{s['index']}";dest=A.OUT/(name+'.wav');A.write_wav(dest,a)
        runtime['files'][name]={'from':'ElevenLabs Sound Effects v3, user-starred take','licence':'Generated with ElevenLabs; not CC0','source':str(p.relative_to(ROOT)),'generationId':s['generationId'],'sourceSha256':s['sha256'],'selectedTake':s['selectedTake'],'cutSeconds':[0,s['sourceDuration']],'fitSeconds':fit,'timeStretch':'ffmpeg atempo, pitch preserving' if fit else None,'processing':'mono 44.1 kHz PCM16; 4 ms onset/25 ms tail fades; peak-normalized; finite one-shot','bytes':dest.stat().st_size,'sha256':A.digest(dest),**A.stats(a)}
    (A.OUT/'manifest.json').write_text(json.dumps(runtime,indent=1)+'\n')
if __name__=='__main__':main()
