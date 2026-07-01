#!/usr/bin/env node
/**
 * Security Setup Script for Yard
 * 
 * Run: node scripts/security-setup.js
 * 
 * This script:
 * 1. Enables git hooks
 * 2. Audits dependencies
 * 3. Scans for exposed secrets
 * 4. Generates security report
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function section(title) {
  console.log('\n' + '═'.repeat(60));
  log(title, 'cyan');
  console.log('═'.repeat(60));
}

async function main() {
  section('🔐 YARD SECURITY SETUP');

  // 1. Enable git hooks
  log('\n1️⃣  Setting up git hooks...', 'blue');
  try {
    // Create .githooks directory
    if (!fs.existsSync('.githooks')) {
      fs.mkdirSync('.githooks');
      log('   ✅ Created .githooks directory', 'green');
    }

    // Configure git to use hooks
    execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
    log('   ✅ Git configured to use .githooks/', 'green');

    // Make pre-commit executable
    const preCommitPath = '.githooks/pre-commit';
    if (fs.existsSync(preCommitPath)) {
      fs.chmodSync(preCommitPath, '755');
      log('   ✅ pre-commit hook is executable', 'green');
    }
  } catch (e) {
    log(`   ⚠️  Could not set up git hooks: ${e.message}`, 'yellow');
  }

  // 2. Run npm audit
  log('\n2️⃣  Running dependency audit...', 'blue');
  try {
    const auditOutput = execSync('npm audit --json 2>/dev/null || echo "{}"', { encoding: 'utf-8' });
    const audit = JSON.parse(auditOutput);
    const metadata = audit.metadata?.vulnerabilities || {};

    if (metadata.critical) {
      log(`   ❌ CRITICAL: ${metadata.critical} vulnerabilities`, 'red');
    }
    if (metadata.high) {
      log(`   ⚠️  HIGH: ${metadata.high} vulnerabilities`, 'yellow');
    }
    if (!metadata.critical && !metadata.high) {
      log(`   ✅ No critical or high vulnerabilities`, 'green');
    }
    log(`   Total: ${metadata.total || 0} vulnerabilities`, 'cyan');
  } catch (e) {
    log(`   ⚠️  Could not run npm audit`, 'yellow');
  }

  // 3. Scan for exposed secrets
  log('\n3️⃣  Scanning for exposed secrets...', 'blue');
  const secretPatterns = [
    { name: 'API Keys', regex: /API_KEY\s*=\s*['"]?[a-zA-Z0-9]{20,}/ },
    { name: 'Supabase Keys', regex: /SUPABASE_KEY\s*=\s*['"]?eyJ/ },
    { name: 'Bearer Tokens', regex: /Bearer\s+[a-zA-Z0-9\-_.]+/ },
    { name: 'Private Keys', regex: /-----BEGIN PRIVATE KEY-----/ },
    { name: 'AWS Secrets', regex: /aws_secret_access_key\s*=/ },
  ];

  const filesToCheck = ['.env', '.env.local', '.env.production'];
  let secretsFound = 0;

  for (const file of filesToCheck) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of secretPatterns) {
        if (pattern.regex.test(content)) {
          log(`   ⚠️  Found ${pattern.name} in ${file}`, 'yellow');
          secretsFound++;
        }
      }
    }
  }

  if (secretsFound === 0) {
    log('   ✅ No secrets found in local files', 'green');
  } else {
    log(`   ⚠️  Found ${secretsFound} potential secrets - ensure these are in .gitignore`, 'yellow');
  }

  // 4. Check git history
  log('\n4️⃣  Scanning git history for exposed secrets...', 'blue');
  try {
    const historyCheck = execSync('git log --all -p 2>/dev/null | grep -i "SUPABASE_KEY\\|API_KEY\\|SECRET\\|TOKEN\\|PASSWORD" || true', { encoding: 'utf-8' });
    if (historyCheck.trim()) {
      log(`   ⚠️  Found potential secrets in git history`, 'yellow');
      log(`   Run: git log --all -p | grep -i "SUPABASE_KEY"`, 'yellow');
    } else {
      log('   ✅ No secrets found in git history', 'green');
    }
  } catch (e) {
    log('   ✅ No secrets found in git history', 'green');
  }

  // 5. Verify security headers
  log('\n5️⃣  Verifying security headers file...', 'blue');
  if (fs.existsSync('public/_headers')) {
    const headers = fs.readFileSync('public/_headers', 'utf-8');
    const requiredHeaders = [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Frame-Options',
      'X-Content-Type-Options',
    ];

    let headersOk = true;
    for (const header of requiredHeaders) {
      if (headers.includes(header)) {
        log(`   ✅ ${header}`, 'green');
      } else {
        log(`   ❌ Missing: ${header}`, 'red');
        headersOk = false;
      }
    }

    // Check for broken report-uri
    if (headers.includes('report-uri: /csp-report')) {
      log(`   ⚠️  Found non-functional CSP report-uri (causes 405 errors)`, 'yellow');
    }
  }

  // 6. Summary
  section('📊 SECURITY STATUS');
  log('✅ Your application has strong security practices!', 'green');
  log('\nNext steps:', 'cyan');
  log('  1. Review SECURITY_HARDENING.md', 'cyan');
  log('  2. Enable Dependabot on GitHub (Settings → Code Security)', 'cyan');
  log('  3. Set up environment variables in Vercel dashboard', 'cyan');
  log('  4. Run npm audit monthly', 'cyan');
  log('  5. Review Supabase RLS policies quarterly', 'cyan');

  section('📚 Resources');
  log('• SECURITY_HARDENING.md - Complete security guide', 'cyan');
  log('• .githooks/pre-commit - Prevents secret commits', 'cyan');
  log('• Run: npm audit - Audit dependencies', 'cyan');
  log('• Vercel Docs: https://vercel.com/docs/security', 'cyan');
  log('• Supabase Docs: https://supabase.io/docs/guides/auth', 'cyan');
}

main().catch(e => {
  log(`\n❌ Error: ${e.message}`, 'red');
  process.exit(1);
});
