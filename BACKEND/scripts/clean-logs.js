#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');

function cleanOldLogs() {
  if (!fs.existsSync(logsDir)) {
    console.log('Logs directory does not exist');
    return;
  }

  const files = fs.readdirSync(logsDir);
  const now = new Date();
  const maxAge = 30; // days

  let deletedCount = 0;

  files.forEach(file => {
    const filePath = path.join(logsDir, file);
    const stats = fs.statSync(filePath);
    const ageInDays = (now - stats.mtime) / (1000 * 60 * 60 * 24);

    if (ageInDays > maxAge) {
      fs.unlinkSync(filePath);
      console.log(`Deleted old log file: ${file}`);
      deletedCount++;
    }
  });

  console.log(`Cleaned ${deletedCount} old log files`);
}

cleanOldLogs(); 