# Backup and Restore

::: {.note title="At a glance"}
Everything you enter in Astryx is stored only on your computer. A
**Backup** saves it to a ZIP file you can keep somewhere safe; **Restore**
brings it back, on the same computer or a new one. Back up regularly: a
backup is the only copy that survives a failed disk, a cleared browser, or
a lost laptop.
:::

## What a Backup Holds

A backup is one of two kinds:

| Kind | What it holds | How often |
|:----------------|:------------------------------------------------------|:------------------|
| User data | **Settings**, **Locations**, **Telescopes**, **Sensors**, **Filters**, **Pinned Targets**, your **To Do List**, **Imaging Projects / Sessions**, and **Imaging Programs**. | After every imaging night, or at least weekly. |
| Targets | The **Target/Best Months Database**: the ~14,600 targets and the Best Months you calculated for each location. | Once, and again after you calculate Best Months for a new location. |

The target database is large and rarely changes, which is why it has its
own backup.

## Making a Backup

1. Open the system menu (≡) and click **Backup**.
2. Click **Select User Data** or **Select Targets**. User data is selected
   when the dialog opens.
3. Untick anything you want to leave out. The number after each item is how
   many records it holds.
4. Click **Save Backup**.

The dialog shows the **Filename**, and the backup's size before and after
compression. The filename records the Astryx version, the database
version, what the backup holds, and the date and time, for example
Astryx-v1.11.1-d6-userdata-20261007-2103.zip.

Where the file goes:

- **Web version:** your browser's downloads folder.
- **Desktop app:** the **Backup Folder** from Settings, or, if you haven't
  set one, wherever you choose in the save dialog.

When it's done, **Data Saved** shows the file's name and size and how many
records of each kind it holds.

::: tip
Copy your backups somewhere other than the computer Astryx runs on: a cloud
drive, a USB stick, or another computer. A backup on the same disk is lost
with it.
:::

## Automatic Backups

With **Automatic backups on change** on in Settings, Astryx saves a user
data backup by itself after you change your data: **Minutes before
backup** after your last change, so a busy evening of edits makes one
backup, not dozens. Changing the theme or the location in the sidebar
doesn't count as a change.

- The wait is timed from your last change by the clock. If you close
  Astryx and open it again before the time is up, the countdown carries on
  where it left off. If the time ran out while Astryx was closed, the
  backup is made as soon as Astryx starts.
- Automatic backups go to your browser's downloads folder on the web
  version. On the desktop app they go to the **Backup Folder** from
  Settings, or to your Downloads folder if you haven't set one.

See [Getting Started](getting-started.md) for these settings.

## The Backup Reminder

At the bottom of the sidebar, **Last backup** says how long ago you
last backed up, or **never**. It turns amber after 7 days and orange
after 14. When Astryx starts, and once a day while it's open, it also reminds you
if your last backup is older than **Backup reminder every** in Settings.

Click **Last backup** for **About Your Data Storage**, which explains why
backups matter; its **Go to Backup & Restore** button opens the Backup
dialog.

## Restoring a Backup

1. Open the system menu (≡) and click **Restore**.
2. Choose the backup file. On the web version, click **Browse Files**, then
   **Continue**.
3. Read the **Restore Backup?** dialog (below).
4. Untick anything you don't want to restore.
5. Tick the box that confirms you've backed up your current data.
6. Click **Restore**.

Astryx replaces each selected kind of data with the backup's copy, then
reloads.

::: note
Restoring replaces, it doesn't merge. A restored To Do List, for example,
loses anything you added since the backup was made. If you're not sure,
back up your current data first, so you can go back.
:::

### The Restore Backup? Dialog

The top of the dialog describes the file: when it was **Created**, the
Astryx **Version** and **Database** version that made it, the **Target**
database version, and its **Size**. Below that, Astryx compares the backup
with your current data:

| Message | What it means |
|:------------------------------------------|:---------------------------------------------|
| Identical to current data — restore not needed | Nothing would change. |
| Backup data is newer than current data — restore recommended | The backup has changes your current data doesn't, for example from another computer. |
| Backup data is older than current data | Restoring would undo changes made since the backup. Backups over 30 days old are marked in yellow, and over 90 days in orange. |

The last two show when each was last changed.

Each kind of data in the backup has its own line, with how many records you
have now and how many the backup holds, for example "12 → 15", and whether
it's **identical** or **differs**. Imaging projects and sessions are
restored together.

A backup made by a version of Astryx with a different database version
can't be restored; Astryx shows **Version Mismatch** instead.

## Moving to a New Computer

1. On the old computer, make a user data backup and a targets backup.
2. Install Astryx on the new computer, or open the web version there.
3. Restore the targets backup, then the user data backup.

The same works between the web version and the desktop app.

## Related

- [Getting Started](getting-started.md): the backup settings.
- [Introduction](introduction.md): where Astryx keeps your data.
