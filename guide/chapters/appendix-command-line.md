# The Command Line {.appendix}

The desktop app can also run a few tasks from a terminal. Each task does
one thing Astryx already does, without opening its window, and then exits.
You won't need them in normal use. They're for jobs that have no button in
the app, or that are easier to repeat from a script.

The command line is in the desktop app only, not in Astryx on the web.

## Running Astryx from a Terminal

Type `astryx` followed by the task's name. With no task, Astryx starts as
usual.

- **Linux:** open a terminal and type, for example, `astryx --help`.
- **Windows:** open Command Prompt or PowerShell from the Start menu, then
  type the full path to Astryx, in quotes, followed by the task:
  - Command Prompt: `"%LOCALAPPDATA%\Astryx\astryx.exe" --help`
  - PowerShell: `& "$env:LOCALAPPDATA\Astryx\astryx.exe" --help`

  The Run box (Windows+R) isn't suitable: it has no window to show
  Astryx's messages in.

::: note
On Windows, Astryx is a windowed app, so Command Prompt doesn't wait for
it to finish. The prompt can come back before Astryx's message appears. Wait
for the message, then press Enter for a fresh prompt.
:::

## Getting Help

- `astryx --help` or `astryx help` lists the tasks.
- `astryx help reset-learned` or `astryx reset-learned --help` describes
  one task.
- `astryx --version` shows which version of Astryx you have.

None of these opens Astryx. A mistyped task or option gets an error with a
usage line instead.

## Close Astryx First

A task writes to the same data as the open app. The open app would
overwrite the change later, so a task refuses to run while Astryx is open:

```
Astryx is open; close it and try again
```

Close every Astryx window and run the task again.

## Exit Codes

Every task finishes with a number, its exit code, which scripts can check:

| Code | Meaning |
|:-----|:----------------------------------------------------------------|
| 0 | The task succeeded. |
| 1 | The task failed, for example because Astryx was open. The message says why. |
| 2 | A command-line mistake, such as a mistyped task or option, or a PDF that isn't redirected to a file. |

On Linux, `echo $?` shows the last exit code. On Windows, a batch file
(`.cmd`) can check `%ERRORLEVEL%` after the task. Typed at the prompt it
isn't reliable, because the prompt doesn't wait for Astryx.

## Tasks

| Task | What it does |
|:----------------------|:----------------------------------------------------|
| `reset-learned` | Sets the learned Sub Gap and Dither Duration back to their defaults, and forgets the nights they were learned from. Use it after changing something that alters them, such as your camera, mount, dither size, or settle settings; loading your Session Logs again teaches Astryx your rig's values. It prints "Learned Sub Gap and Dither Duration reset to their defaults" when it's done. |
| `analyze-logs` | Analyzes one night's Session Log and PHD2 Guide Log, as loading them in [Log Analysis](log-analysis.md) does, and writes the Combined Report's PDF. See below. |

## Analyzing Logs

`analyze-logs` takes the night's two logs, in either order, and writes the
same PDF as **Download PDF Report**. The PDF goes to the program's output,
so send it to a file with `>`:

```
astryx analyze-logs Autorun_Log_2026-10-12_193023.txt PHD2_GuideLog_2026-10-12_195105.txt > 2026-10-12.pdf
```

Without `>`, Astryx refuses rather than fill the terminal with the PDF. To
learn from the logs without keeping the report, send it to `/dev/null` on
Linux or `NUL` on Windows.

As in Log Analysis, the Session Log adds its night to the learned Sub Gap
and Dither Duration once. Astryx prints the result of each, in the words of
the report's Behavior table:

```
Learned Sub Gap: 1.1s (was 1.2s; this log's 0.9s included, average of the last 20 nights)
Learned Dither Duration: 20.8s (was 20.9s; this log's 19.0s included, average of the last 20 nights)
```

Astryx refuses, with exit code 1 and nothing learned, when a file is
missing or isn't a log, when both files are the same kind of log, or when
the logs don't overlap in time. For the last, it prints when each log
starts and ends. A night with only flats, darks, or bias frames has no
report, so it also ends with exit code 1. When a task fails, the file after `>` is still created,
empty; delete it.

### Many Nights at Once

The learned figures are the average of your most recent nights by date,
so the nights can be analyzed in any order.

On Linux, this script analyzes every Session Log in the current folder,
with each guide log of the same date. Each report is named
after its Session Log. A pair that doesn't overlap is refused, so only the
right guide log produces a report:

```
#!/bin/sh
for session in Autorun_Log_*.txt; do
    day=$(echo "$session" | cut -d_ -f3)
    for guide in PHD2_GuideLog_"$day"_*.txt; do
        astryx analyze-logs "$session" "$guide" > report.tmp &&
            mv report.tmp "${session%.txt}.pdf"
    done
done
rm -f report.tmp
```

A guide log whose name has a different date from its Session Log's isn't
found; analyze that night on its own.

On Windows, list the nights in a batch file (`.cmd`):

```
@echo off
set ASTRYX="%LOCALAPPDATA%\Astryx\astryx.exe"
%ASTRYX% analyze-logs Autorun_Log_2026-10-06_201425.txt PHD2_GuideLog_2026-10-06_200950.txt > 2026-10-06.pdf
%ASTRYX% analyze-logs Autorun_Log_2026-10-07_200436.txt PHD2_GuideLog_2026-10-07_193931.txt > 2026-10-07.pdf
```

A batch file waits for each night to finish before starting the next.

::: note
On Windows, run `analyze-logs` from Command Prompt or a batch file. The
PowerShell that comes with Windows (version 5.1) treats what comes through
`>` as text and damages the PDF.
:::
