export async function listBackupsFromDrive(accessToken) {
  const searchRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?q=name contains 'travelers-toolkit-backup' and 'appDataFolder' in parents&spaces=appDataFolder&fields=files(id, name, createdTime)&orderBy=createdTime desc",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!searchRes.ok) {
    throw new Error('Failed to query Google Drive');
  }

  const searchData = await searchRes.json();
  return searchData.files || [];
}

export async function uploadBackupToDrive(accessToken, backupData) {
  const metadata = {
    name: `travelers-toolkit-backup-${Date.now()}.json`,
    parents: ['appDataFolder'],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append(
    'file',
    new Blob([JSON.stringify(backupData)], { type: 'application/json' })
  );

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  const uploadRes = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload backup to Google Drive');
  }

  const uploadData = await uploadRes.json();

  // Enforce max 5 backups
  const backups = await listBackupsFromDrive(accessToken);
  if (backups.length > 5) {
    const filesToDelete = backups.slice(5);
    for (const file of filesToDelete) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch (err) {
        console.error(`Failed to delete old backup ${file.id}`, err);
      }
    }
  }

  return uploadData;
}

export async function downloadBackupFromDrive(accessToken, fileId) {
  let targetFileId = fileId;

  if (!targetFileId) {
    // If no specific file is requested, get the latest one
    const backups = await listBackupsFromDrive(accessToken);
    if (backups.length === 0) {
      return null;
    }
    targetFileId = backups[0].id;
  }

  const downloadRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${targetFileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!downloadRes.ok) {
    throw new Error('Failed to download backup from Google Drive');
  }

  return downloadRes.json();
}
