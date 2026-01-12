# Tutorial

Specula is a tool to help the astrophotographer develop a target list, plan
imaging sessions, and maintain an imaging log. It does not require an
internet connection. It is designed to be easy to use, fast, and
helpful.

This tutorial will step you through the various functions and capabilities
available. 

## User Interface

![Target Selection](images/full-target-selection.png "Target Selection")
 
 The User Interface (UI) is divided into two sections. On the left is the
 sidebar that allows you to access the menu, set the theme, set your
 location, and select one of the functions. The right side is the area
 where you enter parameters and view results.
 
## Sidebar

Clicking the hamburger menu opens up a menu.

    * Settings: Set Daylight Saving Time mode, Maximum Search Results for
      the the Target Search, and the global minimum altitude setting. The
      global minimum altitude is the altitude at which you would begin to
      image and so it affects multiple other functions and calculations
      such as target rise and set times. 
    * Admin Tools >> Calculate Best Months: For the specified location(s), calculates the
      "Best Month" for observing each target and the range of months that
      the target is visible for at least two continuous dark hours. Depending on
      the speed of your computer, this calculation takes between 30 and 60
      seconds for each location. 
    * Admin Tools >> Manage Equipment: Add your telescopes, sensors, and filters.
    * Admin Tools >> Manage Observer Locations. Add, edit, or delete
      observer locations. You can add a horizon file to each location if
      desired. You can type or paste a list of azimuth/elevation numbers,
      one to a line in the format "<az> <el>". Try AngleCam for Android to
      generate the pairs. There are similar apps for the iPhone. Once a
      horizon file is defined for a location, you can include it in your
      visibility and sequence planning.
    * Admin Tools >> Clear All Targets: This completely zeroizes the target database (but
      not the Imaging Log database) in preparation for importing a new
      target CSV file. A "normal" user should never have to do this, but
      rely on backups in JSON format.
    * Admin Tools >> Merge New Targets: Import a target CSV file. A "normal" user should
      never have to do this, but rely on backups in JSON format.
    * Backup/Restore: Backup the database in JSON format and Restore
      a backup. Backup the Imaging Log in JSON format and restore
      it.
    * Help: A list of help documents.
    * About: Brief description and acknowledgements.
    
In the sidebar, click the top dropdown to select the theme style you wish
to use. Click the next dropdown to select the location you wish to use for
planning.

Next is a vertical list of buttons with the functions, operations, and
charts used to build a list of imaging targets and plan how and when to
image them.

## Target Selection

This view has multiple sections for searching, filtering, and remembering
(pinning) targets. From this page, you can do a free-text search (Target
Search) or Filter Targets based on five criteria. This view also has a
section to display your Pinned Targets. Pinned Targets are used when
planning an imaging sequence.

**Target Search**. Type in free-text in the search field. This can be a
complete or partial catalog identifier, common names such as 'Andromeda',
etc. As you type the list will populate dynamically up to the maximum
number defined in Settings. Click on the result to select that target. A
subset of metadata populates the section. You "Pin" the displayed target
from this screen with the list of all pinned targets displayed below the
target search section. Additional metadata is displayed by clicking the
Detail button. From the Detail screen, you can add (or remove) the target
to your "To Do" list, which is the list of targets that you wish to image
in the future.
      
**Filter Targets**. Use the dropdowns to filter the targets based on the
five criteria of catalog, type, month, minimum angular size, and maximum
magnitude. The Type catalogs are familiar except for Extra and Minor
Planet. The Extra category is a hodgepodge of various targets from various
sources and catalogs. I created the Extra category to condense multiple
sparse catalogs into a single one. Minor Planet is a list of interesting
and observable asteroids. Note that coordinates for minor planets are not
available in this tool.

The Type filter is all target types available in the tool. The Month filter
checks to see if the target is visible in that month. Other filters include
minimum angular size in arc-minutes and maximum magnitude. When you set the
filters and hit Apply, the results appear in the Filter Results
section. You can scroll through the results. Select a target by clicking
it.

In the Filter Results section is a "Create Imaging Program" button. This is
a feature in the Imaging Log section that you use to track targets you are
imaging from a list. By creating an image program from this view, you can
essentially save a filter setting and track as you image each target.

## To Do List

Displays the list of targets on your To Do list in various formats and
sorted by different criteria. These options are:

    * Rise Time chart. Shows the riset/set times of all the
      targets, if visible, tonight sorted by rise time.
    * Rise Time List. A text list of targets sorted by rise time.
    * Type. Sorted by the type of target.
    * Best Month. Sorted by the month determined to be the "best month" to
      observe it. The Yearly Observability function provides additional
      information about the best months to observe.

## Daily Visibility

Calculates and makes available to the user daily visibility charts and
information for the selected target. You specify the different filters and
settings in the Daily Visibility Parameters dialog box. A list of daily
visibility charts will be output and you select the one you want to
see. The charts are a graphical depiction of astronomical dusk/dawn, moon
rise/set, and target rise/set. If the target rises above the minimum
altitude/horizon line, the altitude curve will be displayed along with a
gradient background depicting how dark it will be from noon to noon of the
specified day. The visibility score takes into account moon illumination,
angle of the target to the moon, and target altitude.

## Yearly Observability 

For the selected target, displays a chart of the best times to image the
target over the next 12 months. After setting the minimum altitude (or
using the default global value from Settings), a gradient chart is
displayed depicting the best times/months to view.

## Field of View

Using the telescopes and sensors you entered from the Admin Tools >> Manage
Equipment page, the FOV function provides a notional field of view
containing the selected target. Note that not all targets have angular
sizes and that there are no background images. This tool simply provides a
general view of how a target might fill your FOV.

## Sequence Planner

Use this function to plan an imaging sequence for all your pinned targets
for a given night. This one has lots of settings. Using the settings
values, Sequence Planner attempts to help you plan out your most productive
evening across multiple targets, taking into account autofocus,
calibration, meridian flips durations. It initially optimizes based on
transit time, but you can drag and drop the targets into any order in the
Target Allocation section. Use the Target Allocation sliders to decrease
and increase the number of exposures to take for a given target. The other
targets dynamically adjust. At the bottom of the view is the Imaging Plan
section that translates the sequencing chart into potential start/top times
and an estimated number of exposures per target.

## Imaging Log

Allows you to keep track of Projects and Programs. 

### Projects

A Project is a series of one or more Imaging Sessions for a given
target. Create a new project by clicking the "+ New Project" button and
enter the data. It will search the target database as you enter your
targets. You may be focusing on a single target but once you get done,
there will be other targets in your field of view. You can come back and
add the additional targets to track them as well as the primary target.

Each Project has at least one session. These are typically a single night's
viewing. Create a session by opening the Imaging Sessions toggle and
selecting "+ Add Session" button. Enter the data you wish to preserve. Some
fields are required. Clicking "Calculate Moon Data" automagically fills in
the Moon fields. Data from the sessions is summarized at the project level
and displayed under the project name.

### Programs

Also on the Imaging Logs view is the Programs tab. You can create one or
more Imaging programs to track your progress based on your individual
goals. As mentioned earlier, you can create a Program from the Target
Filter view that saves the results of the filter into a new Program.

There are two types of Programs. After clicking "New Program", you select
whether the program is "Catalog Pattern" or "Manual List". Catalog Pattern
means that it draws targets from only one Catalog. You can specify the
number of items you wish to include from a single catalog.

The other type is "Manual List". Here you type or paste a list of
targets. When trying to save the program, it checks for invalid
entries. Within a Manual List, you can enter as many targets from as many
catalogs as you wish.

When you set the status of a Project to Complete, the targets are
automagically added to every Program that they match with. The Programs
page shows a horizontal progress bar.

### Reports

The Reports page on the Imaging Log view provides more details on the
status of both Projects and Programs. These include summary of catalog
targets captured, the ability to see which targets you've imaged for each
Program. For Manual List programs, you can also view the targets you have
not yet imaged. And finally, a Project Status summary report.

### Important 

Note that Imaging Log data is stored separately from the target
database. You can backup and restore it from the system menu.
