# jak-tracker
Piggybacking on the work done to support LiveSplit autosplitter, this program will scan OpenGOAL memory and print Power Cells you've collected in your current game in json format.


### Notes
- Windows/antivirus software may flag this program as a risk, we promise it is safe to run. This project is open source and you can audit the source code if you want to verify or run the python yourself.
- `tasks.yaml`, `stats.yaml` and the `icons` subfolders should all live in the same root folder as `JakTracker.py`
 
### Configuration Files
- **Custom icons** can be used - just replace the corresponding PNG file(s) in the [`icons`](https://github.com/OpenGOAL-Unofficial-Mods/jak-tracker/tree/main/icons) subfolder
https://github.com/OpenGOAL-Unofficial-Mods/jak-tracker/blob/71faa5c915fc098294c6c3ebd3cc7bd22b306c35/prefs.yaml#L3-L27
- *`tasks.yaml` defines the autosplitter/autotracker tasks and their offsets - you shouldn't need to touch this!*
- *`stats.yaml` defines other type of stats the autotracker tracks (this is currently unused)*