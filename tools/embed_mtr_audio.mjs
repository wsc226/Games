#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const toolsDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(toolsDir,'..');
const manifestPath=path.join(root,'station_audio.json');
const htmlPath=path.join(root,'mtr.html');
const mp3Dir=path.join(root,'audio','mtr','stations-mp3');
const warningPath=path.join(root,'audio','mtr','mtr-beep.mp3');
const closingCantoPath=path.join(root,'audio','mtr','references','MTR-Canto.mp3');
const closingEnglishWavPath=path.join(root,'audio','mtr','closing','mtr-platform-screen-doors-english.wav');
const closingEnglishPath=path.join(root,'audio','mtr','closing','mtr-platform-screen-doors-english.mp3');
const startMarker='<!-- MTR_STATION_AUDIO_START -->';
const endMarker='<!-- MTR_STATION_AUDIO_END -->';

const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const stationEntries=Object.entries(manifest.stations||{});
if(stationEntries.length!==49){
  throw new Error(`Expected 49 stations; found ${stationEntries.length}.`);
}

fs.mkdirSync(mp3Dir,{recursive:true});
const embedded={version:1,format:'audio/mpeg',bitrate_kbps:64,stations:{}};
let clipCount=0;
let mp3Bytes=0;

for(const [station,entry] of stationEntries){
  embedded.stations[station]={};
  for(const language of ['cantonese','english']){
    const wavRelative=entry[language];
    if(!wavRelative)throw new Error(`${station} has no ${language} WAV path.`);
    const wavPath=path.join(root,wavRelative);
    if(!fs.existsSync(wavPath))throw new Error(`Missing WAV: ${wavRelative}`);

    const mp3Name=path.basename(wavRelative,'.wav')+'.mp3';
    const mp3Path=path.join(mp3Dir,mp3Name);
    const mustEncode=!fs.existsSync(mp3Path)||
      fs.statSync(mp3Path).mtimeMs<fs.statSync(wavPath).mtimeMs;

    if(mustEncode){
      const result=spawnSync('ffmpeg',[
        '-hide_banner','-loglevel','error','-y','-i',wavPath,
        '-vn','-map_metadata','-1','-ac','1','-ar','24000',
        '-c:a','libmp3lame','-b:a','64k',mp3Path,
      ],{stdio:'inherit'});
      if(result.error)throw result.error;
      if(result.status!==0)throw new Error(`ffmpeg failed for ${wavRelative}.`);
    }

    const mp3=fs.readFileSync(mp3Path);
    if(mp3.length===0)throw new Error(`Empty MP3: ${mp3Name}`);
    embedded.stations[station][language]=
      `data:audio/mpeg;base64,${mp3.toString('base64')}`;
    clipCount+=1;
    mp3Bytes+=mp3.length;
  }
}

if(clipCount!==98)throw new Error(`Expected 98 clips; embedded ${clipCount}.`);

const closingEnglishMustEncode=!fs.existsSync(closingEnglishPath)||
  fs.statSync(closingEnglishPath).mtimeMs<fs.statSync(closingEnglishWavPath).mtimeMs;
if(closingEnglishMustEncode){
  const result=spawnSync('ffmpeg',[
    '-hide_banner','-loglevel','error','-y','-i',closingEnglishWavPath,
    '-vn','-map_metadata','-1','-ac','1','-ar','24000',
    '-c:a','libmp3lame','-b:a','64k',closingEnglishPath,
  ],{stdio:'inherit'});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error('ffmpeg failed for the closing English announcement.');
}

let html=fs.readFileSync(htmlPath,'utf8');
function embedAudioElement(id,audioPath){
  const audio=fs.readFileSync(audioPath);
  if(audio.length===0)throw new Error(`${path.basename(audioPath)} is empty.`);
  const pattern=new RegExp(`(<audio id="${id}"[^>]*\\bsrc=")[^"]*("[^>]*><\\/audio>)`);
  if(!pattern.test(html))throw new Error(`The ${id} audio element is missing.`);
  html=html.replace(pattern,`$1data:audio/mpeg;base64,${audio.toString('base64')}$2`);
  return audio.length;
}
const warningBytes=embedAudioElement('warnAudio',warningPath);
const closingCantoBytes=embedAudioElement('closeCantoAudio',closingCantoPath);
const closingEnglishBytes=embedAudioElement('closeEnglishAudio',closingEnglishPath);

const start=html.indexOf(startMarker);
const end=html.indexOf(endMarker);
if(start<0||end<0||end<start)throw new Error('Audio embedding markers are missing.');

const block=[
  startMarker,
  `<script id="mtrStationAudio" type="application/json">${JSON.stringify(embedded)}</script>`,
  endMarker,
].join('\n');
const output=html.slice(0,start)+block+html.slice(end+endMarker.length);
fs.writeFileSync(htmlPath,output);

const mib=n=>(n/1048576).toFixed(2);
console.log(`Embedded ${clipCount} MP3 clips.`);
console.log(`Embedded closing sequence: ${((warningBytes+closingCantoBytes+closingEnglishBytes)/1024).toFixed(1)} KiB.`);
console.log(`MP3 payload: ${mib(mp3Bytes)} MiB.`);
console.log(`Standalone HTML: ${mib(Buffer.byteLength(output))} MiB.`);
