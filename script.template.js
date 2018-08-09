// INSTRUMENTED FOR DEVICE-TIMING (github.com/etsy/DeviceTiming)
window.__devicetiming = {}
// start timing
window.__devicetiming.t = { start: new Date().getTime() }
// eval the code - the timer at the beginning of this string marks end of parse
eval('__devicetiming.t.parse = new Date().getTime(); [[script here]]')
// end of parse to here is exec
window.__devicetiming.t.exec = new Date().getTime()
// safe init window.__timing
window.__timing = window.__timing || {}
// epoch to ms
window.__timing = { parse: window.__devicetiming.t.parse - window.__devicetiming.t.start, exec: window.__devicetiming.t.exec - window.__devicetiming.t.parse }
// debounced becon - last file to run sends the timing data
clearTimeout(window.__timing_delay || -1)
window.__timing_delay = setTimeout(function () {
  console.log('Script||' + JSON.stringify(window.__timing))
}, 6000)
