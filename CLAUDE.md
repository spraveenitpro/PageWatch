# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension project for monitoring webpage changes. The extension allows users to select specific sections of webpages and receive notifications when those sections change.

## Project Structure

This is a new project with specifications defined in `SPECS.md`. The Chrome extension should be built using:

- **Manifest V3** structure with standard Chrome extension files
- **Content Scripts** for DOM interaction and element selection
- **Background Service Worker** for periodic monitoring
- **Popup Interface** for managing monitored sections
- **Chrome Storage API** for persisting configurations
- **Chrome Notifications API** for user alerts

## Development Commands

Since this is a new project, standard Chrome extension development commands will need to be established:

- Extension loading: Load unpacked extension in Chrome developer mode
- Development: Use Chrome DevTools for debugging content scripts and popup
- Testing: Manual testing in Chrome with various websites

## Key Technical Requirements

- Use Manifest V3 specification for all Chrome extension APIs
- Implement proper permissions for storage, notifications, and active tab access
- Content scripts must handle dynamic element selection with visual feedback
- Background worker should efficiently manage periodic checks without excessive resource usage
- Storage schema should support multiple monitored sections per domain

## Architecture Notes

- **Element Selection**: Implement hover highlighting and click-to-select functionality in content scripts
- **Change Detection**: Compare DOM content/structure between monitoring intervals
- **Notification System**: Use Chrome notifications API with appropriate user controls
- **Data Persistence**: Store monitoring configurations per URL/domain using Chrome Storage API
- **User Interface**: Popup should provide clear management of active monitors with add/remove functionality

## Development Setup

This project will require:
1. Chrome browser with Developer Mode enabled
2. Standard web development tools (HTML, CSS, JavaScript)
3. Chrome Extension APIs documentation for Manifest V3
4. Testing across different websites to ensure compatibility