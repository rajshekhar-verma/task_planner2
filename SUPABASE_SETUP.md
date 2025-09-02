# Supabase Setup Instructions

## Error: "Supabase account not connected"

If you're seeing this error, it means your Supabase project is not properly configured. Follow these steps:

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"
4. Choose your organization
5. Enter a project name (e.g., "Task Management Pro")
6. Enter a database password (save this securely)
7. Choose a region close to your users
8. Click "Create new project"

### 2. Get Your Project Credentials

1. Once your project is created, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

### 3. Configure Your Environment

1. Create a `.env` file in your project root (copy from `.env.example`)
2. Update the values:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 4. Run the Setup Script

```bash
npm run setup
```

This will guide you through the configuration process.

### 5. Apply Database Migrations

Once connected, the migrations will be applied automatically when you start the application.

## Exchange Rate API

The application uses a free exchange rate API (exchangerate.host) by default. No API key is required for basic usage.

If you want to use a premium service:
1. Sign up for an API key at your preferred exchange rate provider
2. Add it to your `.env` file:
   ```
   VITE_EXCHANGE_RATE_API_KEY=your-api-key-here
   ```
3. Update the exchange rate hook to use your preferred provider

## Troubleshooting

### Migration Errors
- Ensure your Supabase project is active and accessible
- Check that your API keys are correct
- Verify your internet connection
- Try refreshing your Supabase dashboard

### Connection Issues
- Double-check your project URL and API key
- Ensure there are no extra spaces in your `.env` file
- Restart your development server after updating `.env`

### Database Issues
- Check the Supabase dashboard for any error messages
- Ensure your database is not paused (free tier projects pause after inactivity)
- Verify you have the necessary permissions

## Need Help?

1. Check the Supabase documentation: [https://supabase.com/docs](https://supabase.com/docs)
2. Visit the Supabase community: [https://github.com/supabase/supabase/discussions](https://github.com/supabase/supabase/discussions)
3. Review the application logs in your browser's developer console