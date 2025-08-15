class PageWatchBackground {
  constructor() {
    this.alarms = new Map();
    this.init();
  }

  init() {
    // Ensure Chrome APIs are available
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      console.error('Chrome APIs not available');
      return;
    }

    chrome.runtime.onInstalled.addListener(() => {
      this.createContextMenus();
      console.log('PageWatch extension installed');
    });

    if (chrome.alarms) {
      chrome.alarms.onAlarm.addListener((alarm) => {
        this.handleAlarm(alarm);
      });
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });

    if (chrome.storage) {
      chrome.storage.onChanged.addListener((changes) => {
        this.handleStorageChange(changes);
      });
    }
  }

  createContextMenus() {
    if (!chrome.contextMenus) {
      console.warn('Context menus API not available');
      return;
    }

    try {
      chrome.contextMenus.create({
        id: 'pagewatch-monitor',
        title: 'Monitor this element for changes',
        contexts: ['all']
      });

      chrome.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId === 'pagewatch-monitor') {
          chrome.tabs.sendMessage(tab.id, { action: 'startElementSelection' });
        }
      });
    } catch (error) {
      console.error('Error creating context menus:', error);
    }
  }

  async handleAlarm(alarm) {
    if (alarm.name.startsWith('pagewatch-')) {
      const monitorId = alarm.name.replace('pagewatch-', '');
      await this.checkForChanges(monitorId);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case 'createMonitor':
        await this.createMonitor(message.data);
        sendResponse({ success: true });
        break;

      case 'deleteMonitor':
        await this.deleteMonitor(message.monitorId);
        sendResponse({ success: true });
        break;

      case 'updateMonitor':
        await this.updateMonitor(message.monitorId, message.data);
        sendResponse({ success: true });
        break;

      case 'getMonitors':
        const monitors = await this.getMonitors(message.url);
        sendResponse({ monitors });
        break;

      case 'toggleMonitor':
        await this.toggleMonitor(message.monitorId, message.enabled);
        sendResponse({ success: true });
        break;
    }
  }

  async handleStorageChange(changes) {
    if (changes.monitors) {
      await this.updateAlarms();
    }
  }

  async createMonitor(monitorData) {
    const monitors = await this.getAllMonitors();
    const monitorId = this.generateId();
    
    const now = Date.now();
    const intervalMs = (monitorData.interval || 60) * 1000;
    
    const monitor = {
      id: monitorId,
      url: monitorData.url,
      selector: monitorData.selector,
      content: monitorData.content,
      interval: monitorData.interval || 60, // seconds
      enabled: true,
      created: now,
      lastCheck: null,
      nextCheck: now + intervalMs,
      changeCount: 0
    };

    monitors[monitorId] = monitor;
    await chrome.storage.local.set({ monitors });
    
    this.createAlarm(monitorId, monitor.interval);
    return monitorId;
  }

  async deleteMonitor(monitorId) {
    const monitors = await this.getAllMonitors();
    delete monitors[monitorId];
    await chrome.storage.local.set({ monitors });
    
    if (chrome.alarms) {
      chrome.alarms.clear(`pagewatch-${monitorId}`);
    }
  }

  async updateMonitor(monitorId, updates) {
    const monitors = await this.getAllMonitors();
    if (monitors[monitorId]) {
      Object.assign(monitors[monitorId], updates);
      await chrome.storage.local.set({ monitors });
      
      if (updates.interval) {
        this.createAlarm(monitorId, updates.interval);
      }
    }
  }

  async toggleMonitor(monitorId, enabled) {
    const monitors = await this.getAllMonitors();
    if (monitors[monitorId]) {
      monitors[monitorId].enabled = enabled;
      await chrome.storage.local.set({ monitors });
      
      if (enabled) {
        this.createAlarm(monitorId, monitors[monitorId].interval);
      } else {
        if (chrome.alarms) {
          chrome.alarms.clear(`pagewatch-${monitorId}`);
        }
      }
    }
  }

  async getMonitors(url = null) {
    const monitors = await this.getAllMonitors();
    if (url) {
      return Object.values(monitors).filter(monitor => monitor.url === url);
    }
    return Object.values(monitors);
  }

  async getAllMonitors() {
    const result = await chrome.storage.local.get('monitors');
    return result.monitors || {};
  }

  async createAlarm(monitorId, intervalSeconds) {
    if (!chrome.alarms) {
      console.warn('Alarms API not available');
      return;
    }

    try {
      chrome.alarms.clear(`pagewatch-${monitorId}`);
      chrome.alarms.create(`pagewatch-${monitorId}`, {
        delayInMinutes: intervalSeconds / 60,
        periodInMinutes: intervalSeconds / 60
      });

      // Update the nextCheck timestamp
      const monitors = await this.getAllMonitors();
      if (monitors[monitorId]) {
        monitors[monitorId].nextCheck = Date.now() + (intervalSeconds * 1000);
        await chrome.storage.local.set({ monitors });
      }
    } catch (error) {
      console.error('Error creating alarm:', error);
    }
  }

  async updateAlarms() {
    const monitors = await this.getAllMonitors();
    
    Object.values(monitors).forEach(monitor => {
      if (monitor.enabled) {
        this.createAlarm(monitor.id, monitor.interval);
      } else {
        if (chrome.alarms) {
          chrome.alarms.clear(`pagewatch-${monitor.id}`);
        }
      }
    });
  }

  async checkForChanges(monitorId) {
    const monitors = await this.getAllMonitors();
    const monitor = monitors[monitorId];
    
    if (!monitor || !monitor.enabled) {
      return;
    }

    try {
      const tabs = await chrome.tabs.query({ url: monitor.url });
      
      if (tabs.length === 0) {
        console.log(`No active tabs found for URL: ${monitor.url}`);
        // Still update timestamps even if no tab is open
        const now = Date.now();
        monitor.lastCheck = now;
        monitor.nextCheck = now + (monitor.interval * 1000);
        await chrome.storage.local.set({ monitors });
        return;
      }

      const tab = tabs[0];
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'checkElement',
        selector: monitor.selector
      });

      const now = Date.now();
      monitor.lastCheck = now;
      monitor.nextCheck = now + (monitor.interval * 1000);

      if (response && response.content !== undefined) {
        const currentContent = response.content;
        const hasChanged = currentContent !== monitor.content;

        if (hasChanged) {
          monitor.changeCount++;
          const oldContent = monitor.content;
          monitor.content = currentContent;
          
          await chrome.storage.local.set({ monitors });
          
          this.showNotification(monitor, oldContent, currentContent);
        } else {
          await chrome.storage.local.set({ monitors });
        }
      } else {
        // Update timestamps even if check failed
        await chrome.storage.local.set({ monitors });
      }
    } catch (error) {
      console.error(`Error checking monitor ${monitorId}:`, error);
      // Still update timestamps on error
      const now = Date.now();
      monitor.lastCheck = now;
      monitor.nextCheck = now + (monitor.interval * 1000);
      await chrome.storage.local.set({ monitors });
    }
  }

  showNotification(monitor, oldContent, newContent) {
    const notificationId = `pagewatch-${monitor.id}-${Date.now()}`;
    
    chrome.notifications.create(notificationId, {
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'PageWatch: Content Changed',
      message: `Changes detected on ${new URL(monitor.url).hostname}`,
      contextMessage: `Monitor: ${monitor.selector}`,
      buttons: [
        { title: 'View Changes' },
        { title: 'Dismiss' }
      ]
    });

    chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
      if (notifId === notificationId) {
        if (buttonIndex === 0) {
          chrome.tabs.create({ url: monitor.url });
        }
        chrome.notifications.clear(notifId);
      }
    });

    setTimeout(() => {
      chrome.notifications.clear(notificationId);
    }, 10000);
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

const pageWatchBackground = new PageWatchBackground();