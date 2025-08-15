class PageWatchContent {
  constructor() {
    this.isSelecting = false;
    this.highlightedElement = null;
    this.monitors = [];
    this.init();
  }

  init() {
    this.loadMonitors();
    this.addMessageListener();
    this.addIndicators();
  }

  async loadMonitors() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getMonitors',
        url: window.location.href
      });
      
      if (response && response.monitors) {
        this.monitors = response.monitors;
        this.addMonitorIndicators();
      }
    } catch (error) {
      console.error('Error loading monitors:', error);
    }
  }

  addMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'ping':
          sendResponse({ success: true });
          break;

        case 'startElementSelection':
          this.startElementSelection();
          sendResponse({ success: true });
          break;

        case 'stopElementSelection':
          this.stopElementSelection();
          sendResponse({ success: true });
          break;

        case 'checkElement':
          const content = this.getElementContent(message.selector);
          sendResponse({ content });
          break;

        case 'highlightMonitors':
          this.highlightMonitoredElements();
          sendResponse({ success: true });
          break;
      }
      return true;
    });
  }

  startElementSelection() {
    if (this.isSelecting) return;

    this.isSelecting = true;
    this.showSelectionOverlay();
    
    document.addEventListener('mouseover', this.handleMouseOver.bind(this));
    document.addEventListener('mouseout', this.handleMouseOut.bind(this));
    document.addEventListener('click', this.handleElementClick.bind(this));
    document.addEventListener('keydown', this.handleKeyDown.bind(this));

    this.showSelectionNotification();
  }

  stopElementSelection() {
    if (!this.isSelecting) return;

    this.isSelecting = false;
    this.removeHighlight();
    this.hideSelectionOverlay();
    
    document.removeEventListener('mouseover', this.handleMouseOver.bind(this));
    document.removeEventListener('mouseout', this.handleMouseOut.bind(this));
    document.removeEventListener('click', this.handleElementClick.bind(this));
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));

    this.hideSelectionNotification();
  }

  handleMouseOver(event) {
    if (!this.isSelecting) return;
    
    event.preventDefault();
    this.highlightElement(event.target);
  }

  handleMouseOut(event) {
    if (!this.isSelecting) return;
    
    this.removeHighlight();
  }

  handleElementClick(event) {
    if (!this.isSelecting) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    this.selectElement(event.target);
  }

  handleKeyDown(event) {
    if (!this.isSelecting) return;
    
    if (event.key === 'Escape') {
      event.preventDefault();
      this.stopElementSelection();
    }
  }

  highlightElement(element) {
    this.removeHighlight();
    
    if (element && element !== document.body && element !== document.documentElement) {
      element.classList.add('pagewatch-highlight');
      this.highlightedElement = element;
      
      this.showElementInfo(element);
    }
  }

  removeHighlight() {
    if (this.highlightedElement) {
      this.highlightedElement.classList.remove('pagewatch-highlight');
      this.highlightedElement = null;
    }
    
    this.hideElementInfo();
  }

  async selectElement(element) {
    const selector = this.generateSelector(element);
    const content = this.getElementContent(selector);
    
    if (!selector || content === null) {
      this.showError('Unable to select this element');
      return;
    }

    try {
      const monitorId = await chrome.runtime.sendMessage({
        action: 'createMonitor',
        data: {
          url: window.location.href,
          selector: selector,
          content: content,
          interval: 300 // 5 minutes default
        }
      });

      if (monitorId) {
        this.showSuccess('Element is now being monitored');
        this.stopElementSelection();
        this.loadMonitors(); // Refresh monitors
      }
    } catch (error) {
      console.error('Error creating monitor:', error);
      this.showError('Failed to create monitor');
    }
  }

  generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }

    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }

    const tagName = element.tagName.toLowerCase();
    const parent = element.parentNode;
    
    if (!parent || parent === document) {
      return tagName;
    }

    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    
    if (siblings.filter(s => s.tagName === element.tagName).length === 1) {
      return `${this.generateSelector(parent)} > ${tagName}`;
    }

    return `${this.generateSelector(parent)} > ${tagName}:nth-child(${index + 1})`;
  }

  getElementContent(selector) {
    try {
      const element = document.querySelector(selector);
      if (!element) return null;
      
      return element.textContent.trim() || element.innerHTML.trim();
    } catch (error) {
      console.error('Error getting element content:', error);
      return null;
    }
  }

  addMonitorIndicators() {
    this.monitors.forEach(monitor => {
      try {
        const element = document.querySelector(monitor.selector);
        if (element && !element.classList.contains('pagewatch-monitored')) {
          element.classList.add('pagewatch-monitored');
          
          const indicator = document.createElement('div');
          indicator.className = 'pagewatch-indicator';
          indicator.title = `PageWatch: Monitoring for changes (${monitor.id})`;
          element.style.position = 'relative';
          element.appendChild(indicator);
        }
      } catch (error) {
        console.error('Error adding monitor indicator:', error);
      }
    });
  }

  addIndicators() {
    if (document.getElementById('pagewatch-indicators')) return;

    const indicatorContainer = document.createElement('div');
    indicatorContainer.id = 'pagewatch-indicators';
    indicatorContainer.className = 'pagewatch-indicators';
    document.body.appendChild(indicatorContainer);
  }

  showSelectionOverlay() {
    if (document.getElementById('pagewatch-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pagewatch-overlay';
    overlay.className = 'pagewatch-overlay';
    document.body.appendChild(overlay);
  }

  hideSelectionOverlay() {
    const overlay = document.getElementById('pagewatch-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  showSelectionNotification() {
    const notification = document.createElement('div');
    notification.id = 'pagewatch-selection-notification';
    notification.className = 'pagewatch-notification';
    notification.innerHTML = `
      <div class="pagewatch-notification-content">
        <strong>PageWatch Selection Mode</strong>
        <p>Click on any element to monitor it for changes</p>
        <p>Press <kbd>Esc</kbd> to cancel</p>
      </div>
    `;
    document.body.appendChild(notification);
  }

  hideSelectionNotification() {
    const notification = document.getElementById('pagewatch-selection-notification');
    if (notification) {
      notification.remove();
    }
  }

  showElementInfo(element) {
    this.hideElementInfo();
    
    const info = document.createElement('div');
    info.id = 'pagewatch-element-info';
    info.className = 'pagewatch-element-info';
    info.innerHTML = `
      <div class="pagewatch-info-content">
        <strong>${element.tagName.toLowerCase()}</strong>
        ${element.id ? `#${element.id}` : ''}
        ${element.className ? `.${element.className.split(' ').join('.')}` : ''}
      </div>
    `;
    
    const rect = element.getBoundingClientRect();
    info.style.left = `${rect.left + window.scrollX}px`;
    info.style.top = `${rect.top + window.scrollY - 40}px`;
    
    document.body.appendChild(info);
  }

  hideElementInfo() {
    const info = document.getElementById('pagewatch-element-info');
    if (info) {
      info.remove();
    }
  }

  showSuccess(message) {
    this.showMessage(message, 'success');
  }

  showError(message) {
    this.showMessage(message, 'error');
  }

  showMessage(message, type = 'info') {
    const messageEl = document.createElement('div');
    messageEl.className = `pagewatch-message pagewatch-message-${type}`;
    messageEl.textContent = message;
    messageEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 10001;
      font-family: Arial, sans-serif;
      font-size: 14px;
    `;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.remove();
      }
    }, 3000);
  }

  highlightMonitoredElements() {
    this.monitors.forEach(monitor => {
      try {
        const element = document.querySelector(monitor.selector);
        if (element) {
          element.style.outline = '2px solid #4CAF50';
          element.style.outlineOffset = '2px';
          
          setTimeout(() => {
            element.style.outline = '';
            element.style.outlineOffset = '';
          }, 2000);
        }
      } catch (error) {
        console.error('Error highlighting monitored element:', error);
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PageWatchContent();
  });
} else {
  new PageWatchContent();
}