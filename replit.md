# Overview

This is an Angular-based Turkish chemistry education platform called "Kimya Öğreniyorum" (I Learn Chemistry). The application serves both teachers (öğretmen) and students (öğrenci) with comprehensive features for online chemistry education, including exam management, homework tracking, topic analysis, attendance monitoring, and payment processing.

**🎉 LATEST UPDATE (October 2025):** Project successfully configured for Replit environment. Angular frontend running on port 5000 with proper host configuration.

# User Preferences

Preferred communication style: Simple, everyday language (Turkish).

# Replit Environment Setup

## Current Configuration (October 2025)

### Frontend (Angular)
- **Status**: ✅ Fully configured and running
- **Framework**: Angular 20.3.1 with TypeScript
- **Port**: 5000 (configured with 0.0.0.0 host)
- **Host Configuration**: Properly configured with `allowedHosts: ["all"]` for Replit proxy
- **Analytics**: Disabled
- **Dependencies**: Installed with `--legacy-peer-deps` due to peer dependency conflicts
- **Workflow**: "Angular Server" - runs `ng serve` with proper host settings

### Backend (PHP)
- **Status**: ⚠️ Not configured in Replit environment
- **Expected Port**: 8080 (based on proxy.conf.json)
- **Database**: Requires MySQL database named 'ogrenciData'
- **Note**: Backend API endpoints are referenced in the Angular app but not currently running
- **API Prefix**: `/server/api/`

### Known Issues
- CSS files from old template in `public` folder may cause 404s but don't affect functionality
- Backend PHP server needs MySQL database configuration to run
- crypto-js dependency resolution warning (not blocking)

## Project Structure
- `/kimyaogreniyorum/` - Main Angular application
- `/kimyaogreniyorum/src/` - Angular source code
- `/kimyaogreniyorum/public/` - Static assets and CSS files
- `/server/` - PHP backend (not configured in Replit)
- `/server/api/` - PHP API endpoints

# System Architecture

## Frontend Architecture
- **Framework**: Angular 20.3.1 with TypeScript
- **Mobile Integration**: Capacitor 7.x with iOS/Android platforms
- **PWA Support**: Service Worker enabled for offline capabilities
- **Component Structure**: Hierarchical organization with separate modules for teachers and students
- **Styling**: SCSS with Bootstrap integration and custom component-specific styles
- **State Management**: Component-based state management with services for data flow
- **UI Components**: Custom components for dashboards, forms, modals, and data visualization

## Mobile Application Features
- **Cross-Platform**: iOS and Android native app capabilities via Capacitor
- **Push Notifications**: Student announcement system with permission management
- **Native Features**: File system access, secure storage, app state management
- **Offline PDF Reading**: Local storage and viewing of educational materials
- **PWA Installation**: Can be installed to home screen as progressive web app

## Core Module Organization
- **Teacher Module** (`ogretmen-sayfasi`): Complete teacher dashboard with student management, exam creation, attendance tracking, and analytics
- **Student Module** (`ogrenci-sayfasi`): Student interface for exams, homework, progress tracking, and payments
- **Admin Module** (`yonetici-sayfasi`): Administrative functions for system management
- **Shared Components**: Reusable UI components and utilities
- **Mobile Services**: Native features integration and push notification management

## Key Features Architecture
- **Exam System**: Comprehensive exam creation, taking, and results analysis with AI-powered question generation
- **Attendance Management**: Real-time attendance tracking with manual and automated recording
- **Payment System**: Student fee management with payment history and status tracking
- **Analytics Dashboard**: Performance metrics, topic analysis, and progress visualization
- **File Management**: PDF viewing with iOS Safari compatibility, document uploads, and resource sharing
- **Communication**: Messaging system between teachers and students for question resolution
- **Mobile Notifications**: Push notification system for announcements and updates

## Data Visualization
- **Chart.js**: Integration for displaying student performance metrics, attendance statistics, and progress charts
- **Custom Analytics**: Topic-wise performance analysis and success rate calculations
- **Export Functionality**: HTML to canvas conversion for report generation using html2canvas

## Authentication & Security
- **Role-based Access**: Separate interfaces and permissions for teachers, students, and administrators
- **JWT Token Management**: Secure authentication with token-based session handling
- **Data Encryption**: crypto-js implementation for sensitive data protection
- **Native Secure Storage**: Platform-specific secure storage for mobile authentication tokens

## Build System
- **Angular CLI**: Standard Angular build pipeline with SCSS compilation
- **Capacitor Build**: Mobile app compilation and native platform integration
- **Asset Management**: Organized file structure with component-specific styles and assets
- **Error Handling**: Comprehensive TypeScript type checking and template validation

# External Dependencies

## Core Framework Dependencies
- **@angular/cli**: Version 20.3.1 for Angular development framework
- **@angular/service-worker**: PWA and offline capabilities
- **TypeScript**: Strict typing and modern JavaScript features

## Mobile Development
- **@capacitor/core**: Core Capacitor functionality
- **@capacitor/cli**: Capacitor command line tools
- **@capacitor/ios**: iOS platform integration
- **@capacitor/android**: Android platform integration

## Native Mobile Plugins
- **@capacitor/push-notifications**: Version 7.0.3 for push notification management
- **@capacitor/preferences**: Version 7.0.2 for secure data storage
- **@capacitor/filesystem**: Version 7.1.4 for file operations
- **@capacitor/app**: Version 7.1.0 for app state management

## Visualization & UI Libraries
- **chart.js**: Version 4.5.0 for creating interactive charts and graphs
- **html2canvas**: Version 1.4.1 for converting HTML elements to canvas for export functionality
- **Bootstrap**: Version 5.3.6 for responsive UI framework
- **Bootstrap Icons**: Used throughout the interface for consistent iconography

## Security & Encryption
- **crypto-js**: Version 4.2.0 for client-side encryption and security operations

## Development Tools
- **SCSS/Sass**: Advanced styling with variables, mixins, and component-scoped styles
- **Angular Template System**: Two-way data binding, directives, and component communication

## Backend Integration
- **REST API Communication**: HTTP client for backend PHP server communication
- **Proxy Configuration**: Angular proxy configured to forward `/dosyalar/*` requests to localhost:8080
- **File Upload Systems**: Multi-part form data handling for document and image uploads

## Browser Compatibility
- **Modern Browser Support**: ES6+ features with TypeScript compilation
- **Responsive Design**: Mobile-first approach with Bootstrap grid system
- **Cross-platform Compatibility**: Web-based application accessible across devices
- **PWA Support**: Service worker for offline functionality and app-like experience

# Recent Changes (October 2025)

## Replit Environment Configuration
- ✅ **Angular Installation**: All dependencies installed with legacy peer deps flag
- ✅ **Workflow Configuration**: Angular server configured to run on port 5000
- ✅ **Host Settings**: Properly configured for Replit's proxy environment
- ✅ **Analytics Disabled**: Angular analytics disabled for Replit environment
- ✅ **Frontend Running**: Application successfully loads and displays

## Technical Achievements
- ✅ **Build System**: Angular compilation working with all mobile dependencies
- ✅ **Port Configuration**: Frontend properly bound to 0.0.0.0:5000
- ✅ **Proxy Support**: allowedHosts configured to accept Replit's iframe proxy

## Pending Configuration
- 🔧 **Backend Setup**: PHP backend server not configured (requires MySQL database)
- 🔧 **Database**: MySQL database 'ogrenciData' needs to be set up for full functionality
- 🔧 **API Endpoints**: Backend API calls will fail without PHP server running

## Mobile App Status
- **Web Version**: Fully functional with PWA capabilities - can be installed to home screen
- **Native Apps**: Infrastructure ready - requires Firebase configuration for App Store/Google Play deployment
- **Push Notifications**: Service layer complete - requires Firebase/APNs setup for production
- **File Operations**: PDF downloading and offline reading infrastructure in place

# Development Notes

## Running the Application
- Frontend is automatically started via the "Angular Server" workflow
- Access the application through the Replit webview
- Backend API calls will fail without PHP server and database configuration

## Future Enhancements
- Configure MySQL database for backend functionality
- Set up PHP development server on port 8080
- Implement environment-specific configuration for API endpoints
- Consider using Replit's built-in database instead of MySQL for easier setup
