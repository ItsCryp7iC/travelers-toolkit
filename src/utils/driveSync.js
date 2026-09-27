export async function listBackupsFromDrive() {
  const res = await fetch('/api/google/backups');
  if (!res.ok) {
    const error = new Error('Failed to query Google Drive');
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function uploadBackupToDrive(backupData) {
  const res = await fetch('/api/google/backups/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backupData)
  });
  if (!res.ok) {
    const error = new Error('Failed to upload backup to Google Drive');
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function upsertAutoBackupToDrive(backupData) {
  const res = await fetch('/api/google/backups/auto', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(backupData)
  });
  if (!res.ok) {
    const error = new Error('Failed to auto-backup to Google Drive');
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function downloadBackupFromDrive(fileId) {
  const res = await fetch(`/api/google/backups/${fileId}`);
  if (!res.ok) {
    const error = new Error('Failed to download backup from Google Drive');
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function downloadRecoveryBackupFromDrive() {
  const res = await fetch('/api/google/backups/recovery');
  if (!res.ok) {
    const error = new Error('Failed to download recovery backup from Google Drive');
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function getAutoBackupStatus() {
  const res = await fetch('/api/google/backups/auto/status');
  if (!res.ok) {
    const error = new Error('Failed to fetch auto backup status');
    error.status = res.status;
    throw error;
  }
  return res.json();
}
