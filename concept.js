#!/usr/bin/env node
//

var fs = require('fs')
var pty = require('pty.js')
var util = require('util')
var split = require('split')
var keypress = require('keypress')

var script = process.argv[2]
var mode = process.argv[3]

if(!script || (mode != 'play' && mode != 'record' && mode != 'append'))
  return console.log('Usage: concept.js <script-file> <record | play | append>')

var term = null

process.stdin.setRawMode(true)
keypress(process.stdin)

if(mode == 'record') {
  script = fs.createWriteStream(script)
  start()
} else {
  script = fs.createReadStream(script).pipe(split('\n'))
  var lines = []
  script.on('data', function(line) {
    if(line) {
      line = JSON.parse(line)
      lines.push(line)
    }
  })
  script.on('end', function() {
    script = lines
    start()
  })
}

process.stdin.on('keypress', function(ch, key) {
  //console.log('Key ch=%j key=%j', ch, key)
  if(mode == 'record')
    record_key(ch, key)
  else
    play_key()
})

function play_key() {
  var line = script.shift()
  if(line)
    return send(line.ch, line.key)

  // No more lines left.
  if(mode == 'play')
    return term.end()

  // Append mode. Switch from play to record.
  mode = 'record'
  if(mode == 'append')
  if(!line)
    return term.end()
}

function record_key(ch, key) {
  var input = { 'ch':ch||null, 'key':key||null }
  script.write(JSON.stringify(input) + '\n')

  send(input.ch, input.key)
}

function send(ch, key) {
  if(key && key.sequence)
    return term.write(key.sequence)

  if(ch)
    return term.write(ch)

  throw new Error(util.format('Unknown keypress: ch=%j key=%j\n', ch, key))
}

function start() {
  term = pty.spawn('bash', [],
    { name: process.env.TERM      || 'xterm-color'
    , cols: +(process.env.COLUMNS || 80)
    , rows: +(process.env.LINES   || 24)
    , cwd: process.env.HOME
    , env: process.env
    })

  term.on('data', function(data) {
    process.stdout.write(data)
  })

  term.on('exit', function(x) {
    console.log('== Exit: %j', x)
    if(mode == 'record')
      script.end()
    process.stdin.setRawMode(false)
    process.stdin.end()
  })

  console.log('Term (%s): %s', mode, term.pty)
}
