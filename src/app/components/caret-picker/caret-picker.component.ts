import { Component, input, output } from '@angular/core';
import { CaretStyle } from '../../models/models';

@Component({
  selector: 'app-caret-picker',
  templateUrl: './caret-picker.component.html',
  styleUrl: './caret-picker.component.css',
})
export class CaretPickerComponent {
  readonly caretStyle = input<CaretStyle>('line');
  readonly disabled = input(false);
  readonly caretChange = output<CaretStyle>();

  readonly options: { value: CaretStyle; title: string }[] = [
    { value: 'line',      title: 'Line caret'      },
    { value: 'block',     title: 'Block caret'     },
    { value: 'underline', title: 'Underline caret' },
    { value: 'off',       title: 'No caret'        },
  ];

  select(value: CaretStyle): void {
    if (!this.disabled()) {
      this.caretChange.emit(value);
    }
  }
}
