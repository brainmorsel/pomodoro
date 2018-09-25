let $ = function (selector) {
  let nodeList = document.querySelectorAll(selector)
  return {
    el: nodeList[0],
    all: nodeList,
    on: function (eventName, callback) {
      for (let i = 0; i < nodeList.length; i++) {
        const item = nodeList[i]
        item.addEventListener(eventName, callback)
      }
    }
  }
}

function MicroEvent () {}
MicroEvent.prototype = {
  on: function (event, callback) {
    this._events = this._events || {}
    this._events[event] = this._events[event] || []
    this._events[event].push(callback)
  },
  off: function (event, callback) {
    this._events = this._events || {}
    if (!(event in this._events)) return
    this._events[event].splice(this._events[event].indexOf(callback), 1)
  },
  emit: function (event /* , args... */) {
    this._events = this._events || {}
    if (!(event in this._events)) return
    for (var i = 0; i < this._events[event].length; i++) {
      this._events[event][i].apply(this, Array.prototype.slice.call(arguments, 1))
    }
  },
}

function CountdownTimer (seconds) {
  this.seconds = seconds || 25 * 60
  this.isRunning = false
  this.remaining = 0
  this._intervalID = null
  this._lastTickDate = null

}
CountdownTimer.prototype = Object.assign(
  new MicroEvent(),
  {
    start: function () {
      if (this.isRunning) { return }
      this.isRunning = true
      this._lastTickDate = +Date.now()
      this._intervalID = setInterval(this._tick.bind(this), 500)
      this.emit('start')
    },
    stop: function () {
      this.isRunning = false
      clearInterval(this._intervalID)
      this.emit('tick', this.remaining)
      this.emit('stop')
    },
    reset: function (seconds) {
      this.seconds = seconds || this.seconds
      this.remaining = this.seconds
      this.emit('tick', this.remaining)
    },
    _tick: function () {
      let now = +Date.now()
      let elapsed = (now - this._lastTickDate) / 1000
      this._lastTickDate = now
      this.remaining -= elapsed
      this.emit('tick', this.remaining)

      if (this.remaining <= 0) {
        this.remaining = 0
        this.stop()
        this.emit('done')
      }
    },
  }
)

function secondsToTime (seconds) {
  let hours = Math.floor(seconds / 3600)
  let minutes = Math.floor((seconds / 60) % 60)
  seconds = Math.floor(seconds % 60)
  minutes = minutes < 10 ? '0' + minutes : minutes
  seconds = seconds < 10 ? '0' + seconds : seconds
  return {
    hours,
    minutes,
    seconds,
  }
}

function timeStringToSeconds (string) {
  let parts = string.split(':')
  parts.reverse()
  let seconds = 0
  let multiplier = 1
  for (let p of parts) {
    seconds += p * multiplier
    multiplier *= 60
  }
  return seconds
}

function getTime (selector) {
  let input = $(selector).el
  let sizeString = input.value || input.placeholder
  return timeStringToSeconds(sizeString)
}

function playAlarm () {
  let type = $('#alarmType').el.value
  if (type === 'none') { return }
  let volume = $('#alarmVolume').el.value
  let audio = $('#'+type).el
  audio.volume = volume / 100
  audio.fastSeek(0)
  audio.play()
}

function getLongBreakPeriod () {
  let el = $('#longBreakPeriod').el
  return el.value || +el.placeholder
}

window.onload = function () {
  let timer = new CountdownTimer(getTime('#pomodoroSize'))
  let timerType = 'pomodoro'
  let visualStats = []
  let longBreakCounter = 0

  function spawnNotification () {
    if (!$('#enableNotifications').el.checked) { return }
    let body
    switch (timerType) {
    case 'pomodoro':
      body = "Pomodoro complete! Let's have some break."
      break;
    default:
      body = 'Break ended. Return to work!'
    }
    let options = {
      body: body,
      icon: 'images/tomato_red.svg',
    }
    let n = new Notification('Pomodoro', options)
  }


  function updateStats (isCompleted) {
    if (timerType !== 'pomodoro') { return }
    visualStats.push(isCompleted)

    newImage = document.createElement('img'); 
    if (isCompleted) {
      newImage.src = 'images/tomato_red.svg'
      newImage.title = 'Complete pomodoro'
    } else {
      newImage.src = 'images/tomato_green.svg'
      newImage.title = 'Interrupted pomodoro'
    }
    $('#visualStats').el.appendChild(newImage); 
  }

  function reset (type) {
    timerType = type
    switch (type) {
    case 'pomodoro':
      timer.reset(getTime('#pomodoroSize'))
      if (timer.isRunning) {
        updateStats(false)
      }
      break
    case 'shortBreak':
      timer.reset(getTime('#shortBreakSize'))
      break
    case 'longBreak':
      timer.reset(getTime('#longBreakSize'))
      break
    }
  }

  timer.on('tick', function (remaining) {
    let time = secondsToTime(remaining)
    $('#seconds').el.innerHTML = time.seconds
    $('#minutes').el.innerHTML = time.minutes
    $('#title').el.innerHTML = time.minutes + ':' + time.seconds + ' — Pomodoro'

    let timerEl = $('#timer').el
    if (!timerEl.classList.contains('tick') && timer.isRunning) {
      timerEl.classList.add('tick')
    } else {
      timerEl.classList.remove('tick')
    }
  })
  timer.on('start', function () {
    $('#timer').el.classList.add('is-active')
    $('#favicon').el.href = 'images/tomato_red.svg'
  })
  timer.on('stop', function () {
    $('#timer').el.classList.remove('is-active')
    $('#favicon').el.href = 'images/tomato_green.svg'
  })
  timer.on('done', function () {
    $('#timer').el.classList.remove('tick')
    updateStats(true)
    playAlarm()
    spawnNotification()

    switch (timerType) {
    case 'pomodoro':
      longBreakCounter++
      if (longBreakCounter >= getLongBreakPeriod()) {
        reset('longBreak')
        longBreakCounter = 0
      } else {
        reset('shortBreak')
      }
      if ($('#enableAutoBreak').el.checked) {
        timer.start()
      }
      break
    default:
      reset('pomodoro')
      if ($('#enableAutoPomodoro').el.checked) {
        timer.start()
      }
    }
  })

  $('#start').on('click', function () { timer.start() })
  $('#stop').on('click', function () {
    reset(timerType)
    timer.stop()
  })
  $('.clock').on('click', function () {
    if (timer.isRunning) {
      timer.stop()
    } else {
      timer.start()
    }
  })
  $('#pomodoro').on('click', function () {
    reset('pomodoro')
    timer.start()
  })
  $('#shortBreak').on('click', function () {
    reset('shortBreak')
    timer.start()
  })
  $('#longBreak').on('click', function () {
    reset('longBreak')
    timer.start()
  })
  $('#alarmTest').on('click', playAlarm)
  $('#enableNotifications').on('input', function (e) {
    if (e.target.checked) {
      Notification.requestPermission().then(function(result) {
        if (result !== 'granted') {
          e.target.checked = false
        }
      });
    }
  })

  reset('pomodoro')
}
