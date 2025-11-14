-- Vacation Tracker Database Schema for Cloudflare D1 (SQLite)
-- This schema creates all necessary tables for the vacation tracking system

-- Users table - Discord user profiles
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    discriminator TEXT,
    avatar TEXT,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User vacation balance - Annual vacation entitlements
CREATE TABLE IF NOT EXISTS user_vacation_balance (
    user_id TEXT PRIMARY KEY,
    total_days INTEGER DEFAULT 25,
    used_days INTEGER DEFAULT 0,
    pending_days INTEGER DEFAULT 0,
    carried_over_days INTEGER DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Time entries - Clock in/out records with location tracking
CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    entry_type TEXT NOT NULL, -- clock_in, clock_out, pauza_start, pauza_end, off, off_sick
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    location TEXT DEFAULT 'office', -- office, home, away
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Active sessions - Current work/break sessions
CREATE TABLE IF NOT EXISTS active_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    session_type TEXT NOT NULL, -- work, pauza
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    location TEXT DEFAULT 'office',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, session_type)
);

-- Vacation requests - Approval workflow system
CREATE TABLE IF NOT EXISTS vacation_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    requested_days INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending', -- pending, pm_approved, admin_approved, rejected
    pm_approved_by TEXT,
    pm_approved_at DATETIME,
    admin_approved_by TEXT,
    admin_approved_at DATETIME,
    rejected_by TEXT,
    rejected_at DATETIME,
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Server settings - Guild-specific configuration
CREATE TABLE IF NOT EXISTS server_settings (
    guild_id TEXT PRIMARY KEY,
    admin_role_id TEXT,
    pm_role_id TEXT,
    work_start_time TEXT DEFAULT '09:00',
    work_end_time TEXT DEFAULT '17:00',
    timezone TEXT DEFAULT 'Europe/Sarajevo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit log - Complete system action logging
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    details TEXT, -- JSON string with additional data
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_timestamp ON time_entries(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_time_entries_type ON time_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_user ON vacation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status ON vacation_requests(status);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_dates ON vacation_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_timestamp ON audit_log(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_vacation_requests_timestamp
    AFTER UPDATE ON vacation_requests
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE vacation_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_server_settings_timestamp
    AFTER UPDATE ON server_settings
    FOR EACH ROW
    WHEN NEW.updated_at = OLD.updated_at
    BEGIN
        UPDATE server_settings SET updated_at = CURRENT_TIMESTAMP WHERE guild_id = NEW.guild_id;
    END;