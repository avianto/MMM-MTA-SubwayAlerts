const NodeHelper = require('node_helper')
const gtfsRealtimeBindings = require('gtfs-realtime-bindings')

module.exports = NodeHelper.create({
  start: function () {
    console.log('Starting node_helper for MMM-MTA-SubwayAlerts...')
  },

  socketNotificationReceived: async function (notification, payload) {
    if (notification === 'GET_MTA_SUBWAY_ALERTS') {
      const { apiUrl, filterRoutes } = payload
      const normalizedFilterRoutes = filterRoutes ? filterRoutes.map(route => route.toUpperCase()) : []
      console.log(`MMM-MTA-SubwayAlerts: Fetching alerts from ${apiUrl}`)
      console.log(`MMM-MTA-SubwayAlerts: Filter routes received: ${JSON.stringify(normalizedFilterRoutes)}`)
      await this.fetchMTASubwayAlerts(apiUrl, normalizedFilterRoutes)
    }
  },

  fetchMTASubwayAlerts: async function (apiUrl, normalizedFilterRoutes) {
    try {
      const response = await fetch(apiUrl)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      const feed = gtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(buffer),
      )

      const alerts = []
      feed.entity.forEach((entity) => {
        if (entity.alert) {
          const alert = entity.alert
          const header = alert.headerText
            ? alert.headerText.translation[0].text
            : 'No Header'
          const description = alert.descriptionText
            ? alert.descriptionText.translation[0].text
            : 'No Description'

          const affectedRoutesArray = alert.informedEntity
            .map(entity => entity.routeId ? entity.routeId.toUpperCase() : null)
            .filter(Boolean)

          const affectedRoutes = affectedRoutesArray.join(', ')

          let shouldIncludeAlert = true

          if (normalizedFilterRoutes && normalizedFilterRoutes.length > 0) {
            if (affectedRoutesArray.length === 0) {
              if (!normalizedFilterRoutes.includes('GENERAL')) {
                shouldIncludeAlert = false
              }
              else {
                console.log(`    -> Included (General alert, 'GENERAL' in filter)`)
              }
            }
            else {
              const intersection = affectedRoutesArray.filter(route => normalizedFilterRoutes.includes(route))
              if (intersection.length === 0) {
                shouldIncludeAlert = false
              }
              else {
                console.log(`    -> Included (Matching routes: ${JSON.stringify(intersection)})`)
              }
            }
          }

          if (shouldIncludeAlert) {
            const activePeriods = alert.activePeriod
              ? alert.activePeriod.map(period => ({
                  start: period.start ? period.start.low : null,
                  end: period.end ? period.end.low : null,
                }))
              : []

            alerts.push({
              id: entity.id,
              header: header,
              description: description,
              routes: affectedRoutes || 'General Service Alert',
              routeIds: affectedRoutesArray,
              activePeriods: activePeriods,
            })
          }
        }
      })

      alerts.sort((a, b) => {
        const now = Math.floor(Date.now() / 1000)

        let aEffectiveStart = Infinity
        if (a.activePeriods && a.activePeriods.length > 0) {
          for (const period of a.activePeriods) {
            if (period.start !== null) {
              if (period.start <= now && (period.end === null || period.end >= now)) {
                aEffectiveStart = 0
                break
              }
              if (period.start > now && period.start < aEffectiveStart) {
                aEffectiveStart = period.start
              }
            }
            else {
              aEffectiveStart = 0
              break
            }
          }
        }
        else {
          aEffectiveStart = 0
        }

        let bEffectiveStart = Infinity
        if (b.activePeriods && b.activePeriods.length > 0) {
          for (const period of b.activePeriods) {
            if (period.start !== null) {
              if (period.start <= now && (period.end === null || period.end >= now)) {
                bEffectiveStart = 0
                break
              }
              if (period.start > now && period.start < bEffectiveStart) {
                bEffectiveStart = period.start
              }
            }
            else {
              bEffectiveStart = 0
              break
            }
          }
        }
        else {
          bEffectiveStart = 0
        }

        return aEffectiveStart - bEffectiveStart
      })

      console.log(`MMM-MTA-SubwayAlerts: Total alerts after filtering: ${alerts.length}`)
      this.sendSocketNotification('MTA_SUBWAY_ALERTS_RESULT', alerts)
    }
    catch (error) {
      console.error('MMM-MTA-SubwayAlerts: Error fetching or parsing MTA alerts:', error)
      this.sendSocketNotification('MTA_SUBWAY_ALERTS_RESULT', [])
    }
  },
})
