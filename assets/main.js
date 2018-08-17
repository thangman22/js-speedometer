document.addEventListener('DOMContentLoaded', () => {
  let app = new Vue({
    el: '#main',
    components: { 'autocomplete': window['vuejs-autocomplete'] },
    data: {
      showCustomUrl: false,
      afterTest: false,
      showDependencies: false,
      mainScript: null,
      dependencies: {},
      progress: 0,
      testingProgress: '',
      mainScriptName: null,
      resultData: {},
      showErrorLog: false,
      enableShare: false
    },
    filters: {
      bytesToSize (bytes) {
        let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
        if (bytes === 0) return '0 Byte'
        let i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
        return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i]
      }
    },
    async mounted () {
      if (navigator.share) {
        this.enableShare = true
      }

      let pathParams = window.location.pathname.split('/')

      if (pathParams[1] === 'js') {
        this.mainScriptName = pathParams[2]
        this.mainScript = decodeURIComponent(pathParams[3])
        await this.testBundle(true)
      }
    },
    methods: {
      share () {
        navigator.share({
          title: 'JS Speedometer | How long your JS boot?',
          text: `Test result of ${this.mainScriptName} Pasing time ${Math.round(this.resultData.avgParse)}ms / Execution time ${Math.round(this.resultData.avgExec)}ms`,
          url: window.location.href
        })
      },
      setMainScript (item) {
        this.mainScript = item.value
        this.mainScriptName = item.display
      },
      setDependencies (item) {
        this.$refs.dependencyAutocomplete.clear()
        this.$set(this.dependencies, item.display, item.value)
      },
      removeDependency (key) {
        this.$delete(this.dependencies, key)
      },
      async testBundle (fromUrl) {
        this.afterTest = true
        if (!this.mainScriptName) {
          this.mainScriptName = 'None'
        }
        if (!fromUrl) {
          window.history.pushState({}, 'JS Speedometer', `/js/${this.mainScriptName}/${encodeURIComponent(this.mainScript)}`)
        }
        this.progress = 0
        let interval = setInterval(() => {
          if (this.progress < 97) {
            this.progress = this.progress + 1.66
          }
          this.testingProgress = 'Testing progress ' + Math.round(this.progress) + '%'
        }, 1000)
        let testResult = await window.axios.post('/test/', {
          'fileUrl': this.mainScript,
          'dependencies': Object.values(this.dependencies)
        })
        this.resultData = testResult.data
        clearInterval(interval)
        this.progress = 100
        this.testingProgress = 'Testing progress ' + Math.round(this.progress) + '%'
      },
      toggleCustom () {
        this.showCustomUrl = !this.showCustomUrl
      },
      toggleDependencies () {
        this.showDependencies = !this.showDependencies
      },
      toggleError () {
        this.showErrorLog = !this.showErrorLog
      }
    }
  })
})
