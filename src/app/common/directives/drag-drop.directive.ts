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
    if (evt.dataTransfer.files.length > 0) {
      let file = evt.dataTransfer.files.item(0);
      if (this.allowedFileTypes.find(x => x === "." + file.name.split(".").pop())) {
        this.fileDropped.emit(file);
      }
      else {
        this.deny = true;
        setTimeout(() => { this.deny = false; }, 300);
      }
    }
  }
}
