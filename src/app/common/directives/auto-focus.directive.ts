import { Directive, ElementRef } from '@angular/core';

@Directive({
  selector: "[autofocus]"
})
export class AutoFocusDirective {
  constructor(public elementRef: ElementRef) { }

  ngOnInit() {
    setTimeout(() => {
      this.elementRef.nativeElement.focus();
    });
  }
}
