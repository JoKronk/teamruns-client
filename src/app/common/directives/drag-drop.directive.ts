import {
  Directive,
  Output,
  Input,
  EventEmitter,
  HostBinding,
  HostListener
} from '@angular/core';

@Directive({
  selector: '[dragdrop]'
})
export class DragDropDirective {
  @HostBinding('class.fileover') fileOver: boolean;
  @HostBinding('class.wrongfileover') deny: boolean;
  @Output() fileDropped = new EventEmitter<any>();
  @Input('dragdrop') allowedFileTypes: string[];

  // Dragover listener
  @HostListener('dragover', ['$event']) onDragOver(evt: Event) {
    evt.preventDefault();
    evt.stopPropagation();
    this.fileOver = true;
  }

  // Dragleave listener
  @HostListener('dragleave', ['$event']) public onDragLeave(evt: Event) {
    evt.preventDefault();
    evt.stopPropagation();
    this.fileOver = false;
  }

  // Drop listener
  @HostListener('drop', ['$event']) public ondrop(evt: any) {
    evt.preventDefault();
    evt.stopPropagation();
    this.fileOver = false;
    let validTypes = true;
    if (evt.dataTransfer.files.length > 0) {
      for (let i = 0; i < evt.dataTransfer.files.length; i++) {
        if (!this.allowedFileTypes.find(x => x === "." + evt.dataTransfer.files.item(i).name.split(".").pop()))
          validTypes = false;
      }
      if (validTypes)
        this.fileDropped.emit(evt.dataTransfer.files);
      else {
        this.deny = true;
        setTimeout(() => { this.deny = false; }, 300);
      }
    }
  }
}
