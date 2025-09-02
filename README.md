# Task Management Pro

A comprehensive task management system built with React, TypeScript, and Supabase. Features project management, task tracking, invoicing, receivables management, and financial analytics - all with Indian Rupee (₹) as the primary currency.

## Features

- **Project Management**: Create and manage projects with hourly or fixed rates
- **Task Tracking**: Full task lifecycle management with status tracking
- **Financial Management**: Receivables, invoicing, and revenue tracking in ₹
- **Tax Management**: Automated 15% tax calculations on active revenue
- **Analytics Dashboard**: Comprehensive reporting and insights
- **API Access**: Third-party API integration with secure key management
- **Screenshot Support**: Paste screenshots directly into task descriptions

## Currency

This application uses **Indian Rupees (₹)** as the primary currency throughout the system. All rates, amounts, and financial calculations are displayed in ₹.

## Quick Start

1. **Setup Environment**:
   ```bash
   npm run setup
   ```

2. **Start Development**:
   ```bash
   npm run dev
   ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

## Default Login

- **Email**: admin@taskmanagementpro.com
- **Password**: Admin123!

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Build Tool**: Vite

## Project Structure

```
src/
├── components/          # React components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and configurations
├── types/              # TypeScript type definitions
└── main.tsx           # Application entry point

supabase/
├── functions/          # Edge functions for API and email
└── migrations/         # Database schema migrations
```

## Key Features

### Financial Management
- All amounts displayed in Indian Rupees (₹)
- Project-specific conversion factors for custom rate adjustments
- Automated receivables generation from completed tasks
- Revenue tracking with payment history
- Tax calculations at 15% on active revenue

### Task Management
- Kanban-style status workflow (To Do → In Progress → Testing → Completed)
- Screenshot support with drag-drop and paste functionality
- Time tracking with estimated vs actual hours
- Archive/restore functionality
- Bulk operations and filtering

### API Integration
- Secure API key management
- Rate limiting and usage logging
- Third-party access to project and task data
- RESTful endpoints for external integrations

## Environment Variables

Required variables in `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Optional variables:
```
SMTP_HOSTNAME=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ALLOW_MARK_SENT_WITHOUT_EMAIL=true
```

## Database Schema

The application uses a comprehensive PostgreSQL schema with:
- User profiles and authentication
- Projects with flexible rate structures
- Tasks with full lifecycle tracking
- Financial records (receivables, revenue, invoices)
- Tax management and payments
- API key management with usage logging

## Deployment

The application is configured for easy deployment to:
- **Netlify** (recommended - includes automatic configuration)
- **Vercel**
- **Any static hosting service**

Run `npm run deploy` for guided deployment to Netlify.

## Security

- Row Level Security (RLS) enabled on all tables
- API key authentication with permission-based access
- Rate limiting on API endpoints
- Secure password hashing and JWT tokens
- CORS protection and security headers

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify Supabase project is active and properly configured
3. Ensure all environment variables are correctly set
4. Review the deployment documentation in `DEPLOYMENT_READY.md`

---

**Task Management Pro** - Professional task and project management with integrated financial tracking in Indian Rupees.