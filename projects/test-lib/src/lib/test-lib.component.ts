import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-test-lib',
  standalone: true,
  imports: [CommonModule],
  template: `
    <p>
      test-lib works!
    </p>
  `,
  styles: ``
})
export class TestLibComponent {

}
