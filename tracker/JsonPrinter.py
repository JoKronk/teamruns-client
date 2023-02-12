import json

class JsonPrinter(object):

  def writeEvent(self, event: dict) -> None:

    # as seperate json object if info ever wants to be added
    self.event = {
      'gameTask': event.get('name'),
      'obtained': event.get('obtained')
    }

    self.message = None
    self.error = None
    print(json.dumps(self.__dict__), flush=True)

  def writeError(self, error: str) -> None:
    self.event = None
    self.message = None
    self.error = error
    print(json.dumps(self.__dict__), flush=True)
  
  def writeMessage(self, message: str) -> None:
    self.event = None
    self.message = message
    self.error = None
    print(json.dumps(self.__dict__), flush=True)