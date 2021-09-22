// Common global state to tests:
var context = new (window.AudioContext || window.webkitAudioContext)();
var stopPreviousSource = () => {};
var currentUrl = '';
var sizeOnDisk = 0;


function download(url, responseType) {
  currentUrl = url;
  return new Promise((resolve, reject) => {
    var request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = responseType;
    request.onload = () => {
      console.log('Downloaded ' + url);
      resolve(request.response)
    };
    request.send();
  });
}

function expectedSamplingRateOfCurrentClip() {
  return parseInt(currentUrl.match('([0-9]+)hz')[1]);
}

function uncompress(audio) {
  return new Promise((resolve, reject) => {
    var uncompressTimeStart = performance.now();
    function onDecode(uncompressed) {
      var timeTakenToDecode = performance.now() - uncompressTimeStart;
      if (timeTakenToDecode > 200) reportError('This method for playing back audio requires a lot of CPU processing power (' + timeTakenToDecode.toFixed(2) + ' msecs) to decode the file.');
      if (uncompressed.sampleRate != expectedSamplingRateOfCurrentClip()) {
        reportError('This method of playing back audio is not good, because the sampling rate of the input file was not preserved. Expected: ' + expectedSamplingRateOfCurrentClip() + 'Hz, got ' + uncompressed.sampleRate + 'Hz.');
      }
      console.log('Uncompressed audio clip');
      resolve(uncompressed);
    }
    function onError(e) {
      console.error(e);
      reportError('Uncompressing audio failed: ' + e);
    }
    // This is the old form of .decodeAudioData() call. New form returns a Promise, but Safari does not implement the new API.
    context.decodeAudioData(audio, onDecode, onError);
  });
}

function size(obj) {
  if (obj instanceof AudioBuffer) return obj.length * obj.numberOfChannels * 4;
  else return obj.byteLength || obj.size;
}

function reportDiskSizeUsage(id, data) {
  sizeOnDisk = size(data);
  document.getElementById(id).innerHTML = 'Size on disk: ' + size(data) + ' bytes';
  }

function reportMemoryUsage(data) {
  document.getElementById('memory').innerHTML = size(data);
  document.getElementById('memory').style.color = document.getElementById('result').style.color = (size(data) > sizeOnDisk) ? 'red' : 'green';
  if (size(data) > sizeOnDisk) document.getElementById('result').innerHTML += 'This method for playing back audio is not reasonable, since it consumes ' + (size(data) - sizeOnDisk) + ' bytes of extra memory (' + (size(data)/sizeOnDisk).toFixed(2) +'x) compared to the actual size of the audio clip on disk.';
  else document.getElementById('result').innerHTML += 'This method for playing back audio is good memory-wise, since memory usage is the same as the size on disk. The audio clip should loop seamlessly.';
}

function reportError(e) {
  document.getElementById('result').innerHTML += '<div style="color:red;">' + e + '</div>';
  console.error(e);
}
function clearReport() {
  sizeOnDisk = 0;
  document.getElementById('memory').innerHTML = '0';
  document.getElementById('result').innerHTML = '';
  delete document.getElementById('result').style.color;
}

function playUncompressed(buffer) {
  console.log('playUncompressed');
  var source = context.createBufferSource();
  source.connect(context.destination);
  source.buffer = buffer;

  if (options.loop) source.loop = options.loop;
  if (options.loopStart) source.loopStart = options.loopStart;
  if (options.loopEnd) source.loopEnd = options.loopEnd;
  if (options.logText) {
    document.getElementById('result').innerHTML += '<div>' + options.logText + '</div>';
  }
  source.start(0);
  reportMemoryUsage(buffer);
  stopPreviousSource = () => { clearReport(); source.stop(); source.disconnect(); }
}

function playCompressed(blob) {
  console.log('playCompressed');
  var url = URL.createObjectURL(blob);
  var audio = document.createElement('audio');
  audio.src = url;
  if (options.loop !== undefined) audio.loop = options.loop;
  var source = context.createMediaElementSource(audio);
  source.connect(context.destination);
  audio.play().then(() => {
    console.log('audio playback started');
    reportMemoryUsage(blob);
  }).catch(e => { reportError('Audio element .play() method failed: ' + e); });
  stopPreviousSource = () => { clearReport(); audio.pause(); source.disconnect(); URL.revokeObjectURL(url); }
}

function playClipUncompressed(i) {
  console.log('playClipUncompressed');
  context.resume();
  stopPreviousSource();
  download(urls[i], 'arraybuffer').then((data) => {
    console.log('Playing ' + urls[i] + ' uncompressed');
    reportDiskSizeUsage('uncompressed_size_' + i, data);
    return uncompress(data);
  }).then(playUncompressed);
}

function playClipCompressed(i) {
  console.log('playClipCompressed');
  context.resume();
  stopPreviousSource();
  download(urls[i], 'blob').then((data) => {
    console.log('Playing ' + urls[i] + ' compressed');
    reportDiskSizeUsage('compressed_size_' + i, data);
    return playCompressed(data);
  });
}
