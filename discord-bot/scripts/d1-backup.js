#!/usr/bin/env node

/**
 * D1 Database Backup Script
 * Exports all tables from Cloudflare D1 database to JSON format
 */

const fs = require('fs');
const path = require('path');

async function backupD1(env) {
  console.log('🚀 Starting D1 database backup...');

  const tables = [
    'users',
    'user_vacation_balance',
    'vacation_requests',
    'time_entries',
    'active_sessions',
    'audit_log'
  ];

  const backup = {
    timestamp: new Date().toISOString(),
    tables: {}
  };

  try {
    for (const table of tables) {
      console.log(`📊 Backing up table: ${table}`);

      const result = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      backup.tables[table] = result.results || [];

      console.log(`✅ ${table}: ${backup.tables[table].length} records`);
    }

    // Save backup to file
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filename = `d1-backup-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(backupDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));

    console.log(`💾 Backup saved to: ${filepath}`);
    console.log('✅ D1 backup completed successfully!');

    return { success: true, filepath };

  } catch (error) {
    console.error('❌ Backup failed:', error);
    return { success: false, error: error.message };
  }
}

async function restoreD1(env, backupFile) {
  console.log('🔄 Starting D1 database restore...');

  try {
    // Read backup file
    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    console.log(`📂 Loaded backup from ${new Date(backupData.timestamp).toLocaleString()}`);

    // Clear existing data and restore
    const tables = Object.keys(backupData.tables);

    for (const table of tables) {
      console.log(`🔄 Restoring table: ${table}`);

      // Clear table
      await env.DB.prepare(`DELETE FROM ${table}`).run();

      // Insert data
      const records = backupData.tables[table];
      if (records.length > 0) {
        // Insert in batches to avoid limits
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);

          for (const record of batch) {
            const columns = Object.keys(record).join(', ');
            const placeholders = Object.keys(record).map(() => '?').join(', ');
            const values = Object.values(record);

            await env.DB.prepare(
              `INSERT OR REPLACE INTO ${table} (${columns}) VALUES (${placeholders})`
            ).bind(...values).run();
          }
        }
      }

      console.log(`✅ ${table}: ${records.length} records restored`);
    }

    console.log('✅ D1 restore completed successfully!');
    return { success: true };

  } catch (error) {
    console.error('❌ Restore failed:', error);
    return { success: false, error: error.message };
  }
}

// Cloudflare Worker export
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/backup') {
      const result = await backupD1(env);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST' && url.pathname === '/restore') {
      const { backupFile } = await request.json();
      const result = await restoreD1(env, backupFile);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('D1 Backup/Restore API', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'backup') {
    console.log('CLI backup not supported in Workers environment');
    console.log('Use the API endpoint: POST /backup');
    process.exit(1);
  }

  if (command === 'restore') {
    const backupFile = args[1];
    if (!backupFile) {
      console.log('Usage: node d1-backup.js restore <backup-file>');
      process.exit(1);
    }
    console.log('CLI restore not supported in Workers environment');
    console.log('Use the API endpoint: POST /restore with backupFile in body');
    process.exit(1);
  }

  console.log('Usage:');
  console.log('  node d1-backup.js backup');
  console.log('  node d1-backup.js restore <backup-file>');
  console.log('');
  console.log('For Cloudflare Workers, use the API endpoints:');
  console.log('  POST /backup');
  console.log('  POST /restore');
}