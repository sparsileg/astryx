# Command-Line Options {.appendix}

This appendix lists the options Astryx can be started with. They fix
things that have no button in the app, and you won't need them in normal
use. Usually someone helping you will tell you which one to use.

## Starting Astryx with an Option

An option applies only to the start you give it on. Starting Astryx the
usual way afterwards keeps whatever the option changed.

- **Linux:** in a terminal, type `astryx` followed by the option, for
  example `astryx --reset-learned`.
- **Windows:** press Windows+R to open the Run box, type
  `%LOCALAPPDATA%\Astryx\astryx.exe` followed by the option, and press
  Enter. For example:
  `%LOCALAPPDATA%\Astryx\astryx.exe --reset-learned`
- **Web:** add the web form of the option to the end of the address, for
  example `https://astryx.tools/?reset-learned=1`. Astryx removes it from
  the address once it has been applied, so reloading the page doesn't
  apply it again.

When it's done, Astryx shows a message saying what changed. An option it
doesn't know gets a warning instead.

## Options

| Option | Web | What it does |
|:------------------|:------------------|:--------------------------------------------|
| `--reset-learned` | `?reset-learned=1` | Sets the learned Sub Gap and Dither Duration back to their defaults, and forgets which Session Logs they were learned from. Use it when the learned values are wrong; loading your Session Logs again teaches Astryx your rig's values. |
