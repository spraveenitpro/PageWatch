class PageWatchPopup {
  constructor() {
    this.currentTab = null;
    this.monitors = [];
    this.settings = {
      defaultInterval: 300,
      enableNotifications: true,
      enableSound: false
    };
    this.currentEditingMonitor = null;
    this.init();
  }

  async init() {
    await this.loadCurrentTab();
    await this.loadSettings();
    await this.loadMonitors();
    this.bindEvents();
    this.updateUI();
  }

  async loadCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      console.error('Error loading current tab:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      if (result.settings) {
        this.settings = { ...this.settings, ...result.settings };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async loadMonitors() {
    if (!this.currentTab) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getMonitors',
        url: this.currentTab.url
      });

      if (response && response.monitors) {
        this.monitors = response.monitors;
      }
    } catch (error) {
      console.error('Error loading monitors:', error);
      this.monitors = [];
    }
  }

  bindEvents() {
    // Main actions
    document.getElementById('addMonitorBtn').addEventListener('click', () => {
      this.startElementSelection();
    });

    document.getElementById('highlightBtn').addEventListener('click', () => {
      this.highlightMonitors();
    });

    document.getElementById('viewAllBtn').addEventListener('click', () => {
      this.openAllMonitors();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    // Settings modal
    document.getElementById('closeSettings').addEventListener('click', () => {
      this.closeModal('settingsModal');
    });

    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });

    document.getElementById('cancelSettings').addEventListener('click', () => {
      this.closeModal('settingsModal');
    });

    // Edit modal
    document.getElementById('closeEdit').addEventListener('click', () => {
      this.closeModal('editModal');
    });

    document.getElementById('saveEdit').addEventListener('click', () => {
      this.saveMonitorEdit();
    });

    document.getElementById('deleteMonitor').addEventListener('click', () => {
      this.deleteMonitor();
    });

    document.getElementById('cancelEdit').addEventListener('click', () => {
      this.closeModal('editModal');
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });
    });
  }

  updateUI() {
    this.updatePageInfo();
    this.updateMonitorsList();
    this.updateMonitorCount();
  }

  updatePageInfo() {
    if (!this.currentTab) return;

    const pageTitle = document.getElementById('pageTitle');
    const pageUrl = document.getElementById('pageUrl');

    pageTitle.textContent = this.currentTab.title || 'Current Page';
    pageUrl.textContent = new URL(this.currentTab.url).hostname;
  }

  updateMonitorsList() {
    const container = document.getElementById('monitorsList');
    const emptyState = document.getElementById('emptyState');

    if (this.monitors.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    this.monitors.forEach(monitor => {
      const monitorEl = this.createMonitorElement(monitor);
      container.appendChild(monitorEl);
    });
  }

  createMonitorElement(monitor) {
    const div = document.createElement('div');
    div.className = 'monitor-item';
    div.innerHTML = `
      <div class="monitor-header">
        <div class="monitor-selector">${monitor.selector}</div>
        <div class="monitor-actions">
          <button class="icon-btn toggle-btn" data-id="${monitor.id}" title="${monitor.enabled ? 'Disable' : 'Enable'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="${monitor.enabled ? 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' : 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z'}"/>
            </svg>
          </button>
          <button class="icon-btn edit-btn" data-id="${monitor.id}" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="monitor-info">
        <div class="monitor-status">
          <div class="status-indicator ${monitor.enabled ? '' : 'disabled'}"></div>
          <span>${monitor.enabled ? 'Active' : 'Disabled'}</span>
        </div>
        <div class="monitor-interval">${this.formatInterval(monitor.interval)}</div>
      </div>
      <div class="monitor-stats">
        <span>Changes: ${monitor.changeCount || 0}</span>
        <span>Last check: ${monitor.lastCheck ? this.formatTime(monitor.lastCheck) : 'Never'}</span>
      </div>
    `;

    // Bind toggle button
    const toggleBtn = div.querySelector('.toggle-btn');
    toggleBtn.addEventListener('click', () => {
      this.toggleMonitor(monitor.id, !monitor.enabled);
    });

    // Bind edit button
    const editBtn = div.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => {
      this.editMonitor(monitor);
    });

    return div;
  }

  updateMonitorCount() {
    const countEl = document.getElementById('monitorCount');
    countEl.textContent = this.monitors.length;
  }

  async startElementSelection() {
    if (!this.currentTab) return;

    try {
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'startElementSelection'
      });
      window.close();
    } catch (error) {
      console.error('Error starting element selection:', error);
    }
  }

  async highlightMonitors() {
    if (!this.currentTab) return;

    try {
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'highlightMonitors'
      });
    } catch (error) {
      console.error('Error highlighting monitors:', error);
    }
  }

  openAllMonitors() {
    chrome.tabs.create({ url: 'monitors.html' });
  }

  async toggleMonitor(monitorId, enabled) {
    try {
      await chrome.runtime.sendMessage({
        action: 'toggleMonitor',
        monitorId: monitorId,
        enabled: enabled
      });

      // Update local state
      const monitor = this.monitors.find(m => m.id === monitorId);
      if (monitor) {
        monitor.enabled = enabled;
        this.updateMonitorsList();
      }
    } catch (error) {
      console.error('Error toggling monitor:', error);
    }
  }

  editMonitor(monitor) {
    this.currentEditingMonitor = monitor;
    
    document.getElementById('editInterval').value = monitor.interval;
    document.getElementById('editSelector').value = monitor.selector;
    document.getElementById('editEnabled').checked = monitor.enabled;
    
    this.openModal('editModal');
  }

  async saveMonitorEdit() {
    if (!this.currentEditingMonitor) return;

    const interval = parseInt(document.getElementById('editInterval').value);
    const enabled = document.getElementById('editEnabled').checked;

    try {
      await chrome.runtime.sendMessage({
        action: 'updateMonitor',
        monitorId: this.currentEditingMonitor.id,
        data: { interval, enabled }
      });

      // Update local state
      this.currentEditingMonitor.interval = interval;
      this.currentEditingMonitor.enabled = enabled;
      
      this.updateMonitorsList();
      this.closeModal('editModal');
    } catch (error) {
      console.error('Error updating monitor:', error);
    }
  }

  async deleteMonitor() {
    if (!this.currentEditingMonitor) return;

    if (!confirm('Are you sure you want to delete this monitor?')) return;

    try {
      await chrome.runtime.sendMessage({
        action: 'deleteMonitor',
        monitorId: this.currentEditingMonitor.id
      });

      // Update local state
      this.monitors = this.monitors.filter(m => m.id !== this.currentEditingMonitor.id);
      
      this.updateMonitorsList();
      this.updateMonitorCount();
      this.closeModal('editModal');
    } catch (error) {
      console.error('Error deleting monitor:', error);
    }
  }

  openSettings() {
    document.getElementById('defaultInterval').value = this.settings.defaultInterval;
    document.getElementById('enableNotifications').checked = this.settings.enableNotifications;
    document.getElementById('enableSound').checked = this.settings.enableSound;
    
    this.openModal('settingsModal');
  }

  async saveSettings() {
    this.settings.defaultInterval = parseInt(document.getElementById('defaultInterval').value);
    this.settings.enableNotifications = document.getElementById('enableNotifications').checked;
    this.settings.enableSound = document.getElementById('enableSound').checked;

    try {
      await chrome.storage.local.set({ settings: this.settings });
      this.closeModal('settingsModal');
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    this.currentEditingMonitor = null;
  }

  formatInterval(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  }

  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PageWatchPopup();
});