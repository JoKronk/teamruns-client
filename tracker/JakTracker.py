from OpenGoalAutoTracker import OpenGoalAutoTracker
from JsonPrinter import JsonPrinter
import yaml
import sys

path = ""
if len(sys.argv) > 1:
  path = sys.argv[1]

class JakTracker(object):
  def __init__(self):

    # init printer
    self.printer = JsonPrinter()

    # parse tasks from yaml file, convert to dictionary
    with open(path + 'tasks.yaml', 'r') as tasks_yaml:
      self.tasks = {fld['name']:fld for fld in yaml.load(tasks_yaml, Loader=yaml.FullLoader)}
      
    # possibly useful in the future
    """
    # parse tasks from yaml file, convert to dictionary
    with open(path + '/stats.yaml', 'r') as stats_yaml:
      self.stats = {fld['name']:fld for fld in yaml.load(stats_yaml, Loader=yaml.FullLoader)}
    """

    # connect autotracker
    self.autotracker = OpenGoalAutoTracker()

    # used to send one time message when found
    self.markerFound = False

    # refresh loop
    while True:

      # update from autotracker
      match self.autotracker.status:
        case 'wakeup':
          # need to connect and find markers the first time
          self.autotracker.find_markers(True)
        case 'no_gk':
          # gk.exe not found, let user retry
          self.printer.writeError('Tracker unable to find game! (gk.exe)')
          break
        case 'no_marker':
          # marker address not found, let user retry
          self.printer.writeError('Tracker unable to find game marker address!')
          break
        case 'connected':
          # connected but still looking for marker address, keep waiting
          pass
        case 'marker':
          
          if self.markerFound == False:
            self.printer.writeMessage('Tracker connected!')
            self.markerFound = True
          
          # yay we can proceed
          currentTasks = self.autotracker.read_field_values(self.tasks)
          if currentTasks is not None:
            for key in currentTasks:
              # this seems to be how python operates, seems a bit strange, might be nice to improve structure later
              if key in self.tasks and currentTasks[key] != self.tasks[key]['obtained']:
                self.tasks[key]['obtained'] = currentTasks[key]
                self.printer.writeEvent(self.tasks[key])

          # implement in future if needed
          # currentStats = self.autotracker.read_field_values(self.stats)


JakTracker()