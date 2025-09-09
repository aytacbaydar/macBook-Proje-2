# Overview

This is an Angular-based Turkish chemistry education platform called "Kimya Öğreniyorum" (I Learn Chemistry). The application serves both teachers (öğretmen) and students (öğrenci) with comprehensive features for online chemistry education, including exam management, homework tracking, topic analysis, attendance monitoring, and payment processing.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Angular 20.2.2 with TypeScript
- **Component Structure**: Hierarchical organization with separate modules for teachers and students
- **Styling**: SCSS with Bootstrap integration and custom component-specific styles
- **State Management**: Component-based state management with services for data flow
- **UI Components**: Custom components for dashboards, forms, modals, and data visualization

## Core Module Organization
- **Teacher Module** (`ogretmen-sayfasi`): Complete teacher dashboard with student management, exam creation, attendance tracking, and analytics
- **Student Module** (`ogrenci-sayfasi`): Student interface for exams, homework, progress tracking, and payments
- **Admin Module** (`yonetici-sayfasi`): Administrative functions for system management
- **Shared Components**: Reusable UI components and utilities

## Key Features Architecture
- **Exam System**: Comprehensive exam creation, taking, and results analysis with AI-powered question generation
- **Attendance Management**: Real-time attendance tracking with manual and automated recording
- **Payment System**: Student fee management with payment history and status tracking
- **Analytics Dashboard**: Performance metrics, topic analysis, and progress visualization
- **File Management**: PDF viewing, document uploads, and resource sharing
- **Communication**: Messaging system between teachers and students for question resolution

## Data Visualization
- **Chart.js**: Integration for displaying student performance metrics, attendance statistics, and progress charts
- **Custom Analytics**: Topic-wise performance analysis and success rate calculations
- **Export Functionality**: HTML to canvas conversion for report generation using html2canvas

## Authentication & Security
- **Role-based Access**: Separate interfaces and permissions for teachers, students, and administrators
- **JWT Token Management**: Secure authentication with token-based session handling
- **Data Encryption**: crypto-js implementation for sensitive data protection

## Build System
- **Angular CLI**: Standard Angular build pipeline with SCSS compilation
- **Asset Management**: Organized file structure with component-specific styles and assets
- **Error Handling**: Comprehensive TypeScript type checking and template validation

# External Dependencies

## Core Framework Dependencies
- **@angular/cli**: Version 20.2.2 for Angular development framework
- **TypeScript**: Strict typing and modern JavaScript features

## Visualization & UI Libraries
- **chart.js**: Version 4.5.0 for creating interactive charts and graphs
- **html2canvas**: Version 1.4.1 for converting HTML elements to canvas for export functionality
- **Bootstrap Icons**: Used throughout the interface for consistent iconography

## Security & Encryption
- **crypto-js**: Version 4.2.0 for client-side encryption and security operations

## Search & Analytics (Package Dependencies)
- **Algolia Client Libraries**: Multiple Algolia packages for search functionality and analytics
  - Client for A/B testing, analytics, and search operations
  - Support for browser, fetch, and Node.js environments

## Development Tools
- **SCSS/Sass**: Advanced styling with variables, mixins, and component-scoped styles
- **Angular Template System**: Two-way data binding, directives, and component communication

## Backend Integration
- **REST API Communication**: HTTP client for backend PHP server communication
- **File Upload Systems**: Multi-part form data handling for document and image uploads
- **Real-time Features**: WebSocket or polling-based real-time updates for attendance and messaging

## Browser Compatibility
- **Modern Browser Support**: ES6+ features with TypeScript compilation
- **Responsive Design**: Mobile-first approach with Bootstrap grid system
- **Cross-platform Compatibility**: Web-based application accessible across devices