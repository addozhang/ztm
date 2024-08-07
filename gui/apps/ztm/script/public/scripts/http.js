#!/usr/bin/env -S pipy --args

try {
  var argv = [...pipy.argv]
  argv[1] ??= 'help'

  parseArgv(argv, {
    commands: [
      {
        title: 'Make an HTTP request',
        usage: '<URL>',
        options: `
          -X, --method  <method>          HTTP request method (default: GET)
          -H, --header  <name:value ...>  Add a header to the request
          -d, --data    <string>          Text payload of the request
              --http2                     Use HTTP/2
        `,
        action: (args) => {
          var url = new URL(args['<URL>'])
          var method = args['--method'] || ('--data' in args ? 'POST' : 'GET')
          var headers = args['--header'] || []
          var body = args['--data'] || ''
          var version = args['--http2'] ? 2 : 1
          request(url, { method, headers, body, version }).then(() => {
            pipy.exit(0)
          }).catch(err => {
            println(err)
            pipy.exit(-1)
          })
        },
      }
    ]
  })
} catch (err) {
  println(err)
  pipy.exit(-1)
}

function request(url, { method, headers, body, version }) {
  var head = {
    method,
    path: url.path,
    headers: {
      host: url.host,
      ...Object.fromEntries(
        headers.map(header => {
          var kv = header.split(':')
          var k = kv[0]?.trim?.()
          var v = kv[1]?.trim?.()
          return (k && v ? [k, v] : null)
        }).filter(kv => kv !== null)
      )
    },
  }
  var tls = {
    sni: url.hostname,
    alpn: version === 2 ? 'h2' : 'http/1.1',
  }
  return pipeline($=>$
    .onStart(new Message(head, body))
    .muxHTTP({ version }).to($=>$
      .pipe(() => url.protocol === 'https:' ? 'tls' : 'tcp', {
        'tcp': $=>$.connect(`${url.hostname}:${url.port}`),
        'tls': $=>$.connectTLS(tls).to($=>$.connect(`${url.hostname}:${url.port}`)),
      })
    )
    .decompressHTTP()
    .replaceMessage(res => {
      if (res) {
        var head = res.head
        println(`${head.protocol} ${head.status} ${head.statusText}`)
        Object.entries(head.headers).forEach(
          ([k, v]) => println(`${k}: ${v}`)
        )
        if (res.body) {
          println()
          println(res.body.toString())
        }
      } else {
        println('Empty response')
      }
      return new StreamEnd
    })
  ).spawn()
}

function parseArgv(argv, { commands, notes, help, fallback }) {
  var program = argv[0]
  argv = argv.slice(1)

  var isHelpCommand = false
  if (argv[0] === 'help') {
    isHelpCommand = true
    argv.shift()
  }

  var patterns = commands.map(cmd => cmd.usage ? tokenize(cmd.usage) : [])
  var best = 0
  var bestIndex = -1

  patterns.forEach((pattern, i) => {
    var empty = !pattern.some(t => !t.startsWith('<') && !t.startsWith('['))
    var len = matchCommand(pattern, argv)
    if (len > best || empty) {
      best = len
      bestIndex = i
    }
  })

  var cmd = commands[bestIndex]
  var pattern = patterns[bestIndex]

  if (isHelpCommand) {
    var lines = ['']
    if (cmd) {
      var usage = program
      if (cmd.usage) usage += ' ' + cmd.usage
      if (cmd.options) usage += ' [options...]'
      if (cmd.title) lines.push(cmd.title, '')
      lines.push(`Usage: ${usage}`, '')
      if (cmd.options) lines.push(`Options:`, '', stripIndentation(cmd.options, 2), '')
      if (cmd.notes) lines.push(stripIndentation(cmd.notes), '')
    } else {
      var commandList = []
      commands.forEach(cmd => {
        if (!cmd.usage) return
        var tokens = tokenize(cmd.usage)
        var firstArg = tokens.findIndex(t => t.startsWith('<') || t.startsWith('['))
        if (firstArg >= 0) {
          commandList.push([
            tokens.slice(0, firstArg).join(' '),
            tokens.slice(firstArg).join(' '),
            cmd.title || ''
          ])
        } else {
          commandList.push([tokens.join(' '), '', cmd.title || ''])
        }
      })
      lines.push(`Commands:`, '')
      var cmdWidth = commandList.reduce((max, cmd) => Math.max(max, cmd[0].length), 0)
      var argWidth = commandList.reduce((max, cmd) => Math.max(max, cmd[1].length), 0)
      commandList.forEach(cmd => {
        lines.push(`  ${program} ${cmd[0].padEnd(cmdWidth)}  ${cmd[1].padEnd(argWidth)}   ${cmd[2]}`)
      })
      lines.push('')
      if (notes) {
        lines.push(stripIndentation(notes), '')
      }
      lines.push(`Type '${program} help <command>' for detailed info.`, '')
    }
    if (typeof help === 'function') {
      return help(lines.join('\n'), cmd)
    } else {
      return lines.forEach(l => println(l))
    }
  }

  if (!cmd) {
    if (typeof fallback === 'function') {
      return fallback(argv)
    } else {
      throw `Unknown command. Type '${program} help' for help info.`
    }
  }

  try {
    var rest = []
    var args = parseCommand(pattern, argv, rest)
    var opts = parseOptions(cmd.options, rest)

  } catch (err) {
    var command = ['help', ...pattern.slice(0, best)].join(' ')
    throw `${err}. Type '${program} ${command}' for help info.`
  }

  return cmd.action({ ...args, ...opts })

  function matchCommand(pattern, argv) {
    var i = argv.findIndex(
      (arg, i) => arg.startsWith('-') || arg !== pattern[i]
    )
    return i < 0 ? argv.length : i
  }

  function parseCommand(pattern, argv, rest) {
    var values = {}
    var i = argv.findIndex((arg, i) => {
      var tok = pattern[i]
      if (arg.startsWith('-')) return true
      if (!tok) throw `Excessive positional argument: ${arg}`
      if (tok.startsWith('[') || tok.startsWith('<')) {
        values[tok] = arg
      }
    })
    if (i < 0) i = argv.length
    argv.slice(i).forEach(arg => rest.push(arg))
    var tok = pattern[i]
    if (!tok || tok.startsWith('[')) return values
    if (!tok.startsWith('<')) return null
    throw `Missing argument ${tok}`
  }

  function parseOptions(format, argv) {
    var options = {}

    if (format) {
      format.split('\n').map(
        line => line.trim()
      ).filter(
        line => line.startsWith('-')
      ).forEach(line => {
        var aliases = []
        var type
        tokenize(line).find(t => {
          if (t.startsWith('-')) {
            if (t.endsWith(',')) t = t.substring(0, t.length - 1)
            aliases.push(t)
          } else {
            if (t.endsWith('...]') || t.endsWith('...>')) type = 'array'
            else if (t.startsWith('[')) type = 'optional string'
            else if (t.startsWith('<')) type = 'string'
            else type = 'boolean'
            return true
          }
        })
        var option = { type }
        aliases.forEach(name => options[name] = option)
      })
    }

    var currentOption

    argv.forEach(arg => {
      if (currentOption) {
        if (arg.startsWith('-')) {
          endOption(currentOption)
          currentOption = undefined
        } else {
          addOption(currentOption, arg)
          return
        }
      }
      if (arg.startsWith('--')) {
        currentOption = arg
      } else if (arg.startsWith('-')) {
        if (arg.length === 2) {
          currentOption = arg
        } else {
          addOption(arg.substring(0, 2), arg.substring(2))
        }
      } else {
        throw `Excessive positional argument: ${arg}`
      }
    })

    if (currentOption) endOption(currentOption)

    function addOption(name, value) {
      var option = options[name]
      if (!option) throw `Unrecognized option: ${name}`
      switch (option.type) {
        case 'boolean':
          throw `Excessive positional argument: ${value}`
        case 'string':
        case 'optional string':
          if ('value' in option) throw `Duplicated option value: ${value}`
          option.value = value
          break
        case 'array':
          option.value ??= []
          option.value.push(value)
          break
      }
    }

    function endOption(name) {
      var option = options[name]
      if (!option) throw `Unrecognized option: ${name}`
      switch (option.type) {
        case 'boolean':
          option.value = true
          break
        case 'string':
          if (!('value' in option)) throw `Missing option value: ${name}`
          break
        case 'optional string':
          if (!('value' in option)) option.value = ''
          break
      }
    }

    var values = {}

    Object.entries(options).forEach(
      ([name, option]) => {
        if ('value' in option) {
          values[name] = option.value
        }
      }
    )

    return values
  }

  function tokenize(str) {
    var tokens = str.split(' ').reduce(
      (a, b) => {
        var last = a.pop()
        if (last && (last.startsWith('<') || last.startsWith('['))) {
          a.push(`${last} ${b}`)
        } else {
          a.push(last, b)
        }
        if (b.endsWith('>') || b.endsWith(']')) a.push('')
        return a
      }, []
    )
    return tokens instanceof Array ? tokens.filter(t => t) : [tokens]
  }

  function stripIndentation(s, indent) {
    var lines = s.split('\n')
    if (lines[0].trim() === '') lines.shift()
    var depth = lines[0].length - lines[0].trimStart().length
    var padding = ' '.repeat(indent || 0)
    return lines.map(l => padding + l.substring(depth)).join('\n')
  }
}
