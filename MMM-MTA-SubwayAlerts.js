Module.register("MMM-MTA-SubwayAlerts", {
  // Define all known MTA subway route IDs for comprehensive replacement
  knownMtaRouteIds: [
    "1", "2", "3", // Red lines
    "4", "5", "6", //Green lines
    "7", // Purple lines
    "A", "C", "E", // Blue lines
    "B", "D", "F", "M", // Orange lines
    "N", "Q", "R", "W", // Yellow lines
    "G", // Lime Green line
    "L", // Grey line
    "J", "Z", // Brown lines
    "S", // Shuttle lines (e.g., Franklin Ave, Rockaway Park)
    "SIR" // Staten Island Railway
  ],

  // Define mapping for special text icons to Font Awesome classes
  specialIconMap: {
    "[ACCESSIBILITY ICON]": "fa-wheelchair", // Font Awesome wheelchair icon
    "[SHUTTLE BUS ICON]": "fa-bus",          // Font Awesome bus icon
    // Note: Add more mappings here if other special icons are identified, e.g.:
    // "(A)": "fa-info-circle"
  },

  defaults: {
    moduleTitle: "MTA Subway Alerts",
    apiBase: "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts",
    updateInterval: 5 * 60 * 1000,
    animationSpeed: 1000,
    fade: true,
    fadePoint: 0.25,
    maxAlerts: 5,
    showIcons: true, // Controls header/description route icon replacement
    showSpecialIcons: true, // Controls replacement of special text icons (e.g., accessibility, shuttle bus)
    showDescription: true,
    noAlertsMessage: "No subway alerts currently.",
    filterRoutes: [],
  },

  start: function() {
    Log.info("Starting module: " + this.name);
    this.alerts = [];
    this.loaded = false;

    this.getMTASubwayAlerts();
    setInterval(() => {
      this.getMTASubwayAlerts();
    }, this.config.updateInterval);
  },

  getHeader: function() {
    return this.config.moduleTitle;
  },

  getMTASubwayAlerts: function() {
    const fullApiUrl = this.config.apiBase;
    Log.log(`MMM-MTA-SubwayAlerts: Sending request with filterRoutes: ${JSON.stringify(this.config.filterRoutes)}`);
    this.sendSocketNotification("GET_MTA_SUBWAY_ALERTS", {
      apiUrl: fullApiUrl,
      filterRoutes: this.config.filterRoutes,
    });
  },

  // Helper function to replace [ROUTE_ID] with colored subway icons
  replaceLineIconsInText: function(text) {
    if (!this.config.showIcons) {
      return text; // Return original text if line icons are not enabled
    }

    const regex = /\[([A-Z0-9]+)\]/g; // Matches [A], [1], [L], etc.
    return text.replace(regex, (match, routeId) => {
      const normalizedRouteId = routeId.toUpperCase();
      if (this.knownMtaRouteIds.includes(normalizedRouteId)) {
        return `<span class="mta-route-icon mta-route-icon--inline route-${normalizedRouteId}">${normalizedRouteId}</span>`;
      } else {
        return match;
      }
    });
  },

  // Helper function to replace special text icons with Font Awesome icons
  replaceSpecialIconsInText: function(text) {
    if (!this.config.showSpecialIcons) {
      return text; // Return original text if special icons are not enabled
    }

    let processedText = text;
    for (const textIcon in this.specialIconMap) {
      const faClass = this.specialIconMap[textIcon];
      // Use a global regex to replace all occurrences, case-insensitive
      const regex = new RegExp(textIcon.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi'); // Escape special chars and make global/case-insensitive
      processedText = processedText.replace(regex, `<i class="fa ${faClass} mta-special-icon"></i>`);
    }
    return processedText;
  },

  getDom: function() {
    const wrapper = document.createElement("div");

    if (!this.loaded) {
      wrapper.innerHTML = "Loading MTA Subway Alerts...";
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    const contentContainer = document.createElement("div");
    contentContainer.className = "mta-content-container";

    if (this.alerts.length === 0) {
      const noAlertsDiv = document.createElement("div");
      noAlertsDiv.innerHTML = this.config.noAlertsMessage;
      noAlertsDiv.className = "light small";
      contentContainer.appendChild(noAlertsDiv);
    } else {
      const alertList = document.createElement("ul");
      alertList.className = "mta-alerts-list";

      const displayAlerts = this.alerts.slice(0, this.config.maxAlerts);

      for (let i = 0; i < displayAlerts.length; i++) {
        const alert = displayAlerts[i];
        const listItem = document.createElement("li");
        listItem.className = "mta-alert";

        const header = document.createElement("div");
        header.className = "mta-alert-header bright";
        // Apply both icon replacements
        let formattedHeader = this.replaceLineIconsInText(alert.header);
        formattedHeader = this.replaceSpecialIconsInText(formattedHeader);
        header.innerHTML = formattedHeader;
        listItem.appendChild(header);

        if (this.config.showDescription && alert.description) {
          const description = document.createElement("div");
          description.className = "mta-alert-description small";
          // Apply both icon replacements
          let formattedDescription = this.replaceLineIconsInText(alert.description);
          formattedDescription = this.replaceSpecialIconsInText(formattedDescription);
          description.innerHTML = formattedDescription;
          listItem.appendChild(description);
        }

        if (this.config.fade && this.config.fadePoint < 1) {
          const startingPoint = displayAlerts.length * this.config.fadePoint;
          const opacity = 1 - (i - startingPoint) / (displayAlerts.length - startingPoint);
          listItem.style.opacity = opacity < 0 ? 0 : opacity;
        }

        alertList.appendChild(listItem);
      }
      contentContainer.appendChild(alertList);
    }

    wrapper.appendChild(contentContainer);
    return wrapper;
  },

  socketNotificationReceived: function(notification, payload) {
    if (notification === "MTA_SUBWAY_ALERTS_RESULT") {
      this.alerts = payload;
      this.loaded = true;
      this.updateDom(this.config.animationSpeed);
    }
  },

  getScripts: function() {
    return [];
  },

  getStyles: function() {
    return [
      "mta-subwayalerts.css",
      // Font Awesome for special icons (Accessibility, Shuttle Bus)
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
    ];
  },
});
