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
schema version, what the backup holds, and the date and time, for example
Astryx-v1.102.0-d8-userdata-20261127-2103.zip. The schema version starts
with **d** on the web version and **s** on the desktop app: the two keep
their data in different kinds of database, and count their versions
separately.

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
- On the web version, Astryx can't tell whether your browser actually saved
  the file. A browser can block a download it didn't expect, or ask where to
  save it and be dismissed. So the message says the backup was
  **downloaded**, not saved; check your downloads folder now and then. The
  desktop app writes the file itself and says if that fails.

See [Getting Started](getting-started.md) for these settings.

## The Backup Reminder

At the bottom of the sidebar, **Last backup** says how long ago you
last backed up, or **never**. It turns the theme's warning color (amber
or orange) after 7 days, and bold after 14. When Astryx starts, and once a day while it's open, it also reminds you
if your last backup is older than **Backup reminder every** in Settings.

Where your data lives depends on which Astryx you use. The web version
stores it in your browser, where it can be lost if the browser's cache or
site data is cleared, or by another browser operation such as an update.
The desktop app stores it in a database on your computer, where it can be
lost if the disk fails, or for any number of other reasons. Either way, a
backup is what gets it back.

Click **Last backup** for **About Your Data Storage**, which explains why
backups matter; its **Make a Backup** button opens the Backup dialog.

::: {.shot id="backup-storage-dialog"}
About Your Data Storage in the web version, opened from Last backup at
the bottom of the sidebar.
:::

## Restoring a Backup

1. Open the system menu (≡) and click **Restore**.
2. Choose the backup file. On the web version, click **Browse Files**, then
   **Continue**.
3. Read the **Restore Backup?** dialog (below).
4. Untick anything you don't want to restore.
5. Tick the box that confirms you've backed up your current data.
6. Click **Restore**.

Astryx replaces each selected kind of data with the backup's copy, then
reloads at once and says how many kinds of data it restored. Locations
that weren't in the backup also lose their Best Months.

::: note
Restoring replaces, it doesn't merge. A restored To Do List, for example,
loses anything you added since the backup was made. If you're not sure,
back up your current data first, so you can go back.
:::

### The Restore Backup? Dialog

The top of the dialog describes the file: when it was **Created**, the
Astryx **Version** and **Database** schema version that made it, with
whether it came from the web version or the desktop app (for example
"8 (web)"), the **Target** database version, and its **Size**. Below that, Astryx compares the backup
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

A backup made by your version of Astryx or an older one can be restored.
A backup made by a newer Astryx can't; Astryx shows **Backup From a Newer
Astryx** instead, and restoring works once you've updated. A file that
isn't an Astryx backup, or has been damaged, is refused with a message
saying what's wrong with it.

## Where Astryx Keeps Your Data

- **Web version:** in your browser's own storage, for astryx.tools only.
  Another browser, or a private window, has its own, empty storage.
- **Desktop app:** in a database file, `astryx.db`, in a folder named
  Astryx in your system's data folder:
  - Linux: `~/.local/share/Astryx`
  - Windows: `%APPDATA%\Astryx`

  **About**, in the system menu (≡), shows this folder.

  Before an update changes the database, Astryx saves a copy of it beside
  the database, named like `astryx.db.pre-v3.bak`, and keeps the three
  newest. The desktop app also keeps the window size, the sidebar width
  and the sky images it has downloaded in folders named
  `tools.astryx.astryx`. None of that needs backing up.

Copying these files isn't the way to move your data: make a backup and
restore it, as below.

## Moving to a New Computer

1. On the old computer, make a user data backup and a targets backup.
2. Install Astryx on the new computer, or open the web version there.
3. Restore the targets backup, then the user data backup.

The same works between the web version and the desktop app.

## Related

- [Getting Started](getting-started.md): the backup settings.
- [Introduction](introduction.md): where Astryx keeps your data.
