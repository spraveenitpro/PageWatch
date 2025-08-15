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
      const currentUrl = window.location.href;
      console.log('Loading monitors for URL:', currentUrl);
      
      // Try to get monitors for current URL
      let response = await chrome.runtime.sendMessage({
        action: 'getMonitors',
        url: currentUrl
      });
      
      console.log('Monitors response for current URL:', response);
      
      // If no monitors found for exact URL, try getting all monitors and filter manually
      if (!response || !response.monitors || response.monitors.length === 0) {
        console.log('No monitors for exact URL, trying all monitors...');
        response = await chrome.runtime.sendMessage({
          action: 'getMonitors'
        });
        
        if (response && response.monitors) {
          // Filter monitors for current page (handle URL variations)
          this.monitors = response.monitors.filter(monitor => {
            return monitor.url === currentUrl || 
                   monitor.url.replace(/[#?].*$/, '') === currentUrl.replace(/[#?].*$/, '');
          });
          console.log('Filtered monitors for current page:', this.monitors);
        } else {
          this.monitors = [];
        }
      } else {
        this.monitors = response.monitors;
        console.log('Loaded monitors for current page:', this.monitors);
      }
      
      this.addMonitorIndicators();
    } catch (error) {
      console.error('Error loading monitors:', error);
      this.monitors = [];
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
          console.log('Highlighting monitors, count:', this.monitors.length);
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
    // Create a clean copy to work with (without extension classes)
    const cleanElement = element.cloneNode(false);
    
    if (cleanElement.id) {
      return `#${cleanElement.id}`;
    }

    if (cleanElement.className) {
      // Filter out PageWatch classes and get clean class list
      const classes = cleanElement.className.split(' ')
        .filter(c => c.trim() && !c.startsWith('pagewatch-'))
        .filter(c => c.trim());
      
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }

    const tagName = cleanElement.tagName.toLowerCase();
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

  async highlightMonitoredElements() {
    console.log('Starting highlight process, monitors:', this.monitors);
    
    // First refresh monitors from storage to make sure we have the latest
    await this.loadMonitors();
    
    if (this.monitors.length === 0) {
      console.log('No monitors found for this page');
      this.showMessage('No monitors found on this page', 'info');
      return;
    }

    let highlightedCount = 0;
    let fixedCount = 0;
    
    for (const [index, monitor] of this.monitors.entries()) {
      try {
        console.log(`Attempting to highlight monitor ${index + 1}:`, monitor.selector);
        let selector = monitor.selector;
        let element = document.querySelector(selector);
        
        // If element not found and selector contains pagewatch classes, try to fix it
        if (!element && selector.includes('pagewatch-')) {
          console.log('Selector contains pagewatch classes, trying to fix...');
          const fixedSelector = selector.replace(/\.pagewatch-[^\s.]*\.?/g, '').replace(/\.\./g, '.').replace(/\.$/, '');
          console.log('Fixed selector:', fixedSelector);
          
          element = document.querySelector(fixedSelector);
          if (element) {
            console.log('Fixed selector works! Updating monitor...');
            // Update the monitor with the correct selector
            try {
              await chrome.runtime.sendMessage({
                action: 'updateMonitor',
                monitorId: monitor.id,
                data: { selector: fixedSelector }
              });
              monitor.selector = fixedSelector; // Update local copy
              fixedCount++;
            } catch (updateError) {
              console.error('Error updating monitor selector:', updateError);
            }
          }
        }
        
        if (element) {
          console.log('Found element, highlighting...');
          // Use a more visible highlight
          element.style.outline = '3px solid #4CAF50';
          element.style.outlineOffset = '3px';
          element.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
          element.style.transition = 'all 0.3s ease';
          
          // Add a pulsing effect
          element.style.animation = 'pagewatch-pulse-highlight 2s ease-in-out';
          
          highlightedCount++;
          
          setTimeout(() => {
            if (element.parentNode) { // Check if element still exists
              element.style.outline = '';
              element.style.outlineOffset = '';
              element.style.backgroundColor = '';
              element.style.animation = '';
            }
          }, 3000);
        } else {
          console.warn('Element not found for selector:', monitor.selector);
        }
      } catch (error) {
        console.error('Error highlighting monitored element:', error, monitor);
      }
    }

    // Show feedback message
    let message = '';
    if (highlightedCount > 0) {
      message = `Highlighted ${highlightedCount} monitored element${highlightedCount > 1 ? 's' : ''}`;
      if (fixedCount > 0) {
        message += ` (fixed ${fixedCount} selector${fixedCount > 1 ? 's' : ''})`;
      }
      this.showMessage(message, 'success');
    } else {
      this.showMessage('No monitored elements found on this page', 'info');
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PageWatchContent();
  });
} else {
  new PageWatchContent();
}