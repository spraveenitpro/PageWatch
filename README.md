# PageWatch - Webpage Change Monitor

A Chrome extension that monitors specific sections of webpages for changes and notifies users when content updates.

## Features

- **Element Selection**: Click on any webpage element to monitor it for changes
- **Real-time Monitoring**: Configurable check intervals from 1 minute to 1 hour
- **Smart Notifications**: Get notified when monitored content changes
- **Local Storage**: All data stored locally on your device
- **Visual Indicators**: See which elements are being monitored
- **Easy Management**: Simple popup interface to manage all monitors

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The PageWatch extension should now appear in your extensions list

## Usage

### Adding Monitors

1. Navigate to any webpage
2. Click the PageWatch extension icon
3. Click "Add Monitor" button
4. Click on any element on the page you want to monitor
5. The element will be added to your monitors list

### Managing Monitors

- **View Monitors**: Click the extension icon to see all monitors for the current page
- **Edit Monitors**: Click the edit button next to any monitor to change settings
- **Toggle Monitors**: Click the toggle button to enable/disable monitoring
- **Delete Monitors**: Use the edit dialog to delete unwanted monitors

### Settings

- **Check Interval**: Configure how often to check for changes
- **Notifications**: Enable/disable browser notifications
- **Sound Alerts**: Optional sound notifications (coming soon)

## Technical Details

### Architecture

- **Manifest V3**: Uses the latest Chrome extension architecture
- **Background Service Worker**: Handles periodic monitoring and notifications
- **Content Scripts**: Manages element selection and DOM interaction
- **Chrome Storage API**: Stores all monitor configurations locally
- **Chrome Notifications API**: Displays change notifications

### File Structure

```
pagewatch/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for monitoring
├── content.js            # Content script for element selection
├── content.css           # Styles for content script UI
├── popup.html            # Extension popup interface
├── popup.css             # Popup styles
├── popup.js              # Popup functionality
├── icons/                # Extension icons
├── SPECS.md              # Project specifications
├── CLAUDE.md             # Development guidance
└── README.md             # This file
```

### Permissions

- `storage`: Store monitor configurations
- `notifications`: Show change notifications
- `activeTab`: Access current tab content
- `scripting`: Inject content scripts
- `host_permissions`: Monitor any website

## Development

### Local Development

1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh button on the PageWatch extension
4. Test your changes on any webpage

### Testing

- Test element selection on various websites
- Verify notifications work properly
- Check that monitors persist across browser sessions
- Test with different check intervals

## Privacy

- All data is stored locally in your browser
- No data is transmitted to external servers
- Monitor configurations are private to your device
- No tracking or analytics are collected

## Troubleshooting

### Common Issues

1. **Elements not selectable**: Some elements may be protected by the website
2. **Notifications not showing**: Check Chrome notification permissions
3. **High CPU usage**: Reduce check frequency for better performance
4. **Extension not loading**: Ensure all files are in the correct directory

### Debug Mode

1. Open Chrome DevTools
2. Go to the "Extensions" panel
3. Find PageWatch and click "background page" or "service worker"
4. Check the console for any error messages

## License

This project is open source and available under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and feature requests, please create an issue in the project repository.