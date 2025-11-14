-- Vacation Tracker D1 Database Schema
-- Initialize all tables for the Discord bot

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User vacation balance
CREATE TABLE IF NOT EXISTS user_vacation_balance (
  user_id TEXT PRIMARY KEY,
  total_days INTEGER DEFAULT 25,
  used_days INTEGER DEFAULT 0,
  pending_days INTEGER DEFAULT 0,
  carried_over_days INTEGER DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Vacation requests
CREATE TABLE IF NOT EXISTS vacation_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  requested_days INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  pm_approved_by TEXT,
  pm_approved_at DATETIME,
  admin_approved_by TEXT,
  admin_approved_at DATETIME,
  rejected_by TEXT,
  rejected_at DATETIME,
  rejection_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Time entries
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  location TEXT DEFAULT 'office',
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Active sessions
CREATE TABLE IF NOT EXISTS active_sessions (
  user_id TEXT PRIMARY KEY,
  session_type TEXT NOT NULL,
  start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  location TEXT DEFAULT 'office',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_timestamp ON time_entries(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_time_entries_type_timestamp ON time_entries(entry_type, timestamp);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_user_status ON vacation_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status_date ON vacation_requests(status, start_date);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_timestamp ON audit_log(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active);

-- Insert default admin user (you should change this)
-- Note: In production, manage admin roles through your application
INSERT OR IGNORE INTO users (id, username) VALUES ('admin_user_id', 'Admin');