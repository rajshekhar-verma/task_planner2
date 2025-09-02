#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function checkPrerequisites() {
  log('\n🔍 Checking prerequisites...', 'blue');
  
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    log(`✅ Node.js version: ${nodeVersion}`, 'green');
    
    if (majorVersion < 16) {
      throw new Error('Node.js version 16 or higher is required');
    }
    
    // Check npm
    let npmVersion;
    try {
      npmVersion = execSync('npm --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
      log(`✅ npm version: ${npmVersion}`, 'green');
    } catch (error) {
      throw new Error('npm is not installed or not accessible');
    }
    
    // Check if we're in the right directory
    if (!fs.existsSync('package.json')) {
      throw new Error('package.json not found. Please run this script from the project root directory.');
    }
    
    // Check package.json structure
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (!packageJson.scripts || !packageJson.scripts.build) {
        log('⚠️  Warning: No build script found in package.json', 'yellow');
      }
    } catch (error) {
      throw new Error('Invalid package.json file');
    }
    
    log('✅ All prerequisites met!', 'green');
    return true;
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    return false;
  }
}

async function createEnvFile(supabaseUrl, supabaseKey) {
  const envContent = `# Supabase Configuration
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseKey}

# Environment Settings
VITE_APP_ENV=production
VITE_APP_NAME=Task Management Pro
VITE_DEBUG_MODE=false
VITE_ENABLE_LOGGING=false
`;

  try {
    // Backup existing .env if it exists
    if (fs.existsSync('.env')) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync('.env', `.env.backup.${timestamp}`);
      log('📄 Backed up existing .env file', 'yellow');
    }
    
    fs.writeFileSync('.env', envContent);
    log('✅ Created .env file', 'green');
  } catch (error) {
    throw new Error(`Failed to create .env file: ${error.message}`);
  }
}

function validateSupabaseUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('supabase.co')) {
      throw new Error('URL must be a valid Supabase URL (should contain supabase.co)');
    }
    return true;
  } catch (error) {
    throw new Error('Invalid Supabase URL format');
  }
}

function validateSupabaseKey(key) {
  if (!key || key.length < 20) {
    throw new Error('Supabase key appears to be invalid (too short)');
  }
  if (!key.startsWith('eyJ')) {
    throw new Error('Supabase anon key should start with "eyJ"');
  }
  return true;
}

async function setupSupabase() {
  log('\n🗄️  Setting up Supabase...', 'blue');
  
  log('\nTo get your Supabase credentials:', 'yellow');
  log('1. Go to https://supabase.com and sign in', 'yellow');
  log('2. Select your project (or create a new one)', 'yellow');
  log('3. Go to Settings (gear icon) → API', 'yellow');
  log('4. Copy the Project URL and anon public key', 'yellow');
  
  let supabaseUrl, supabaseKey;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      supabaseUrl = (await question('\nEnter your Supabase Project URL: ')).trim();
      supabaseKey = (await question('Enter your Supabase anon public key: ')).trim();
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Both Supabase URL and key are required');
      }
      
      validateSupabaseUrl(supabaseUrl);
      validateSupabaseKey(supabaseKey);
      
      break;
    } catch (error) {
      attempts++;
      log(`❌ ${error.message}`, 'red');
      if (attempts >= maxAttempts) {
        throw new Error('Max attempts reached. Please check your Supabase credentials.');
      }
      log(`Please try again (${attempts}/${maxAttempts})...`, 'yellow');
    }
  }
  
  await createEnvFile(supabaseUrl, supabaseKey);
  
  return { supabaseUrl, supabaseKey };
}

async function buildProject() {
  log('\n🔨 Building the project...', 'blue');
  
  try {
    log('Installing dependencies...', 'yellow');
    execSync('npm install', { 
      stdio: 'inherit',
      cwd: process.cwd(),
      timeout: 300000 // 5 minutes timeout
    });
    
    // Check if build script exists
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    if (!packageJson.scripts || !packageJson.scripts.build) {
      log('⚠️  No build script found, skipping build step', 'yellow');
      return true;
    }
    
    log('Building for production...', 'yellow');
    execSync('npm run build', { 
      stdio: 'inherit',
      cwd: process.cwd(),
      timeout: 600000 // 10 minutes timeout
    });
    
    // Verify build output
    if (!fs.existsSync('dist') && !fs.existsSync('build')) {
      log('⚠️  Build completed but no dist/build folder found', 'yellow');
    }
    
    log('✅ Project built successfully!', 'green');
    return true;
  } catch (error) {
    if (error.signal === 'SIGTERM') {
      throw new Error('Build process timed out');
    }
    log(`❌ Build failed: ${error.message}`, 'red');
    log('You can try building manually later with: npm run build', 'yellow');
    return false;
  }
}

async function generateNetlifyConfig(supabaseUrl, supabaseKey) {
  const netlifyToml = `[build]
  publish = "dist"
  command = "npm ci && npm run build"

[build.environment]
  NODE_VERSION = "18"
  NPM_VERSION = "9"
  VITE_SUPABASE_URL = "${supabaseUrl}"
  VITE_SUPABASE_ANON_KEY = "${supabaseKey}"

# Security headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "SAMEORIGIN"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co;"

# Client-side routing support
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

# Cache static assets
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

# Cache control for HTML files
[[headers]]
  for = "/*.html"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
`;

  try {
    // Backup existing netlify.toml if it exists
    if (fs.existsSync('netlify.toml')) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      fs.copyFileSync('netlify.toml', `netlify.toml.backup.${timestamp}`);
      log('📄 Backed up existing netlify.toml', 'yellow');
    }
    
    fs.writeFileSync('netlify.toml', netlifyToml);
    log('✅ Created/updated netlify.toml with your credentials', 'green');
  } catch (error) {
    throw new Error(`Failed to create netlify.toml: ${error.message}`);
  }
}

async function createDeploymentInstructions(supabaseUrl) {
  const instructions = `# 🚀 Deployment Instructions

## Your project is now configured and ready to deploy!

### Option 1: Deploy to Netlify (Recommended)

1. **Push to GitHub:**
   \`\`\`bash
   git add .
   git commit -m "Configure project for deployment"
   git push origin main
   \`\`\`

2. **Deploy to Netlify:**
   - Go to https://netlify.com
   - Click "New site from Git"
   - Connect your GitHub repository
   - Netlify will automatically use the settings from netlify.toml
   - Your site will be live in 2-3 minutes!

### Option 2: Manual Deployment

If you prefer to set environment variables manually in Netlify:

1. Go to your Netlify site dashboard
2. Site settings → Environment variables
3. Add these variables:
   - \`VITE_SUPABASE_URL\`: ${supabaseUrl}
   - \`VITE_SUPABASE_ANON_KEY\`: [your anon key]

### Option 3: Deploy to Other Platforms

Your \`dist\` folder contains the built application. You can upload it to:
- Vercel
- GitHub Pages
- Any static hosting service

### Default Login Credentials

Once deployed, you can log in with:
- **Email:** admin@taskmanagementpro.com
- **Password:** Admin123!

### Next Steps

1. **Set up your database:** The app will guide you through creating the initial superuser
2. **Create projects:** Add your first project in the admin panel
3. **Invite team members:** Add users and assign them to projects
4. **Start managing tasks:** Create and track tasks with the built-in workflow

### Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify your Supabase project is active
3. Ensure all environment variables are set correctly

Your Task Management Pro is ready to go! 🎉
`;

  try {
    fs.writeFileSync('DEPLOYMENT_READY.md', instructions);
    log('✅ Created deployment instructions', 'green');
  } catch (error) {
    log(`⚠️  Could not create deployment instructions: ${error.message}`, 'yellow');
  }
}

async function createQuickStart() {
  const quickStart = `#!/bin/bash

# Quick Start Script for Task Management Pro
echo "🚀 Starting Task Management Pro..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run 'node setup.js' first."
    exit 1
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start development server
echo "🌟 Starting development server..."
npm run dev
`;

  try {
    fs.writeFileSync('start.sh', quickStart);
    
    // Make it executable on Unix systems
    try {
      if (process.platform !== 'win32') {
        fs.chmodSync('start.sh', '755');
      }
    } catch (error) {
      // Ignore chmod errors on Windows or permission issues
    }
    
    log('✅ Created quick start script', 'green');
  } catch (error) {
    log(`⚠️  Could not create quick start script: ${error.message}`, 'yellow');
  }
}

async function main() {
  try {
    log('🎯 Task Management Pro Setup Script', 'cyan');
    log('=====================================', 'cyan');
    
    // Check prerequisites
    const prereqsOk = await checkPrerequisites();
    if (!prereqsOk) {
      process.exit(1);
    }
    
    // Setup Supabase
    const { supabaseUrl, supabaseKey } = await setupSupabase();
    
    // Build project
    const buildOk = await buildProject();
    if (!buildOk) {
      log('\n⚠️  Build failed, but configuration is complete.', 'yellow');
      log('You can try building manually with: npm run build', 'yellow');
    }
    
    // Generate Netlify config
    await generateNetlifyConfig(supabaseUrl, supabaseKey);
    
    // Create deployment instructions
    await createDeploymentInstructions(supabaseUrl);
    
    // Create quick start script
    await createQuickStart();
    
    // Success message
    log('\n🎉 Setup Complete!', 'green');
    log('==================', 'green');
    log('\n✅ Environment configured', 'green');
    if (buildOk) {
      log('✅ Project built', 'green');
    }
    log('✅ Netlify configuration updated', 'green');
    log('✅ Deployment instructions created', 'green');
    
    log('\n📋 Next Steps:', 'blue');
    log('1. Read DEPLOYMENT_READY.md for deployment instructions', 'yellow');
    log('2. Test locally with: npm run dev', 'yellow');
    log('3. Deploy to Netlify by pushing to GitHub', 'yellow');
    
    log('\n🚀 Your Task Management Pro is ready to deploy!', 'cyan');
    
  } catch (error) {
    log(`\n❌ Setup failed: ${error.message}`, 'red');
    log('\nPlease check the error above and try again.', 'yellow');
    
    // Provide helpful hints based on common errors
    if (error.message.includes('npm')) {
      log('\n💡 Hint: Make sure npm is installed and accessible', 'cyan');
    } else if (error.message.includes('package.json')) {
      log('\n💡 Hint: Make sure you are in the correct project directory', 'cyan');
    } else if (error.message.includes('Supabase')) {
      log('\n💡 Hint: Double-check your Supabase URL and API key', 'cyan');
    }
    
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n\n👋 Setup cancelled by user', 'yellow');
  rl.close();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  rl.close();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log(`\n❌ Unhandled promise rejection: ${reason}`, 'red');
  rl.close();
  process.exit(1);
});

// Run the setup
main();