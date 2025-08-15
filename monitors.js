class MonitorsPage {
  constructor() {
    this.monitors = [];
    this.filteredMonitors = [];
    this.selectedMonitors = new Set();
    this.settings = {
      defaultInterval: 300,
      enableNotifications: true,
      enableSound: false,
      autoRefresh: true
    };
    this.currentEditingMonitor = null;
    this.refreshInterval = null;
    this.countdownInterval = null;
    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadMonitors();
    this.bindEvents();
    this.updateUI();
    this.startAutoRefresh();
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
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getMonitors'
      });

      if (response && response.monitors) {
        this.monitors = response.monitors;
      } else {
        this.monitors = [];
      }
      
      this.applyFilters();
    } catch (error) {
      console.error('Error loading monitors:', error);
      this.monitors = [];
    }
  }

  bindEvents() {
    // Header actions
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.refresh();
    });

    document.getElementById('settingsBtn').addEventListener('click', () => {
      this.openSettings();
    });

    // Filters
    document.getElementById('statusFilter').addEventListener('change', () => {
      this.applyFilters();
    });

    document.getElementById('siteFilter').addEventListener('change', () => {
      this.applyFilters();
    });

    document.getElementById('searchFilter').addEventListener('input', () => {
      this.applyFilters();
    });

    // Bulk actions
    document.getElementById('selectAllBtn').addEventListener('click', () => {
      this.toggleSelectAll();
    });

    document.getElementById('bulkEnableBtn').addEventListener('click', () => {
      this.bulkAction('enable');
    });

    document.getElementById('bulkDisableBtn').addEventListener('click', () => {
      this.bulkAction('disable');
    });

    document.getElementById('bulkDeleteBtn').addEventListener('click', () => {
      this.bulkAction('delete');
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

    document.getElementById('visitPage').addEventListener('click', () => {
      this.visitPage();
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
    this.updateStats();
    this.updateSiteFilter();
    this.updateMonitorsList();
    this.updateBulkActionButtons();
    this.startCountdownTimer();
    
    // Hide loading state
    document.getElementById('loadingState').style.display = 'none';
  }

  updateStats() {
    const totalMonitors = this.monitors.length;
    const activeMonitors = this.monitors.filter(m => m.enabled).length;
    const totalSites = new Set(this.monitors.map(m => this.getDomainFromUrl(m.url))).size;
    const totalChanges = this.monitors.reduce((sum, m) => sum + (m.changeCount || 0), 0);

    document.getElementById('totalMonitors').textContent = totalMonitors;
    document.getElementById('activeMonitors').textContent = activeMonitors;
    document.getElementById('totalSites').textContent = totalSites;
    document.getElementById('totalChanges').textContent = totalChanges;
  }

  updateSiteFilter() {
    const siteFilter = document.getElementById('siteFilter');
    const sites = [...new Set(this.monitors.map(m => this.getDomainFromUrl(m.url)))].sort();
    
    // Clear existing options except "All Websites"
    siteFilter.innerHTML = '<option value="all">All Websites</option>';
    
    sites.forEach(site => {
      const option = document.createElement('option');
      option.value = site;
      option.textContent = site;
      siteFilter.appendChild(option);
    });
  }

  applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    const siteFilter = document.getElementById('siteFilter').value;
    const searchFilter = document.getElementById('searchFilter').value.toLowerCase();

    this.filteredMonitors = this.monitors.filter(monitor => {
      // Status filter
      if (statusFilter === 'active' && !monitor.enabled) return false;
      if (statusFilter === 'disabled' && monitor.enabled) return false;

      // Site filter
      if (siteFilter !== 'all' && this.getDomainFromUrl(monitor.url) !== siteFilter) return false;

      // Search filter
      if (searchFilter) {
        const searchableText = [
          this.getDomainFromUrl(monitor.url),
          monitor.url,
          monitor.selector
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchFilter)) return false;
      }

      return true;
    });

    this.updateMonitorsList();
  }

  updateMonitorsList() {
    const container = document.getElementById('monitorsList');
    const emptyState = document.getElementById('emptyState');

    if (this.filteredMonitors.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = this.monitors.length === 0 ? 'block' : 'none';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    this.filteredMonitors.forEach(monitor => {
      const monitorEl = this.createMonitorElement(monitor);
      container.appendChild(monitorEl);
    });
  }

  createMonitorElement(monitor) {
    const domain = this.getDomainFromUrl(monitor.url);
    const selectorDisplay = this.formatSelector(monitor.selector);
    
    const div = document.createElement('div');
    div.className = 'monitor-item';
    if (this.selectedMonitors.has(monitor.id)) {
      div.classList.add('selected');
    }

    div.innerHTML = `
      <input type="checkbox" class="monitor-checkbox" data-id="${monitor.id}" ${this.selectedMonitors.has(monitor.id) ? 'checked' : ''}>
      <div class="monitor-info">
        <div class="monitor-header">
          <div class="monitor-main-info">
            <div class="monitor-domain">${domain}</div>
            <div class="monitor-url">${monitor.url}</div>
            <div class="monitor-selector">${selectorDisplay}</div>
          </div>
          <div class="monitor-actions">
            <button class="icon-btn toggle-btn" data-id="${monitor.id}" title="${monitor.enabled ? 'Disable' : 'Enable'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="${monitor.enabled ? 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' : 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z'}"/>
              </svg>
            </button>
            <button class="icon-btn edit-btn" data-id="${monitor.id}" title="Edit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
            <button class="icon-btn visit-btn" data-url="${monitor.url}" title="Visit Page">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="monitor-status-row">
          <div class="monitor-status">
            <div class="status-indicator ${monitor.enabled ? '' : 'disabled'}"></div>
            <span>${monitor.enabled ? 'Active' : 'Disabled'}</span>
          </div>
          <div class="monitor-interval">${this.formatInterval(monitor.interval)}</div>
        </div>
        <div class="monitor-stats">
          <span>Changes: ${monitor.changeCount || 0}</span>
          <span>Last check: ${monitor.lastCheck ? this.formatTime(monitor.lastCheck) : 'Never'}</span>
          <span class="next-check" data-monitor-id="${monitor.id}">Next check: ${this.formatNextCheck(monitor)}</span>
          <span>Created: ${this.formatTime(monitor.created)}</span>
        </div>
      </div>
    `;

    // Bind checkbox
    const checkbox = div.querySelector('.monitor-checkbox');
    checkbox.addEventListener('change', () => {
      this.toggleMonitorSelection(monitor.id, checkbox.checked);
    });

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

    // Bind visit button
    const visitBtn = div.querySelector('.visit-btn');
    visitBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: monitor.url });
    });

    return div;
  }

  toggleMonitorSelection(monitorId, selected) {
    if (selected) {
      this.selectedMonitors.add(monitorId);
    } else {
      this.selectedMonitors.delete(monitorId);
    }
    
    this.updateBulkActionButtons();
    this.updateMonitorsList();
  }

  toggleSelectAll() {
    const allSelected = this.selectedMonitors.size === this.filteredMonitors.length;
    
    if (allSelected) {
      this.selectedMonitors.clear();
    } else {
      this.filteredMonitors.forEach(monitor => {
        this.selectedMonitors.add(monitor.id);
      });
    }
    
    this.updateBulkActionButtons();
    this.updateMonitorsList();
  }

  updateBulkActionButtons() {
    const hasSelection = this.selectedMonitors.size > 0;
    
    document.getElementById('bulkEnableBtn').disabled = !hasSelection;
    document.getElementById('bulkDisableBtn').disabled = !hasSelection;
    document.getElementById('bulkDeleteBtn').disabled = !hasSelection;
    
    const selectAllBtn = document.getElementById('selectAllBtn');
    const allSelected = this.selectedMonitors.size === this.filteredMonitors.length && this.filteredMonitors.length > 0;
    selectAllBtn.textContent = allSelected ? 'Deselect All' : 'Select All';
  }

  async bulkAction(action) {
    if (this.selectedMonitors.size === 0) return;

    const selectedIds = [...this.selectedMonitors];

    if (action === 'delete') {
      if (!confirm(`Are you sure you want to delete ${selectedIds.length} monitor(s)?`)) {
        return;
      }
    }

    try {
      for (const monitorId of selectedIds) {
        switch (action) {
          case 'enable':
            await chrome.runtime.sendMessage({
              action: 'toggleMonitor',
              monitorId: monitorId,
              enabled: true
            });
            break;
          case 'disable':
            await chrome.runtime.sendMessage({
              action: 'toggleMonitor',
              monitorId: monitorId,
              enabled: false
            });
            break;
          case 'delete':
            await chrome.runtime.sendMessage({
              action: 'deleteMonitor',
              monitorId: monitorId
            });
            break;
        }
      }

      this.selectedMonitors.clear();
      await this.loadMonitors();
      this.updateUI();
    } catch (error) {
      console.error(`Error performing bulk ${action}:`, error);
    }
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
        this.applyFilters();
        this.updateStats();
      }
    } catch (error) {
      console.error('Error toggling monitor:', error);
    }
  }

  editMonitor(monitor) {
    this.currentEditingMonitor = monitor;
    
    document.getElementById('editUrl').textContent = monitor.url;
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
      
      this.applyFilters();
      this.updateStats();
      this.closeModal('editModal');
    } catch (error) {
      console.error('Error updating monitor:', error);
    }
  }

  visitPage() {
    if (this.currentEditingMonitor) {
      chrome.tabs.create({ url: this.currentEditingMonitor.url });
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
      this.selectedMonitors.delete(this.currentEditingMonitor.id);
      
      this.applyFilters();
      this.updateUI();
      this.closeModal('editModal');
    } catch (error) {
      console.error('Error deleting monitor:', error);
    }
  }

  async refresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.disabled = true;
    
    await this.loadMonitors();
    this.updateUI();
    
    setTimeout(() => {
      refreshBtn.disabled = false;
    }, 1000);
  }

  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    if (this.settings.autoRefresh) {
      this.refreshInterval = setInterval(() => {
        this.refresh();
      }, 30000); // Refresh every 30 seconds
    }
  }

  openSettings() {
    document.getElementById('defaultInterval').value = this.settings.defaultInterval;
    document.getElementById('enableNotifications').checked = this.settings.enableNotifications;
    document.getElementById('enableSound').checked = this.settings.enableSound;
    document.getElementById('autoRefresh').checked = this.settings.autoRefresh;
    
    this.openModal('settingsModal');
  }

  async saveSettings() {
    this.settings.defaultInterval = parseInt(document.getElementById('defaultInterval').value);
    this.settings.enableNotifications = document.getElementById('enableNotifications').checked;
    this.settings.enableSound = document.getElementById('enableSound').checked;
    this.settings.autoRefresh = document.getElementById('autoRefresh').checked;

    try {
      await chrome.storage.local.set({ settings: this.settings });
      this.startAutoRefresh(); // Restart auto-refresh with new settings
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

  getDomainFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return 'Unknown domain';
    }
  }

  formatSelector(selector) {
    if (selector.length > 60) {
      const parts = selector.split(' ');
      const lastPart = parts[parts.length - 1];
      
      if (lastPart.includes('.')) {
        const classes = lastPart.split('.');
        const meaningfulClasses = classes.filter(cls => 
          cls.length > 0 && cls.length < 20 && 
          !cls.match(/^(aem-|grid|column|offset|default|medium|small)/i)
        );
        
        if (meaningfulClasses.length > 0) {
          return `.${meaningfulClasses[0]}${meaningfulClasses.length > 1 ? '...' : ''}`;
        }
      }
      
      if (selector.includes('#')) {
        const idMatch = selector.match(/#([^.\s>+~[]+)/);
        if (idMatch) return `#${idMatch[1]}`;
      }
      
      const tagMatch = selector.match(/^([a-z]+)/i);
      if (tagMatch) return `<${tagMatch[1]}>`;
      
      return selector.substring(0, 40) + '...';
    }
    
    return selector;
  }

  formatInterval(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  }

  formatTime(timestamp) {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 2592000000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  }

  formatNextCheck(monitor) {
    if (!monitor.enabled) {
      return 'Disabled';
    }

    if (!monitor.nextCheck) {
      return 'Scheduled';
    }

    const now = Date.now();
    const timeUntilCheck = monitor.nextCheck - now;

    if (timeUntilCheck <= 0) {
      return 'Checking now...';
    }

    return this.formatCountdown(timeUntilCheck);
  }

  formatCountdown(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  startCountdownTimer() {
    // Clear existing timer
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    // Update countdown every second
    this.countdownInterval = setInterval(() => {
      this.updateCountdowns();
    }, 1000);

    // Update immediately
    this.updateCountdowns();
  }

  updateCountdowns() {
    const countdownElements = document.querySelectorAll('.next-check');
    
    countdownElements.forEach(element => {
      const monitorId = element.getAttribute('data-monitor-id');
      const monitor = this.monitors.find(m => m.id === monitorId);
      
      if (monitor) {
        const countdownText = this.formatNextCheck(monitor);
        element.textContent = `Next check: ${countdownText}`;
        
        // Add visual indicator for imminent checks
        const now = Date.now();
        const timeUntilCheck = monitor.nextCheck - now;
        
        if (timeUntilCheck <= 10000 && timeUntilCheck > 0) { // Last 10 seconds
          element.classList.add('countdown-urgent');
        } else {
          element.classList.remove('countdown-urgent');
        }
      }
    });
  }
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MonitorsPage();
});