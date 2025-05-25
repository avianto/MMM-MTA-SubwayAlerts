Module.register('MMM-MTA-SubwayAlerts', {
  knownMtaRouteIds: [
    '1', '2', '3',
    '4', '5', '6',
    '7',
    'A', 'C', 'E',
    'B', 'D', 'F', 'M',
    'N', 'Q', 'R', 'W',
    'G',
    'L',
    'J', 'Z',
    'S',
    'SIR',
  ],

  specialIconMap: {
    '[ACCESSIBILITY ICON]': 'fa-wheelchair',
    '[SHUTTLE BUS ICON]': 'fa-bus',
  },

  defaults: {
    moduleTitle: 'MTA Subway Alerts',
    apiBase: 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts',
    updateInterval: 5 * 60 * 1000,
    animationSpeed: 1000,
    fade: true,
    fadePoint: 0.25,
    maxAlerts: 5,
    showIcons: true,
    showSpecialIcons: true,
    showDescription: true,
    noAlertsMessage: 'No subway alerts currently.',
    filterRoutes: [],
    showActivePeriod: true,
    dateFormat: {
      dateStyle: 'short',
      timeStyle: 'short',
      hour12: true,
    },
  },

  start: function () {
    Log.info('Starting module: ' + this.name)
    this.alerts = []
    this.loaded = false

    this.getMTASubwayAlerts()
    setInterval(() => {
      this.getMTASubwayAlerts()
    }, this.config.updateInterval)
  },

  getHeader: function () {
    return this.config.moduleTitle
  },

  getMTASubwayAlerts: function () {
    const fullApiUrl = this.config.apiBase
    Log.log(`MMM-MTA-SubwayAlerts: Sending request with filterRoutes: ${JSON.stringify(this.config.filterRoutes)}`)
    this.sendSocketNotification('GET_MTA_SUBWAY_ALERTS', {
      apiUrl: fullApiUrl,
      filterRoutes: this.config.filterRoutes,
    })
  },

  replaceLineIconsInText: function (text) {
    if (!this.config.showIcons) {
      return text
    }

    const regex = /\[([A-Z0-9]+)\]/g
    return text.replace(regex, (match, routeId) => {
      const normalizedRouteId = routeId.toUpperCase()
      if (this.knownMtaRouteIds.includes(normalizedRouteId)) {
        return `<span class="mta-route-icon mta-route-icon--inline route-${normalizedRouteId}">${normalizedRouteId}</span>`
      }
      return match
    })
  },

  replaceSpecialIconsInText: function (text) {
    if (!this.config.showSpecialIcons) {
      return text
    }

    let processedText = text
    for (const textIcon in this.specialIconMap) {
      const faClass = this.specialIconMap[textIcon]
      const regex = new RegExp(textIcon.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi')
      processedText = processedText.replace(regex, `<i class="fa ${faClass} mta-special-icon"></i>`)
    }
    return processedText
  },

  formatTimestamp: function (timestamp) {
    if (timestamp === null) { // Use === for null check
      return 'N/A'
    }
    const date = new Date(timestamp * 1000)
    const options = {
      dateStyle: this.config.dateFormat.dateStyle,
      timeStyle: this.config.dateFormat.timeStyle,
      hour12: this.config.dateFormat.hour12,
    }
    try {
      return date.toLocaleString(undefined, options)
    }
    catch (e) {
      Log.error('Error formatting date:', e)
      return date.toISOString()
    }
  },

  getRelevantActivePeriod: function (activePeriods) {
    if (!activePeriods || activePeriods.length === 0) {
      return null
    }

    const now = Math.floor(Date.now() / 1000)

    let currentPeriod = null
    for (const period of activePeriods) {
      const hasStarted = period.start === null || period.start <= now
      const hasNotEnded = period.end === null || period.end >= now

      if (hasStarted && hasNotEnded) {
        currentPeriod = period
        break
      }
    }

    if (currentPeriod) {
      return currentPeriod
    }

    let earliestFuturePeriod = null
    for (const period of activePeriods) {
      if (period.start !== null && period.start > now) {
        if (!earliestFuturePeriod || period.start < earliestFuturePeriod.start) {
          earliestFuturePeriod = period
        }
      }
    }

    if (earliestFuturePeriod) {
      return earliestFuturePeriod
    }

    let latestPastPeriod = null
    for (const period of activePeriods) {
      if (period.end !== null && period.end < now) {
        if (!latestPastPeriod || period.end > latestPastPeriod.end) {
          latestPastPeriod = period
        }
      }
    }

    return latestPastPeriod || (activePeriods.length > 0 ? activePeriods[0] : null)
  },

  getDom: function () {
    const wrapper = document.createElement('div')

    if (!this.loaded) {
      wrapper.innerHTML = 'Loading MTA Subway Alerts...'
      wrapper.className = 'dimmed light small'
      return wrapper
    }

    const contentContainer = document.createElement('div')
    contentContainer.className = 'mta-content-container'

    if (this.alerts.length === 0) {
      const noAlertsDiv = document.createElement('div')
      noAlertsDiv.innerHTML = this.config.noAlertsMessage
      noAlertsDiv.className = 'light small'
      contentContainer.appendChild(noAlertsDiv)
    }
    else {
      const alertList = document.createElement('ul')
      alertList.className = 'mta-alerts-list'

      const displayAlerts = this.alerts.slice(0, this.config.maxAlerts)

      for (let i = 0; i < displayAlerts.length; i++) {
        const alert = displayAlerts[i]
        const listItem = document.createElement('li')
        listItem.className = 'mta-alert'

        const header = document.createElement('div')
        header.className = 'mta-alert-header bright'
        let formattedHeader = this.replaceLineIconsInText(alert.header)
        formattedHeader = this.replaceSpecialIconsInText(formattedHeader)
        header.innerHTML = formattedHeader
        listItem.appendChild(header)

        if (this.config.showDescription && alert.description) {
          const description = document.createElement('div')
          description.className = 'mta-alert-description small'
          let formattedDescription = this.replaceLineIconsInText(alert.description)
          formattedDescription = this.replaceSpecialIconsInText(formattedDescription)
          description.innerHTML = formattedDescription
          listItem.appendChild(description)
        }

        const timestampDiv = document.createElement('div')
        timestampDiv.className = 'mta-alert-timestamps xsmall dimmed'

        if (this.config.showActivePeriod && alert.activePeriods && alert.activePeriods.length > 0) {
          const relevantPeriod = this.getRelevantActivePeriod(alert.activePeriods)

          if (relevantPeriod) {
            let periodText = 'Active: '
            if (relevantPeriod.start !== null) { // Use !== null for clarity
              periodText += `From ${this.formatTimestamp(relevantPeriod.start)} `
            }
            if (relevantPeriod.end !== null) { // Use !== null for clarity
              periodText += `To ${this.formatTimestamp(relevantPeriod.end)}`
            }
            else if (relevantPeriod.start !== null) {
              periodText += '(Ongoing)'
            }

            if (relevantPeriod.start !== null || relevantPeriod.end !== null) {
              const periodSpan = document.createElement('span')
              periodSpan.innerHTML = periodText
              timestampDiv.appendChild(periodSpan)
            }
          }
        }

        if (timestampDiv.childElementCount > 0) {
          listItem.appendChild(timestampDiv)
        }

        if (this.config.fade && this.config.fadePoint < 1) {
          const startingPoint = displayAlerts.length * this.config.fadePoint
          const opacity = 1 - (i - startingPoint) / (displayAlerts.length - startingPoint)
          listItem.style.opacity = opacity < 0 ? 0 : opacity
        }

        alertList.appendChild(listItem)
      }
      contentContainer.appendChild(alertList)
    }

    wrapper.appendChild(contentContainer)
    return wrapper
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'MTA_SUBWAY_ALERTS_RESULT') {
      this.alerts = payload
      this.loaded = true
      this.updateDom(this.config.animationSpeed)
    }
  },

  getScripts: function () {
    return []
  },

  getStyles: function () {
    return [
      'mta-subwayalerts.css',
      'font-awesome.css',
    ]
  },
})
