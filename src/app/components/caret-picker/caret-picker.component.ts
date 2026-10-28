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

  readonly options: { value: CaretStyle; icon: string; title: string }[] = [
    { value: 'line',      icon: '|',  title: 'Line caret'      },
    { value: 'block',     icon: '█',  title: 'Block caret'     },
    { value: 'underline', icon: '_',  title: 'Underline caret' },
    { value: 'off',       icon: '✕',  title: 'No caret'        },
  ];

  select(value: CaretStyle): void {
    if (!this.disabled()) {
      this.caretChange.emit(value);
    }
  }
}
