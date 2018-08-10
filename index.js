const fs = require('fs')
const esc = require('js-string-escape')
const util = require('util')
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
const testRound = 5;

(async () => {
  app.use(compression())
  app.use(express.static('./'))
  app.use(bodyParser.urlencoded({ extended: false }))
  app.use(bodyParser.json())
  app.engine('mustache', mustacheExpress())
  app.set('view engine', 'mustache')
  app.set('views', __dirname)
  app.listen(port)
  signale.debug(`Listen app at port ${port}`)

  app.get('/build', async function (req, res) {
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
    res.render('index', {
      modifiedJsScript: contentModified,
      dependenciesScript: dependenciesScript
    })
  })

  app.post('/test', async function (req, res) {
    if (!req.body.fileUrl) {
    
      res.status(400).json({ 'error': 'fileUrl is empty' })
    
    } else {
      let performanceResult = {}
      let tests = []
      let mainScript = await rp(req.body.fileUrl)
      let hex = crypto.createHash('md5').update(mainScript).digest('hex')
      performanceResult.hash = hex
      performanceResult.url = req.body.fileUrl

      for (let i = 1; i <= testRound; i++) {
        let host = req.protocol + '://' + req.get('host')

        let browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
        let page = await browser.newPage()
        let client = await page.target().createCDPSession()
        await client.send('Emulation.setCPUThrottlingRate', { rate: 4 })
        page.on('console', msg => {
          let messageLogs = msg.text().split('||')
          if (messageLogs[1]) {
            let resultLog = JSON.parse(messageLogs[1])
            tests.push({ parse: resultLog.parse, exec: resultLog.exec})
          }
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
      signale.success(`Result of ${req.body.fileUrl} is ${JSON.stringify(performanceResult)}`)
      res.status(200).json(performanceResult)
    }
  })
})()
