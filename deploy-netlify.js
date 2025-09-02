#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description, optional = false) {
  try {
    log(`\n${description}...`, 'blue');
    execSync(command, { stdio: 'inherit' });
    log(`✅ ${description} completed`, 'green');
    return true;
  } catch (error) {
    if (optional) {
      log(`⚠️  ${description} skipped: ${error.message}`, 'yellow');
      return false;
    } else {
      log(`❌ ${description} failed: ${error.message}`, 'red');
      return false;
    }
  }
}

function isGitRepository() {
  try {
    execSync('git status', { stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

function initializeGit() {
  try {
    log('\n🔧 Initializing Git repository...', 'blue');
    execSync('git init', { stdio: 'inherit' });
    log('✅ Git repository initialized', 'green');
    
    // Add all files to git
    execSync('git add .', { stdio: 'inherit' });
    log('✅ Files staged for commit', 'green');
    
    // Make initial commit
    execSync('git commit -m "Initial commit - Task Management Pro"', { stdio: 'inherit' });
    log('✅ Initial commit created', 'green');
    
    return true;
  } catch (error) {
    log(`⚠️  Git initialization failed: ${error.message}`, 'yellow');
    return false;
  }
}

async function main() {
  log('🚀 Deploying Task Management Pro to Netlify', 'cyan');
  log('===========================================', 'cyan');

  // Check if we're in a git repository, initialize if not
  if (!isGitRepository()) {
    log('⚠️  Not in a git repository. Initializing...', 'yellow');
    const gitInitialized = initializeGit();
    if (!gitInitialized) {
      log('⚠️  Git initialization failed. Continuing without Git operations...', 'yellow');
    }
  }

  // Check if .env file exists
  if (!fs.existsSync('.env')) {
    log('⚠️  No .env file found. Running setup first...', 'yellow');
    if (!runCommand('npm run setup', 'Running setup script')) {
      process.exit(1);
    }
  }

  // Step 1: Fetch latest changes from GitHub (optional)
  if (isGitRepository()) {
    log('\n📥 Checking for Git remote and updates...', 'blue');
    
    // Check if we have a remote origin
    try {
      const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
      log(`Remote origin: ${remoteUrl}`, 'cyan');
      
      // Fetch and pull latest changes
      const fetchSuccess = runCommand('git fetch origin', 'Fetching from origin', true);
      if (fetchSuccess) {
        // Check if we're behind
        try {
          const status = execSync('git status -uno', { encoding: 'utf8' });
          if (status.includes('behind')) {
            log('📥 Pulling latest changes...', 'blue');
            runCommand('git pull origin main', 'Pulling latest changes', true);
          } else {
            log('✅ Already up to date', 'green');
          }
        } catch (error) {
          log('⚠️  Could not check git status. Attempting pull anyway...', 'yellow');
          runCommand('git pull origin main', 'Pulling latest changes', true);
        }
      }
    } catch (error) {
      log('⚠️  No remote origin found. Skipping fetch.', 'yellow');
    }
  } else {
    log('⚠️  No Git repository. Skipping Git operations.', 'yellow');
  }

  // Step 2: Install dependencies
  if (!runCommand('npm install', 'Installing dependencies')) {
    process.exit(1);
  }

  // Step 3: Build the project
  if (!runCommand('npm run build', 'Building project for production')) {
    process.exit(1);
  }

  // Step 4: Verify build output
  if (!fs.existsSync('dist')) {
    log('❌ Build failed - dist directory not found', 'red');
    process.exit(1);
  }

  log('✅ Build output verified', 'green');

  // Step 5: Commit and push changes (if any and if git is available)
  if (isGitRepository()) {
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        log('\n📝 Committing local changes...', 'blue');
        runCommand('git add .', 'Staging changes', true);
        runCommand('git commit -m "Deploy: Update build and configuration"', 'Committing changes', true);
        
        // Only push if we have a remote
        try {
          execSync('git remote get-url origin', { stdio: 'pipe' });
          runCommand('git push origin main', 'Pushing to GitHub', true);
        } catch (error) {
          log('⚠️  No remote origin configured. Skipping push.', 'yellow');
        }
      } else {
        log('✅ No local changes to commit', 'green');
      }
    } catch (error) {
      log('⚠️  Could not commit changes. Continuing with deployment...', 'yellow');
    }
  }

  // Step 6: Deployment instructions
  log('\n🎉 Ready for Netlify Deployment!', 'green');
  log('================================', 'green');
  
  log('\n📋 Deployment Options:', 'blue');
  log('1. 🔄 Automatic Deployment (if connected to GitHub):', 'yellow');
  if (isGitRepository()) {
    log('   - Your changes are committed locally', 'cyan');
    log('   - Push to GitHub: git remote add origin <your-repo-url>', 'cyan');
    log('   - Then: git push -u origin main', 'cyan');
    log('   - Connect your GitHub repo to Netlify for auto-deployment', 'cyan');
  } else {
    log('   - Initialize Git and push to GitHub first', 'cyan');
    log('   - Then connect your GitHub repo to Netlify', 'cyan');
  }
  
  log('\n2. 📤 Manual Deployment:', 'yellow');
  log('   - Go to https://netlify.com', 'cyan');
  log('   - Drag and drop the "dist" folder to deploy', 'cyan');
  log('   - Or use Netlify CLI: npx netlify deploy --prod --dir=dist', 'cyan');

  log('\n🔗 Useful Links:', 'blue');
  log('   - Netlify Dashboard: https://app.netlify.com/', 'cyan');
  log('   - GitHub: https://github.com (to create a repository)', 'cyan');
  
  log('\n🔑 Default Login Credentials:', 'blue');
  log('   - Email: admin@taskmanagementpro.com', 'cyan');
  log('   - Password: Admin123!', 'cyan');

  log('\n✨ Your Task Management Pro is ready to go live!', 'green');
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n\n👋 Deployment cancelled by user', 'yellow');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});

// Run the deployment
main().catch(error => {
  log(`\n❌ Deployment failed: ${error.message}`, 'red');
  process.exit(1);
});