const fs = require('fs')
const esc = require('js-string-escape')
const util = require('util')
const redis = require('redis')
const nconf = require('nconf')
const express = require('express')
const puppeteer = require('puppeteer')
const app = express()
const strip = require('strip-comments')
const readFile = util.promisify(fs.readFile)
const compression = require('compression')
const mustacheExpress = require('mustache-express')
const rp = require('request-promise')
const crypto = require('crypto')
const signale = require('signale')
const qs = require('qs')
const bodyParser = require('body-parser')
const port = 8080
const cors = require('cors')
const RateLimit = require('express-rate-limit')
const testRound = 3

const options = {
  disabled: false,
  interactive: false,
  stream: process.stdout,
  scope: 'browser',
  types: {
    error: {
      badge: '!!',
      color: 'red',
      label: 'Error'
    },
    log: {
      badge: '??',
      color: 'yellow',
      label: 'Log'
    }
  }
}

const custom = new signale.Signale(options);

nconf.argv().env().file('conf.json')

const client = redis.createClient(
  nconf.get('REDIS_PORT') || '6379',
  nconf.get('REDIS_URL') || '127.0.0.1',
  {
    'auth_pass': nconf.get('REDIS_PASSWORD') || '',
    'return_buffers': true
  }
).on('error', (err) => console.error('ERR:REDIS:', err))

const limiter = new RateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  delayMs: 0,
  message: 'Too many accounts created from this IP, please try again after an 15 mins'
})

const { promisify } = require('util')
const getAsync = promisify(client.get).bind(client);

(async () => {
  app.use(compression())
  app.use(limiter)
  app.use(express.static('./'))
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(bodyParser.json())
  app.engine('mustache', mustacheExpress())
  app.set('view engine', 'mustache')
  app.set('views', __dirname)
  app.use(cors())
  app.listen(port)
  signale.debug(`Listen app at port ${port}`)

  app.get('/', async function (req, res) {
    res.sendFile(path.join(__dirname + '/index.html'))
  })

  app.get('/build', async function (req, res) {
    try {
      signale.debug(`[BUILD] Retriving file from ${req.query.fileUrl}`)
      let mainScript = await rp(req.query.fileUrl)
      let template = await readFile('script.template.js')

      let dependenciesScript = ''

      if (req.query.dependencies) {
        dependenciesScript = req.query.dependencies.map(script => `<script src="${script}"></script>`)
      }

      signale.debug(`[BUILD] Merging file with template for ${req.query.fileUrl}`)
      let contentModified = template.toString().replace('[[script here]]', esc(strip(mainScript)))
      signale.debug(`[BUILD] Build ${req.query.fileUrl} Completed`)
      res.render('page-template', {
        modifiedJsScript: contentModified,
        dependenciesScript: dependenciesScript
      })
    } catch (error) {
      res.status(500).json({ 'error': 'build fail' })
    }
    
  })

  app.post('/test', async function (req, res) {
    
    if (!req.body.fileUrl) {
    
      res.status(400).json({ 'error': 'fileUrl is empty' })
    
    } else {
      try {
        let errorLog = []
        let performanceResult = {}
        let tests = []
        let mainScript = await rp(req.body.fileUrl)
        let size = Buffer.byteLength(mainScript, 'utf16')
        let hex = crypto.createHash('md5').update(mainScript).digest('hex')
        let cacheRes = await getAsync(hex)

        performanceResult.size = size

        if (cacheRes) {
          let cachePerformanceRes = JSON.parse(cacheRes.toString())
          cachePerformanceRes.size = size
          cachePerformanceRes.isCache = true
          signale.success(`[TEST] Cache hit for ${req.body.fileUrl}`)
          let status = 200
          
          if (cachePerformanceRes.avgParse === 0) {
            client.del(hex)
          }

          res.status(status).json(cachePerformanceRes)
        } else {
          performanceResult.hash = hex
          performanceResult.url = req.body.fileUrl

          for (let i = 1; i <= testRound; i++) {
            errorLog = []
            let host = req.protocol + '://' + req.get('host')

            let browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
            let page = await browser.newPage()
            let client = await page.target().createCDPSession()
            await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
            page.on('console', msg => {
              custom.log(msg.text())
              let messageLogs = msg.text().split('||')
              if (messageLogs[1]) {
                let resultLog = JSON.parse(messageLogs[1])
                tests.push({ parse: resultLog.parse, exec: resultLog.exec })
              }
            })

            page.on('error', err => {
              custom.error(err)
              errorLog.push(err.toString())
            })

            page.on('pageerror', err => {
              custom.error(err)
              errorLog.push(err.toString())
            })

            let queryString = qs.stringify({
              fileUrl: req.body.fileUrl,
              dependencies: req.body.dependencies
            })

            signale.debug(`[TEST] Opening ${host}/build?${queryString}`)
            await page.goto(`${host}/build?${queryString}`)
            signale.pending(`[TEST] Waiting for 10s`)
            await page.waitFor(10000)
            signale.complete({ message: `[TEST] Test ${req.body.fileUrl} Completed` })
            await browser.close()
          }

          performanceResult.avgParse = parseFloat((tests.reduce((acc, val) => acc + val.parse, 0) / testRound).toFixed(2))
          performanceResult.avgExec = parseFloat((tests.reduce((acc, val) => acc + val.exec, 0) / testRound).toFixed(2))
          performanceResult.testResult = tests
          performanceResult.errorLog = errorLog
          performanceResult.testTime = Date.now()

          signale.success(`Result of ${req.body.fileUrl} is ${JSON.stringify(performanceResult)}`)

          if (performanceResult.avgParse > 0) {
            client.set(performanceResult.hash, JSON.stringify(performanceResult), 'EX', 3600);
          } 

          res.status(200).json(performanceResult)
        }
      } catch (error) {
        console.log(error)
        res.status(500).json({ 'error': 'test fail','msg': error })
      }


    }
  })
})()
