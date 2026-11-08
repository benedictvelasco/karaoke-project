/**
 * scripts/generate-karaoke-tracks.js
 * Generates a full 20-song karaoke songbook with instrumental audio files (.mp3)
 * and Whisper-compatible word-level timestamp JSON files (/lyrics/song1.json .. song20.json),
 * plus a master catalog at /public/songs.json.
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050; // Fast generation & crisp playback

const NOTE_MAP = {
  C3: 130.81, D3: 146.83, Eb3: 155.56, E3: 164.81, F3: 174.61, 'F#3': 185.00, G3: 196.00, 'G#3': 207.65, A3: 220.00, Bb3: 233.08, B3: 246.94,
  C4: 261.63, D4: 293.66, Eb4: 311.13, E4: 329.63, F4: 349.23, 'F#4': 369.99, G4: 392.00, 'G#4': 415.30, A4: 440.00, Bb4: 466.16, B4: 493.88,
  C5: 523.25, D5: 587.33, Eb5: 622.25, E5: 659.25, F5: 698.46, G5: 783.99
};

const CHORDS = {
  C:  ['C3', 'E3', 'G3'],
  Cm: ['C3', 'Eb3', 'G3'],
  Dm: ['D3', 'F3', 'A3'],
  D:  ['D3', 'F#3', 'A3'],
  Em: ['E3', 'G3', 'B3'],
  E:  ['E3', 'G#3', 'B3'],
  F:  ['F3', 'A3', 'C4'],
  G:  ['G3', 'B3', 'D4'],
  Am: ['A3', 'C4', 'E4'],
  A:  ['A3', 'C#4', 'E4'],
  Bb: ['Bb3', 'D4', 'F4']
};

/**
 * Helper to convert compact lyric-note tuples: [word, noteName, beats, chordName]
 */
function expandEvents(tuples) {
  return tuples.map(([word, note, beats, chord]) => ({
    word,
    notes: [{ note, beats }],
    chord: CHORDS[chord] || CHORDS.C
  }));
}

const SONGS = [
  {
    id: 'song1',
    title: 'Twinkle, Twinkle, Little Star',
    artist: 'Traditional Classic',
    genre: 'Classic',
    bpm: 100,
    events: expandEvents([
      ['Twinkle,', 'C4', 2, 'C'], ['twinkle,', 'G4', 2, 'C'], ['little', 'A4', 2, 'F'], ['star,', 'G4', 2, 'C'],
      ['How', 'F4', 1, 'F'], ['I', 'F4', 1, 'F'], ['wonder', 'E4', 2, 'C'], ['what', 'D4', 1, 'G'], ['you', 'D4', 1, 'G'], ['are!', 'C4', 2, 'C'],
      ['Up', 'G4', 1, 'C'], ['above', 'G4', 1, 'C'], ['the', 'F4', 1, 'F'], ['world', 'F4', 1, 'F'], ['so', 'E4', 2, 'C'], ['high,', 'D4', 2, 'G'],
      ['Like', 'G4', 1, 'C'], ['a', 'G4', 1, 'C'], ['diamond', 'F4', 2, 'F'], ['in', 'E4', 1, 'C'], ['the', 'E4', 1, 'C'], ['sky.', 'D4', 2, 'G'],
      ['Twinkle,', 'C4', 2, 'C'], ['twinkle,', 'G4', 2, 'C'], ['little', 'A4', 2, 'F'], ['star,', 'G4', 2, 'C'],
      ['How', 'F4', 1, 'F'], ['I', 'F4', 1, 'F'], ['wonder', 'E4', 2, 'C'], ['what', 'D4', 1, 'G'], ['you', 'D4', 1, 'G'], ['are!', 'C4', 2, 'C']
    ])
  },
  {
    id: 'song2',
    title: 'House of the Rising Sun',
    artist: 'Traditional Folk Rock',
    genre: 'Rock',
    bpm: 112,
    events: expandEvents([
      ['There', 'A3', 1, 'Am'], ['is', 'A4', 2, 'Am'], ['a', 'B4', 1, 'C'], ['house', 'C5', 2, 'C'],
      ['in', 'E4', 1, 'D'], ['New', 'D4', 1, 'D'], ['Orleans,', 'A3', 3, 'F'],
      ['they', 'A4', 1, 'Am'], ['call', 'A4', 2, 'Am'], ['the', 'G4', 1, 'C'], ['Rising', 'E4', 2, 'E'], ['Sun,', 'E4', 3, 'E'],
      ['and', 'A4', 1, 'Am'], ['it', 'A4', 1, 'Am'], ['has', 'B4', 1, 'C'], ['been', 'C5', 2, 'C'],
      ['the', 'E4', 1, 'D'], ['ruin', 'D4', 2, 'D'], ['of', 'A3', 1, 'F'], ['many', 'C4', 2, 'F'],
      ['a', 'A3', 1, 'Am'], ['poor', 'E4', 2, 'E'], ['boy,', 'D4', 2, 'E'],
      ['and', 'C4', 1, 'Am'], ['God', 'A3', 1, 'Am'], ['I', 'E4', 1, 'E'], ['know', 'C4', 1, 'E'], ["I'm", 'B3', 1, 'E'], ['one!', 'A3', 3, 'Am']
    ])
  },
  {
    id: 'song3',
    title: 'Bella Ciao',
    artist: 'Traditional Italian Folk',
    genre: 'Party',
    bpm: 128,
    events: expandEvents([
      ['One', 'E4', 0.5, 'Am'], ['morning', 'A4', 1, 'Am'], ['I', 'C5', 0.5, 'Am'], ['woke', 'A4', 1, 'Am'], ['up,', 'A4', 1, 'Am'],
      ['oh', 'E4', 0.5, 'Am'], ['bella', 'A4', 1, 'Am'], ['ciao,', 'C5', 1.5, 'Am'],
      ['bella', 'E4', 1, 'Am'], ['ciao,', 'C5', 1.5, 'Am'],
      ['bella', 'B4', 1, 'E'], ['ciao,', 'C5', 1, 'Am'], ['ciao,', 'B4', 1, 'E'], ['ciao!', 'A4', 2, 'Am'],
      ['One', 'E5', 0.5, 'Dm'], ['morning', 'E5', 1, 'Dm'], ['I', 'E5', 0.5, 'Dm'], ['woke', 'F5', 1, 'Dm'], ['up', 'F5', 1, 'Dm'],
      ['and', 'F5', 0.5, 'Dm'], ['found', 'E5', 0.5, 'Am'], ['the', 'D5', 0.5, 'Am'], ['invader', 'E5', 1.5, 'E'], ['here!', 'A4', 2.5, 'Am']
    ])
  },
  {
    id: 'song4',
    title: 'Amazing Grace',
    artist: 'John Newton (Gospel Standard)',
    genre: 'Ballad',
    bpm: 90,
    events: expandEvents([
      ['Amazing', 'G3', 2, 'C'], ['grace,', 'C4', 2, 'C'], ['how', 'E4', 1, 'C'], ['sweet', 'C4', 1, 'C'], ['the', 'E4', 2, 'F'], ['sound,', 'D4', 3, 'G'],
      ['that', 'C4', 1, 'C'], ['saved', 'A3', 2, 'F'], ['a', 'G3', 1, 'C'], ['wretch', 'G3', 2, 'C'], ['like', 'C4', 1, 'G'], ['me!', 'C4', 3, 'C'],
      ['I', 'G4', 1, 'C'], ['once', 'E4', 2, 'C'], ['was', 'G4', 1, 'C'], ['lost,', 'E4', 2, 'F'], ['but', 'C4', 1, 'C'], ['now', 'G3', 2, 'Am'], ['am', 'A3', 1, 'Dm'], ['found,', 'C4', 2, 'G'],
      ['was', 'C4', 1, 'C'], ['blind,', 'E4', 2, 'C'], ['but', 'D4', 1, 'G'], ['now', 'C4', 2, 'G'], ['I', 'A3', 1, 'F'], ['see.', 'C4', 3, 'C']
    ])
  },
  {
    id: 'song5',
    title: 'You Are My Sunshine',
    artist: 'Traditional Country Pop',
    genre: 'Country',
    bpm: 115,
    events: expandEvents([
      ['You', 'G3', 1, 'C'], ['are', 'C4', 1, 'C'], ['my', 'D4', 1, 'C'], ['sunshine,', 'E4', 2, 'C'], ['my', 'E4', 1, 'C'], ['only', 'E4', 2, 'C'], ['sunshine,', 'E4', 2, 'C'],
      ['you', 'E4', 1, 'F'], ['make', 'F4', 1, 'F'], ['me', 'A4', 1, 'F'], ['happy', 'A4', 2, 'F'], ['when', 'G4', 1, 'C'], ['skies', 'F4', 1, 'C'], ['are', 'E4', 1, 'C'], ['gray.', 'C4', 2, 'C'],
      ["You'll", 'C4', 1, 'F'], ['never', 'F4', 2, 'F'], ['know,', 'A4', 1, 'F'], ['dear,', 'A4', 2, 'F'], ['how', 'G4', 1, 'C'], ['much', 'F4', 1, 'C'], ['I', 'E4', 1, 'C'], ['love', 'C4', 1, 'C'], ['you,', 'C4', 2, 'C'],
      ['please', 'C4', 1, 'G'], ["don't", 'D4', 1, 'G'], ['take', 'E4', 1, 'G'], ['my', 'F4', 1, 'G'], ['sunshine', 'D4', 2, 'G'], ['away!', 'C4', 3, 'C']
    ])
  },
  {
    id: 'song6',
    title: "Plaisir d'Amour (Can't Help Falling in Love Melody)",
    artist: 'Romantic Ballad Standard',
    genre: 'Ballad',
    bpm: 88,
    events: expandEvents([
      ['Wise', 'C4', 2, 'C'], ['men', 'G4', 2, 'Em'], ['say,', 'C4', 3, 'Am'],
      ['only', 'D4', 2, 'F'], ['fools', 'E4', 2, 'C'], ['rush', 'F4', 2, 'G'], ['in,', 'E4', 3, 'C'],
      ['but', 'F4', 1, 'F'], ['I', 'G4', 1, 'G'], ["can't", 'A4', 2, 'Am'], ['help', 'D4', 2, 'Dm'],
      ['falling', 'E4', 2, 'C'], ['in', 'F4', 1, 'G'], ['love', 'D4', 2, 'G'], ['with', 'C4', 1, 'C'], ['you.', 'C4', 3, 'C'],
      ['Shall', 'C4', 2, 'C'], ['I', 'G4', 2, 'Em'], ['stay?', 'C4', 3, 'Am'],
      ['Would', 'D4', 2, 'F'], ['it', 'E4', 1, 'C'], ['be', 'F4', 1, 'G'], ['a', 'E4', 1, 'C'], ['sin?', 'D4', 3, 'G']
    ])
  },
  {
    id: 'song7',
    title: 'Scarborough Fair',
    artist: 'Traditional English Folk',
    genre: 'Folk',
    bpm: 96,
    events: expandEvents([
      ['Are', 'D4', 2, 'Dm'], ['you', 'D4', 1, 'Dm'], ['going', 'A4', 2, 'Dm'], ['to', 'A4', 1, 'Dm'], ['Scarborough', 'E4', 2, 'C'], ['Fair?', 'D4', 3, 'Dm'],
      ['Parsley,', 'A4', 2, 'F'], ['sage,', 'C5', 2, 'C'], ['rosemary,', 'D5', 2, 'Dm'], ['and', 'C5', 1, 'C'], ['thyme,', 'A4', 3, 'Am'],
      ['remember', 'A4', 2, 'Dm'], ['me', 'C5', 1, 'F'], ['to', 'B4', 1, 'G'], ['one', 'A4', 1, 'Dm'], ['who', 'G4', 1, 'C'], ['lives', 'E4', 2, 'Am'], ['there,', 'D4', 3, 'Dm'],
      ['she', 'D4', 1, 'Dm'], ['once', 'A4', 2, 'C'], ['was', 'G4', 1, 'C'], ['a', 'F4', 1, 'Bb'], ['true', 'E4', 1, 'Am'], ['love', 'C4', 1, 'C'], ['of', 'D4', 1, 'Dm'], ['mine.', 'D4', 3, 'Dm']
    ])
  },
  {
    id: 'song8',
    title: 'When the Saints Go Marching In',
    artist: 'New Orleans Jazz Standard',
    genre: 'Jazz',
    bpm: 132,
    events: expandEvents([
      ['Oh,', 'C4', 1, 'C'], ['when', 'E4', 1, 'C'], ['the', 'F4', 1, 'C'], ['saints', 'G4', 3, 'C'],
      ['go', 'C4', 1, 'C'], ['marching', 'E4', 2, 'C'], ['in,', 'G4', 3, 'G'],
      ['oh,', 'C4', 1, 'C'], ['when', 'E4', 1, 'C'], ['the', 'F4', 1, 'C'], ['saints', 'G4', 2, 'F'],
      ['go', 'E4', 2, 'C'], ['marching', 'C4', 2, 'Am'], ['in,', 'E4', 2, 'D'], ['oh', 'D4', 2, 'G'],
      ['Lord,', 'E4', 1, 'C'], ['I', 'E4', 1, 'C'], ['want', 'D4', 1, 'C'], ['to', 'C4', 2, 'C'], ['be', 'E4', 1, 'F'], ['in', 'G4', 1, 'F'], ['that', 'G4', 1, 'F'], ['number,', 'F4', 3, 'F'],
      ['when', 'F4', 1, 'C'], ['the', 'E4', 1, 'C'], ['saints', 'G4', 2, 'G'], ['go', 'E4', 1, 'G'], ['marching', 'D4', 2, 'G'], ['in!', 'C4', 3, 'C']
    ])
  },
  {
    id: 'song9',
    title: 'Greensleeves',
    artist: 'Traditional English Ballad',
    genre: 'Ballad',
    bpm: 95,
    events: expandEvents([
      ['Alas,', 'A3', 1, 'Am'], ['my', 'C4', 2, 'Am'], ['love,', 'D4', 1, 'Am'], ['you', 'E4', 2, 'C'], ['do', 'F4', 1, 'C'], ['me', 'E4', 1, 'G'], ['wrong,', 'D4', 2, 'G'],
      ['to', 'B3', 1, 'G'], ['cast', 'G3', 2, 'Em'], ['me', 'A3', 1, 'Am'], ['off', 'B3', 1, 'E'], ['discourteously,', 'C4', 3, 'Am'],
      ['for', 'A3', 1, 'Am'], ['I', 'C4', 2, 'Am'], ['have', 'D4', 1, 'Am'], ['loved', 'E4', 2, 'C'], ['you', 'F4', 1, 'C'], ['well', 'E4', 1, 'G'], ['and', 'D4', 1, 'G'], ['long,', 'B3', 2, 'G'],
      ['delighting', 'G3', 2, 'Em'], ['in', 'A3', 1, 'E'], ['your', 'B3', 1, 'E'], ['company.', 'A3', 3, 'Am'],
      ['Greensleeves', 'G4', 3, 'C'], ['was', 'F4', 1, 'C'], ['all', 'E4', 2, 'G'], ['my', 'D4', 1, 'G'], ['joy!', 'B3', 3, 'G']
    ])
  },
  {
    id: 'song10',
    title: 'Auld Lang Syne',
    artist: 'Robert Burns (Party Anthem)',
    genre: 'Party',
    bpm: 104,
    events: expandEvents([
      ['Should', 'C4', 1, 'F'], ['auld', 'F4', 2, 'F'], ['acquaintance', 'F4', 2, 'F'], ['be', 'A4', 1, 'F'], ['forgot,', 'G4', 2, 'C'],
      ['and', 'F4', 1, 'C'], ['never', 'G4', 2, 'C'], ['brought', 'A4', 1, 'F'], ['to', 'F4', 1, 'F'], ['mind?', 'F4', 2, 'Bb'],
      ['Should', 'A4', 1, 'F'], ['auld', 'C5', 2, 'Dm'], ['acquaintance', 'D5', 2, 'Bb'], ['be', 'D5', 1, 'Bb'], ['forgot,', 'C5', 2, 'F'],
      ['and', 'A4', 1, 'C'], ['auld', 'A4', 1, 'C'], ['lang', 'F4', 1, 'F'], ['syne!', 'G4', 3, 'F'],
      ['For', 'D5', 1, 'Bb'], ['auld', 'C5', 2, 'F'], ['lang', 'A4', 2, 'C'], ['syne,', 'A4', 1, 'F'], ['my', 'F4', 1, 'Dm'], ['dear,', 'G4', 2, 'C'],
      ['we', 'A4', 1, 'Bb'], ['will', 'C5', 1, 'C'], ['take', 'A4', 1, 'F'], ['a', 'F4', 1, 'F'], ['cup', 'F4', 1, 'Bb'], ['of', 'D4', 1, 'C'], ['kindness', 'F4', 2, 'F'], ['yet!', 'F4', 3, 'F']
    ])
  },
  {
    id: 'song11',
    title: 'Oh! Susanna',
    artist: 'Stephen Foster',
    genre: 'Country',
    bpm: 124,
    events: expandEvents([
      ['I', 'C4', 0.5, 'C'], ['come', 'D4', 0.5, 'C'], ['from', 'E4', 1, 'C'], ['Alabama', 'G4', 2, 'C'], ['with', 'A4', 1, 'F'], ['my', 'G4', 1, 'C'], ['banjo', 'E4', 1.5, 'C'], ['on', 'C4', 0.5, 'C'], ['my', 'D4', 1, 'G'], ['knee,', 'E4', 2, 'C'],
      ["I'm", 'C4', 0.5, 'C'], ['going', 'D4', 1, 'C'], ['to', 'E4', 0.5, 'C'], ['Louisiana,', 'G4', 2, 'C'], ['my', 'A4', 1, 'F'], ['true', 'G4', 1, 'C'], ['love', 'E4', 1, 'G'], ['for', 'D4', 1, 'G'], ['to', 'E4', 1, 'C'], ['see!', 'C4', 2, 'C'],
      ['Oh!', 'F4', 2, 'F'], ['Susanna,', 'F4', 2, 'F'], ['oh', 'A4', 1, 'F'], ["don't", 'A4', 1, 'F'], ['you', 'A4', 1, 'C'], ['cry', 'G4', 1, 'C'], ['for', 'G4', 1, 'G'], ['me,', 'E4', 2, 'C'],
      ['for', 'C4', 1, 'C'], ['I', 'D4', 1, 'C'], ['come', 'E4', 1, 'C'], ['from', 'G4', 1, 'C'], ['Alabama', 'A4', 2, 'F'], ['with', 'G4', 1, 'C'], ['my', 'E4', 1, 'G'], ['banjo', 'D4', 1.5, 'G'], ['on', 'E4', 0.5, 'C'], ['my', 'D4', 1, 'G'], ['knee!', 'C4', 2.5, 'C']
    ])
  },
  {
    id: 'song12',
    title: 'Danny Boy (Londonderry Air)',
    artist: 'Traditional Irish Ballad',
    genre: 'Ballad',
    bpm: 86,
    events: expandEvents([
      ['Oh,', 'B3', 1, 'C'], ['Danny', 'C4', 2, 'C'], ['boy,', 'D4', 1, 'C'], ['the', 'E4', 2, 'C'], ['pipes,', 'D4', 1, 'G'], ['the', 'E4', 1, 'C'], ['pipes', 'A4', 2, 'F'], ['are', 'G4', 1, 'C'], ['calling,', 'E4', 2, 'Am'],
      ['from', 'C4', 1, 'Dm'], ['glen', 'E4', 1, 'G'], ['to', 'D4', 1, 'G'], ['glen,', 'B3', 2, 'G'], ['and', 'D4', 1, 'G'], ['down', 'C4', 2, 'C'], ['the', 'A3', 1, 'Am'], ['mountain', 'C4', 2, 'Dm'], ['side.', 'D4', 3, 'G'],
      ['The', 'B3', 1, 'C'], ["summer's", 'C4', 2, 'C'], ['gone,', 'D4', 1, 'C'], ['and', 'E4', 2, 'C'], ['all', 'D4', 1, 'G'], ['the', 'E4', 1, 'C'], ['roses', 'A4', 2, 'F'], ['falling,', 'G4', 2, 'C'],
      ["it's", 'E4', 1, 'C'], ['you,', 'G4', 1, 'G'], ["it's", 'F4', 1, 'G'], ['you', 'E4', 1, 'C'], ['must', 'D4', 1, 'G'], ['go', 'C4', 1, 'Am'], ['and', 'D4', 1, 'G'], ['I', 'E4', 1, 'G'], ['must', 'D4', 1, 'G'], ['bide.', 'C4', 3, 'C']
    ])
  },
  {
    id: 'song13',
    title: 'Swing Low, Sweet Chariot',
    artist: 'Wallis Willis (Soul Standard)',
    genre: 'Jazz',
    bpm: 98,
    events: expandEvents([
      ['Swing', 'A4', 2, 'F'], ['low,', 'F4', 2, 'F'], ['sweet', 'A4', 1, 'F'], ['chariot,', 'F4', 3, 'F'],
      ['coming', 'F4', 1.5, 'F'], ['for', 'D4', 0.5, 'Dm'], ['to', 'C4', 1, 'C'], ['carry', 'F4', 1.5, 'F'], ['me', 'F4', 0.5, 'C'], ['home,', 'G4', 3, 'C'],
      ['swing', 'A4', 2, 'F'], ['low,', 'C5', 2, 'Bb'], ['sweet', 'A4', 1, 'F'], ['chariot,', 'F4', 3, 'F'],
      ['coming', 'A4', 1.5, 'C'], ['for', 'G4', 0.5, 'C'], ['to', 'F4', 1, 'C'], ['carry', 'G4', 1.5, 'C'], ['me', 'A4', 0.5, 'F'], ['home!', 'F4', 3, 'F']
    ])
  },
  {
    id: 'song14',
    title: 'La Cucaracha',
    artist: 'Traditional Fiesta Folk',
    genre: 'Party',
    bpm: 130,
    events: expandEvents([
      ['La', 'C4', 0.5, 'F'], ['cucaracha,', 'F4', 2, 'F'], ['la', 'C4', 0.5, 'F'], ['cucaracha,', 'F4', 2, 'F'],
      ['ya', 'F4', 1, 'F'], ['no', 'A4', 1, 'F'], ['puede', 'F4', 1.5, 'C'], ['caminar,', 'E4', 2.5, 'C'],
      ['porque', 'E4', 1, 'C'], ['no', 'G4', 1, 'C'], ['tiene,', 'E4', 2, 'C'],
      ['porque', 'E4', 1, 'C'], ['le', 'G4', 1, 'C'], ['falta', 'E4', 2, 'C'],
      ['las', 'C5', 1, 'C'], ['dos', 'Bb4', 1, 'C'], ['patitas', 'A4', 1.5, 'F'], ['de', 'G4', 0.5, 'C'], ['atrás!', 'F4', 3, 'F']
    ])
  },
  {
    id: 'song15',
    title: 'Home on the Range',
    artist: 'Western Classic',
    genre: 'Country',
    bpm: 100,
    events: expandEvents([
      ['Oh,', 'C4', 1, 'F'], ['give', 'C4', 1, 'F'], ['me', 'F4', 1, 'F'], ['a', 'G4', 1, 'F'], ['home', 'A4', 2, 'F'],
      ['where', 'F4', 1, 'Dm'], ['the', 'E4', 1, 'Bb'], ['buffalo', 'D4', 2, 'Bb'], ['roam,', 'Bb4', 2, 'Bb'],
      ['where', 'Bb4', 1, 'Bb'], ['the', 'Bb4', 1, 'Bb'], ['deer', 'A4', 1, 'F'], ['and', 'Bb4', 1, 'F'], ['the', 'C5', 1, 'C'], ['antelope', 'G4', 2, 'C'], ['play,', 'G4', 2, 'C'],
      ['where', 'C4', 1, 'F'], ['seldom', 'F4', 2, 'F'], ['is', 'G4', 1, 'F'], ['heard', 'A4', 2, 'F'],
      ['a', 'F4', 1, 'Bb'], ['discouraging', 'D4', 2, 'Bb'], ['word,', 'C5', 2, 'F'],
      ['and', 'A4', 1, 'C'], ['the', 'G4', 1, 'C'], ['skies', 'F4', 1, 'F'], ['are', 'E4', 1, 'C'], ['not', 'F4', 1, 'C'], ['cloudy', 'G4', 1.5, 'C'], ['all', 'F4', 0.5, 'F'], ['day!', 'F4', 3, 'F']
    ])
  },
  {
    id: 'song16',
    title: 'Korobeiniki (Dance of the Peddlers)',
    artist: 'Traditional Upbeat Folk',
    genre: 'Party',
    bpm: 136,
    events: expandEvents([
      ['Night', 'E5', 1, 'E'], ['is', 'B4', 0.5, 'E'], ['falling,', 'C5', 1, 'E'], ['stars', 'D5', 1, 'E'], ['are', 'C5', 0.5, 'E'], ['calling,', 'B4', 0.5, 'E'],
      ['step', 'A4', 1, 'Am'], ['into', 'A4', 1, 'Am'], ['the', 'C5', 0.5, 'Am'], ['spinning', 'E5', 1.5, 'Am'], ['floor,', 'D5', 1, 'Dm'],
      ['every', 'C5', 0.5, 'Am'], ['dancer', 'B4', 1.5, 'E'], ['moves', 'C5', 0.5, 'E'], ['together,', 'D5', 1, 'E'],
      ['singing', 'E5', 1, 'Am'], ['loud', 'C5', 1, 'Am'], ['forevermore!', 'A4', 2.5, 'Am'],
      ['Higher,', 'D5', 1.5, 'Dm'], ['faster', 'F5', 1, 'Dm'], ['through', 'A4', 0.5, 'Dm'], ['the', 'G5', 1, 'G'], ['fire,', 'F5', 1, 'G'],
      ['hear', 'E5', 1.5, 'C'], ['the', 'C5', 0.5, 'C'], ['balalaika', 'E5', 1.5, 'E'], ['roar!', 'A4', 2.5, 'Am']
    ])
  },
  {
    id: 'song17',
    title: 'Oh My Darling, Clementine',
    artist: 'Percy Montrose (Singalong)',
    genre: 'Folk',
    bpm: 108,
    events: expandEvents([
      ['Oh', 'F4', 1, 'F'], ['my', 'F4', 1, 'F'], ['darling,', 'F4', 2, 'F'], ['oh', 'C4', 1, 'F'], ['my', 'A4', 1, 'F'], ['darling,', 'A4', 2, 'F'],
      ['oh', 'A4', 1, 'C'], ['my', 'G4', 1, 'C'], ['darling,', 'F4', 1, 'F'], ['Clementine!', 'G4', 3, 'C'],
      ['You', 'G4', 1, 'C'], ['are', 'A4', 1, 'C'], ['lost', 'Bb4', 2, 'Bb'], ['and', 'Bb4', 1, 'Bb'], ['gone', 'A4', 1, 'F'], ['forever,', 'G4', 2, 'C'],
      ['dreadful', 'A4', 2, 'F'], ['sorry,', 'G4', 1.5, 'C'], ['Clementine!', 'F4', 3, 'F']
    ])
  },
  {
    id: 'song18',
    title: "She'll Be Coming 'Round the Mountain",
    artist: 'Traditional Party Singalong',
    genre: 'Party',
    bpm: 128,
    events: expandEvents([
      ["She'll", 'C4', 0.5, 'F'], ['be', 'D4', 0.5, 'F'], ['coming', 'F4', 1.5, 'F'], ["'round", 'F4', 0.5, 'F'], ['the', 'F4', 1, 'F'], ['mountain', 'G4', 1.5, 'F'], ['when', 'A4', 0.5, 'F'], ['she', 'F4', 1, 'F'], ['comes,', 'F4', 2, 'F'],
      ["she'll", 'G4', 0.5, 'C'], ['be', 'A4', 0.5, 'C'], ['coming', 'C5', 1.5, 'C'], ["'round", 'C5', 0.5, 'C'], ['the', 'C5', 1, 'C'], ['mountain', 'D5', 1.5, 'C'], ['when', 'C5', 0.5, 'C'], ['she', 'A4', 1, 'F'], ['comes,', 'G4', 2, 'C'],
      ["she'll", 'C5', 0.5, 'F'], ['be', 'D5', 0.5, 'F'], ['coming', 'C5', 1.5, 'F'], ["'round", 'A4', 0.5, 'F'], ['the', 'F4', 1, 'F'], ['mountain,', 'A4', 2, 'Bb'],
      ["she'll", 'G4', 0.5, 'Bb'], ['be', 'F4', 0.5, 'Bb'], ['coming', 'D4', 1.5, 'Bb'], ["'round", 'F4', 0.5, 'F'], ['the', 'G4', 1, 'C'], ['mountain,', 'A4', 1.5, 'C'],
      ["she'll", 'F4', 0.5, 'F'], ['be', 'G4', 0.5, 'C'], ['coming', 'A4', 1, 'C'], ["'round", 'G4', 1, 'C'], ['the', 'E4', 1, 'C'], ['mountain', 'D4', 1, 'G'], ['when', 'C4', 1, 'C'], ['she', 'D4', 1, 'C'], ['comes!', 'F4', 2.5, 'F']
    ])
  },
  {
    id: 'song19',
    title: 'Drunken Sailor',
    artist: 'Traditional Sea Shanty',
    genre: 'Rock',
    bpm: 132,
    events: expandEvents([
      ['What', 'A4', 1, 'Dm'], ['shall', 'A4', 0.5, 'Dm'], ['we', 'A4', 0.5, 'Dm'], ['do', 'A4', 1, 'Dm'], ['with', 'A4', 0.5, 'Dm'], ['a', 'A4', 0.5, 'Dm'], ['drunken', 'D4', 1, 'Dm'], ['sailor,', 'F4', 1.5, 'Dm'],
      ['what', 'G4', 1, 'C'], ['shall', 'G4', 0.5, 'C'], ['we', 'G4', 0.5, 'C'], ['do', 'G4', 1, 'C'], ['with', 'G4', 0.5, 'C'], ['a', 'G4', 0.5, 'C'], ['drunken', 'C4', 1, 'C'], ['sailor,', 'E4', 1.5, 'C'],
      ['what', 'A4', 1, 'Dm'], ['shall', 'A4', 0.5, 'Dm'], ['we', 'A4', 0.5, 'Dm'], ['do', 'A4', 1, 'Dm'], ['with', 'B4', 1, 'G'], ['a', 'C5', 1, 'C'], ['drunken', 'D5', 1, 'Bb'], ['sailor,', 'C5', 1, 'C'],
      ['early', 'A4', 1, 'Dm'], ['in', 'G4', 1, 'C'], ['the', 'E4', 1, 'Am'], ['morning?', 'D4', 2.5, 'Dm'],
      ['Way,', 'A4', 2, 'Dm'], ['hay,', 'A4', 1, 'Dm'], ['and', 'D4', 0.5, 'Dm'], ['up', 'F4', 0.5, 'Dm'], ['she', 'A4', 1, 'Dm'], ['rises,', 'F4', 2, 'Dm'],
      ['early', 'A4', 1, 'Dm'], ['in', 'G4', 1, 'C'], ['the', 'E4', 1, 'Am'], ['morning!', 'D4', 2.5, 'Dm']
    ])
  },
  {
    id: 'song20',
    title: 'Ode to Joy (Singalong Anthem)',
    artist: 'Ludwig van Beethoven',
    genre: 'Classic',
    bpm: 116,
    events: expandEvents([
      ['Joyful,', 'E4', 2, 'C'], ['joyful,', 'F4', 2, 'C'], ['we', 'G4', 1, 'G'], ['adore', 'G4', 1, 'G'], ['thee,', 'F4', 1, 'F'], ['hearts', 'E4', 1, 'C'], ['unfold', 'D4', 2, 'G'], ['like', 'C4', 1, 'C'], ['flowers', 'C4', 1, 'C'], ['before', 'D4', 1, 'G'], ['thee,', 'E4', 2, 'C'],
      ['shining', 'E4', 1.5, 'C'], ['bright', 'D4', 0.5, 'G'], ['above', 'D4', 2, 'G'], ['the', 'E4', 1, 'C'], ['night,', 'E4', 1, 'C'],
      ['fill', 'F4', 1, 'F'], ['us', 'G4', 1, 'G'], ['with', 'G4', 1, 'G'], ['immortal', 'F4', 1.5, 'F'], ['light,', 'E4', 1.5, 'C'],
      ['every', 'D4', 1, 'G'], ['voice', 'C4', 1, 'C'], ['in', 'C4', 1, 'C'], ['harmony', 'D4', 1.5, 'G'], ['sings', 'E4', 1, 'C'], ['forever', 'D4', 1.5, 'G'], ['free!', 'C4', 3, 'C']
    ])
  }
];

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function buildSongAudioAndLyrics(songDef) {
  const beatSec = 60 / songDef.bpm;
  const introBeats = 4;
  let currentTime = introBeats * beatSec;

  const lyricsJson = [];
  const scheduledNotes = [];

  for (let b = 0; b < introBeats; b++) {
    scheduledNotes.push({
      start: b * beatSec,
      end: b * beatSec + 0.14,
      freq: b === 0 ? 880 : 440,
      chordFreqs: [NOTE_MAP.C3, NOTE_MAP.E3, NOTE_MAP.G3],
      isCountIn: true
    });
  }

  for (const ev of songDef.events) {
    const wordStart = currentTime;
    const chordFreqs = ev.chord.map((n) => NOTE_MAP[n] || 220);

    for (const n of ev.notes) {
      const noteDur = n.beats * beatSec;
      scheduledNotes.push({
        start: currentTime,
        end: currentTime + noteDur,
        freq: NOTE_MAP[n.note] || 440,
        chordFreqs
      });
      currentTime += noteDur;
    }

    const wordEnd = currentTime;
    lyricsJson.push({
      word: ev.word,
      start_time: Number(wordStart.toFixed(2)),
      end_time: Number((wordEnd - 0.02).toFixed(2))
    });
  }

  const totalDuration = Math.ceil(currentTime + 1.5);
  const numSamples = Math.floor(totalDuration * SAMPLE_RATE);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  const samples = new Float32Array(numSamples);

  for (const item of scheduledNotes) {
    const startIdx = Math.floor(item.start * SAMPLE_RATE);
    const endIdx = Math.min(numSamples, Math.floor(item.end * SAMPLE_RATE));
    const len = endIdx - startIdx;

    for (let i = 0; i < len; i++) {
      const t = (startIdx + i) / SAMPLE_RATE;
      const localT = i / SAMPLE_RATE;
      const dur = item.end - item.start;

      const attack = Math.min(1, localT / 0.02);
      const release = Math.min(1, (dur - localT) / 0.05);
      const env = attack * release;

      const lead =
        (Math.sin(2 * Math.PI * item.freq * t) +
          0.35 * Math.sin(2 * Math.PI * item.freq * 2 * t)) *
        (item.isCountIn ? 0.24 : 0.32) *
        env;

      const [c1, c2, c3] = item.chordFreqs;
      const chordPad =
        ((Math.sin(2 * Math.PI * c1 * t) +
          Math.sin(2 * Math.PI * c2 * t) +
          Math.sin(2 * Math.PI * c3 * t)) /
          3) *
        0.18 *
        env;
      const bass = Math.sin(2 * Math.PI * (c1 * 0.5) * t) * 0.16 * env;

      samples[startIdx + i] += lead + chordPad + bass;
    }
  }

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(clamped * 32767), 44 + i * 2);
  }

  return { buffer, lyricsJson, totalDuration };
}

const audioDir = path.join(__dirname, '..', 'public', 'audio');
const lyricsDir = path.join(__dirname, '..', 'public', 'lyrics');
fs.mkdirSync(audioDir, { recursive: true });
fs.mkdirSync(lyricsDir, { recursive: true });

const catalog = [];

for (const song of SONGS) {
  const { buffer, lyricsJson, totalDuration } = buildSongAudioAndLyrics(song);
  const mp3Path = path.join(audioDir, `${song.id}.mp3`);
  const jsonPath = path.join(lyricsDir, `${song.id}.json`);

  fs.writeFileSync(mp3Path, buffer);
  fs.writeFileSync(jsonPath, JSON.stringify(lyricsJson, null, 2) + '\n');

  catalog.push({
    id: song.id,
    title: song.title,
    artist: song.artist,
    genre: song.genre,
    duration: formatDuration(totalDuration),
    bpm: song.bpm,
    audioUrl: `/audio/${song.id}.mp3`,
    lyricsUrl: `/lyrics/${song.id}.json`
  });
}

const catalogPath = path.join(__dirname, '..', 'public', 'songs.json');
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
console.log(`Successfully generated ${catalog.length} karaoke songs and saved catalog to ${catalogPath}`);
